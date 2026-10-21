'use client';

import { ChevronRight, Download, MessageSquare, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PricingTierDto } from '@hoppdrive/shared';
import {
  Alert,
  Button,
  Cell2,
  ChipGroup,
  DrawerLayout,
  EmptyState,
  IconButton,
  Input,
  MobileCard,
  PageHeader,
  Panel,
  SkeletonRows,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Tabs,
  Td,
  Th,
  THead,
  Tr,
  cn,
  useMediaQuery,
  useToast,
} from '@/components/ui';
import { useNewBooking } from '@/components/NewBookingModal';
import { useShellCounts } from '@/components/shell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { bookingErrorText, discountErrorText, isDiscountInvalid } from '@/lib/booking-errors';
import { fetchBookings } from '@/lib/bookings';
import { downloadCsv } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtDateShort, fmtDateTime, fmtMoney, fmtRelative, toInputDate } from '@/lib/format';
import { inquiryDays, matchVehicleByName } from '@/lib/inquiry';
import { InquiryDetail, statusText } from './InquiryDetail';
import { OPEN_STATUSES, type BookingRow, type Inquiry, type InquiryFilter, type VehicleRow } from './types';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const PAGE_SIZE = 10;
const COUNT_KEYS = ['pending', 'reviewed', 'responded', 'converted', 'denied', 'archived'] as const;
type Counts = Record<(typeof COUNT_KEYS)[number], number>;

const byCreatedDesc = (a: Inquiry, b: Inquiry) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

function period(inq: Inquiry): string {
  return inq.desiredStartDate && inq.desiredEndDate ? `${fmtDateShort(inq.desiredStartDate)} – ${fmtDateShort(inq.desiredEndDate)}` : tr('inquiries.keinZeitraum');
}

export default function InquiriesPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <InquiriesView />
    </Suspense>
  );
}

function InquiriesView() {
  const tt = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const booking = useNewBooking();
  const { refresh: refreshCounts } = useShellCounts();
  const canEdit = useCan('inquiries', 'edit');
  const isTabletUp = useMediaQuery('(min-width: 768px)');

  const selectedId = searchParams.get('id');

  // List state
  const [filter, setFilter] = useState<InquiryFilter>('open');
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<Inquiry[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Reference data for the detail drawer
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [tiers, setTiers] = useState<PricingTierDto[] | null>(null);

  // Detail state
  const [cached, setCached] = useState<Inquiry | null>(null);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<{ id: string; text: string } | null>(null);
  // Discount code per inquiry: untouched = the visitor's code, null = removed, text = replaced by the admin.
  const [codeEdits, setCodeEdits] = useState<Record<string, string | null>>({});
  const [codeRejected, setCodeRejected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState({ updating: false, converting: false, denying: false });

  const dataKey = filter === 'open' ? 'open' : `${filter}:${page}`;

  // ── Loading ───────────────────────────────────────────────────

  const fetchList = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        if (filter === 'open') {
          // "Offen" spans three statuses, which the API cannot combine: merge them (newest first).
          const parts = await Promise.all(
            OPEN_STATUSES.map((status) => api.getContactRequests({ status, page: 1, pageSize: 100 })),
          );
          const merged = (parts.flatMap((p) => p.items) as Inquiry[]).sort(byCreatedDesc);
          setSource(merged);
          setServerTotal(merged.length);
          setCounts(parts[0].statusCounts as Counts);
        } else {
          const data = await api.getContactRequests({
            page,
            pageSize: PAGE_SIZE,
            status: filter === 'all' ? undefined : filter,
          });
          setSource(data.items as Inquiry[]);
          setServerTotal(data.total || 0);
          setCounts(data.statusCounts as Counts);
        }
        setLoadError(null);
      } catch (err) {
        if (!silent) setLoadError(errorText(err, tr('inquiries.dieAnfragenKonntenNicht')));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    // dataKey covers filter + page (the open filter does not depend on the page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, dataKey],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const fetchRef = useRef(fetchList);
  fetchRef.current = fetchList;

  // Real-time updates via Server-Sent Events (token as query parameter: EventSource has no headers).
  useEffect(() => {
    if (!token) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      es = new EventSource(`${apiBase}/events?token=${encodeURIComponent(token as string)}`, { withCredentials: true });
      es.addEventListener('new-inquiry', () => {
        void fetchRef.current(true); // silent refresh, no loading state
        refreshCounts();
        toast.info(tr('inquiries.neueAnfrage'), tr('inquiries.ueberDasFormularDer'));
      });
      es.onerror = () => {
        es?.close();
        if (!closed) retryTimeout = setTimeout(connect, 5_000); // reconnect after 5 s
      };
    }

    connect();
    return () => {
      closed = true;
      es?.close();
      clearTimeout(retryTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadReference = useCallback(() => {
    api.getAllVehicles().then((v) => setVehicles(v as VehicleRow[])).catch(() => undefined);
    fetchBookings().then((data) => setBookings((data.items || []) as BookingRow[])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadReference();
    api.getPricingTiers().then(setTiers).catch(() => setTiers(null));
  }, [token, loadReference]);

  // ── Derived lists ─────────────────────────────────────────────

  const pageRows = useMemo(
    () => (filter === 'open' ? source.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : source),
    [filter, source, page],
  );
  const total = filter === 'open' ? source.length : serverTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pageRows;
    return pageRows.filter(
      (inq) =>
        inq.fullName.toLowerCase().includes(q) ||
        inq.email.toLowerCase().includes(q) ||
        (inq.vehicleOfInterest?.toLowerCase().includes(q) ?? false),
    );
  }, [pageRows, search]);

  const openCount = counts ? OPEN_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0) : undefined;
  const allCount = counts ? COUNT_KEYS.reduce((sum, s) => sum + (counts[s] ?? 0), 0) : undefined;

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return source.find((i) => i.id === selectedId) ?? (cached?.id === selectedId ? cached : null);
  }, [selectedId, source, cached]);

  // ── Selection / deep link (?id=) ──────────────────────────────

  const lookedUp = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || !token) {
      lookedUp.current = null;
      return;
    }
    if (selected || lookedUp.current === selectedId || loading) return;
    lookedUp.current = selectedId;
    // The inquiry is not on the loaded page: search the newest inquiries for it.
    (async () => {
      try {
        for (let p = 1; p <= 5; p += 1) {
          const data = await api.getContactRequests({ page: p, pageSize: 100 });
          const hit = (data.items as Inquiry[]).find((i) => i.id === selectedId);
          if (hit) {
            setCached(hit);
            return;
          }
          if (p >= (data.totalPages || 1)) break;
        }
        toast.error(tr('inquiries.anfrageNichtGefunden'), tr('inquiries.derLinkVerweistAuf'));
        router.replace(pathname, { scroll: false });
      } catch (err) {
        toast.error(tr('inquiries.anfrageKonnteNichtGeladen'), errorText(err));
      }
    })();
  }, [selectedId, selected, token, loading, pathname, router, toast]);

  function openInquiry(inq: Inquiry) {
    setCached(inq);
    setActionError(null);
    router.replace(`${pathname}?id=${inq.id}`, { scroll: false });
  }

  function closeDetail() {
    setActionError(null);
    router.replace(pathname, { scroll: false });
  }

  function changeFilter(next: InquiryFilter) {
    setFilter(next);
    setPage(1);
  }

  // ── Actions ───────────────────────────────────────────────────

  function patchInquiry(id: string, patch: Partial<Inquiry>) {
    setSource((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setCached((c) => (c && c.id === id ? { ...c, ...patch } : c));
  }

  async function handleStatus(inq: Inquiry, status: 'reviewed' | 'responded') {
    setBusy((b) => ({ ...b, updating: true }));
    setActionError(null);
    try {
      await api.updateContactStatus(inq.id, status);
      patchInquiry(inq.id, { status, updatedAt: new Date().toISOString() });
      toast.success(status === 'responded' ? tr('inquiries.alsBeantwortetMarkiert') : tr('inquiries.alsGeprueftMarkiert'), inq.fullName);
      void fetchList(true);
      refreshCounts();
    } catch (err) {
      setActionError({ id: inq.id, text: errorText(err, tr('inquiries.derStatusKonnteNicht')) });
    } finally {
      setBusy((b) => ({ ...b, updating: false }));
    }
  }

  /** Converts the inquiry to a booking (atomic on the server: booking + status "converted"). */
  async function handleApprove(inq: Inquiry, withoutCode = false) {
    if (!inq.desiredStartDate || !inq.desiredEndDate) {
      setActionError({ id: inq.id, text: tr('inquiries.keinStartEnddatumIn') });
      return;
    }
    // A manually assigned vehicle wins; otherwise match the name from the inquiry.
    let vehicleId = assigned[inq.id];
    if (!vehicleId && inq.vehicleOfInterest) {
      vehicleId = matchVehicleByName(vehicles, inq.vehicleOfInterest)?.id ?? '';
    }
    if (!vehicleId) {
      setActionError({
        id: inq.id,
        text: inq.vehicleOfInterest
          ? tr('inquiries.fahrzeugNichtGefundenBitte', { vehicleOfInterest: inq.vehicleOfInterest })
          : tr('inquiries.bitteEinFahrzeugZuweisen'),
      });
      return;
    }

    setBusy((b) => ({ ...b, converting: true }));
    setActionError(null);
    try {
      const edit = withoutCode ? null : codeEdits[inq.id];
      const created = await api.approveInquiry(inq.id, edit === undefined ? { vehicleId } : { vehicleId, discountCode: edit });
      patchInquiry(inq.id, { status: 'converted', updatedAt: new Date().toISOString() });
      setCodeRejected((r) => ({ ...r, [inq.id]: false }));
      toast.success(
        tr('inquiries.anfrageInBuchungUmgewandelt'),
        `${tr('inquiries.buchungFuerErstellt', { fullName: inq.fullName })}${
          created?.discountAmount > 0 ? ` · ${tr('newBooking.discountApplied', { amount: fmtMoney(created.discountAmount, { currency: created.currency }) })}` : ''
        }`,
        {
          action: created?.id ? { label: tr('common.zurBuchung'), onClick: () => router.push(`/contracts?id=${created.id}`) } : undefined,
        },
      );
      void fetchList(true);
      loadReference();
      refreshCounts();
    } catch (err) {
      if (isDiscountInvalid(err)) {
        // 422 discount_invalid: say why, and offer to convert without the code
        setCodeRejected((r) => ({ ...r, [inq.id]: true }));
        setActionError({ id: inq.id, text: tr('inquiries.discountRejected', { reason: discountErrorText(err) }) });
      } else {
        setActionError({ id: inq.id, text: bookingErrorText(err, tr('inquiries.fehlerBeimErstellenDer')) });
      }
    } finally {
      setBusy((b) => ({ ...b, converting: false }));
    }
  }

  async function handleDeny(inq: Inquiry, reason: string) {
    setBusy((b) => ({ ...b, denying: true }));
    setActionError(null);
    try {
      await api.denyInquiry(inq.id, { reason: reason || undefined });
      patchInquiry(inq.id, { status: 'denied', updatedAt: new Date().toISOString() });
      toast.success(tr('inquiries.anfrageAbgelehnt'), tr('inquiries.wirdPerEMail', { fullName: inq.fullName }));
      void fetchList(true);
      refreshCounts();
    } catch (err) {
      setActionError({ id: inq.id, text: errorText(err, tr('inquiries.dieAblehnungKonnteNicht')) });
    } finally {
      setBusy((b) => ({ ...b, denying: false }));
    }
  }

  /** Client-side CSV of the current filter (all pages of it) with the search applied. */
  async function handleExport() {
    setExporting(true);
    try {
      let rows: Inquiry[] = [];
      if (filter === 'open') {
        rows = source;
      } else {
        for (let p = 1; p <= 20; p += 1) {
          const data = await api.getContactRequests({ page: p, pageSize: 100, status: filter === 'all' ? undefined : filter });
          rows = rows.concat(data.items as Inquiry[]);
          if (p >= (data.totalPages || 1)) break;
        }
      }
      const q = search.trim().toLowerCase();
      if (q) {
        rows = rows.filter(
          (inq) => inq.fullName.toLowerCase().includes(q) || inq.email.toLowerCase().includes(q) || (inq.vehicleOfInterest?.toLowerCase().includes(q) ?? false),
        );
      }
      if (rows.length === 0) {
        toast.info(tr('inquiries.keineAnfragenZumExportieren'));
        return;
      }
      downloadCsv(
        [
          [tr('inquiries.eingang2'), tr('common.name'), 'E-Mail', tr('common.telefon'), tr('common.fahrzeug'), tr('common.von'), tr('common.bis'), tr('common.tage'), tr('inquiries.stand'), tr('inquiries.nachricht'), tr('inquiries.datenschutz'), tr('inquiries.marketing')],
          ...rows.map((inq) => [
            fmtDateTime(inq.createdAt),
            inq.fullName,
            inq.email,
            inq.phone ?? '',
            inq.vehicleOfInterest ?? '',
            inq.desiredStartDate ? new Date(inq.desiredStartDate) : '',
            inq.desiredEndDate ? new Date(inq.desiredEndDate) : '',
            inquiryDays(inq) || '',
            statusText(inq.status),
            inq.message,
            inq.privacyConsent,
            inq.marketingConsent,
          ]),
        ],
        `hoppdrive-anfragen-${toInputDate(new Date())}.csv`,
      );
      toast.success(tr('common.cSVExportiert'), `${rows.length} ${tr('inquiries.anfrageN', { count: rows.length })}`);
    } catch (err) {
      toast.error(tr('common.exportFehlgeschlagen'), errorText(err));
    } finally {
      setExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  const tabs = [
    { id: 'open', label: tt('common.offen'), count: openCount },
    { id: 'all', label: tt('common.alle'), count: allCount },
    { id: 'denied', label: tt('inquiries.abgelehnt'), count: counts?.denied },
  ];
  const tiles: { id: InquiryFilter; label: string; short?: string; count: number | undefined }[] = [
    { id: 'pending', label: tt('common.neu'), count: counts?.pending },
    { id: 'reviewed', label: tt('inquiries.geprueft'), count: counts?.reviewed },
    { id: 'responded', label: tt('inquiries.beantwortet'), count: counts?.responded },
    { id: 'converted', label: tt('inquiries.buchungErstellt'), short: tt('inquiries.gebucht'), count: counts?.converted },
  ];
  const chipOptions = [
    { value: 'open', label: tt('common.offen'), count: openCount },
    { value: 'pending', label: tt('common.neu'), count: counts?.pending },
    { value: 'reviewed', label: tt('inquiries.geprueft'), count: counts?.reviewed },
    { value: 'responded', label: tt('inquiries.beantwortet'), count: counts?.responded },
    { value: 'converted', label: tt('inquiries.gebucht'), count: counts?.converted },
    { value: 'denied', label: tt('inquiries.abgelehnt'), count: counts?.denied },
    { value: 'all', label: tt('common.alle'), count: allCount },
  ];

  const emptyList = !loading && !loadError && visibleRows.length === 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  const errorBlock = loadError ? (
    <Alert
      tone="err"
      title={tt('inquiries.anfragenKonntenNichtGeladen')}
      action={
        <Button variant="outline" size="sm" onClick={() => void fetchList()}>
          {tt('common.erneutVersuchen')}
        </Button>
      }
    >
      {loadError}
    </Alert>
  ) : null;
  const tabValue = tabs.some((t) => t.id === filter) ? filter : ['pending', 'reviewed', 'responded'].includes(filter) ? 'open' : 'all';

  const emptyState =
    search.trim() ? (
      <EmptyState
        compact
        tone="neutral"
        icon={<Search size={32} />}
        title={tt('inquiries.keineAnfragenGefunden')}
        text={tt('inquiries.fuerGibtEsAuf', { trim: search.trim() })}
        actions={
          <Button variant="ghost" onClick={() => setSearch('')}>
            {tt('inquiries.sucheZuruecksetzen')}
          </Button>
        }
      />
    ) : filter === 'open' ? (
      <EmptyState
        icon={<MessageSquare size={32} />}
        title={tt('inquiries.keineNeuenAnfragen')}
        text={tt('inquiries.sobaldJemandDasFormular')}
        actions={
          <>
            {booking.canCreate && <Button onClick={() => booking.open()}>{tt('inquiries.buchungManuellAnlegen')}</Button>}
            <Button variant="ghost" onClick={() => changeFilter('all')}>
              {tt('inquiries.alleAnfragenAnsehen')}
            </Button>
          </>
        }
      />
    ) : (
      <EmptyState
        compact
        tone="neutral"
        icon={<MessageSquare size={32} />}
        title={tt('inquiries.keineAnfragenInDieser')}
        actions={
          <Button variant="ghost" onClick={() => changeFilter('all')}>
            {tt('inquiries.alleAnfragenAnsehen')}
          </Button>
        }
      />
    );

  const searchField = (
    <div className="relative max-w-[360px]">
      <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
      <Input
        type="search"
        aria-label={tt('inquiries.anfragenAufDieserSeite')}
        placeholder={tt('inquiries.nameEMailOder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10"
      />
    </div>
  );

  const pagination =
    total > 0 ? (
      <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3 max-md:flex-col max-md:items-stretch max-md:border-t-0 max-md:px-0">
        <span className="sm mut max-md:text-center">{tt('inquiries.von', { from, to, total })}</span>
        <div className="flex gap-1.5 max-md:grid max-md:grid-cols-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {tt('common.zurueck')}
          </Button>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {tt('inquiries.weiter')}
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DrawerLayout className="lg:-m-8">
        <div className="flex min-w-0 flex-col gap-5 md:gap-6 lg:p-8">
          <div className="max-md:hidden">
            <PageHeader
              title={tt('common.anfragen')}
              subtitle={tt('inquiries.eingaengeAusDemFormular')}
              actions={
                <Button variant="ghost" loading={exporting} onClick={() => void handleExport()} iconLeft={<Download size={20} aria-hidden="true" />} aria-label={tt('inquiries.cSVExportieren')}>
                  <span className="max-lg:hidden">{tt('inquiries.cSVExportieren')}</span>
                  <span className="lg:hidden">CSV</span>
                </Button>
              }
            />
          </div>
          <h1 className="sr-only md:hidden">{tt('common.anfragen')}</h1>

          {/* Pipeline tiles (tablet and up) */}
          <div
            role="group"
            aria-label={tt('inquiries.anfragenNachStand')}
            className="grid grid-cols-4 overflow-hidden rounded-2xl border border-line bg-card max-md:hidden"
          >
            {tiles.map((tile) => {
              const active = filter === tile.id;
              return (
                <button
                  key={tile.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeFilter(active ? 'open' : tile.id)}
                  className={cn(
                    'flex min-h-[76px] flex-col items-start justify-center gap-0.5 border-r border-line-soft px-5 py-4 text-left last:border-r-0 hover:bg-row',
                    active && 'bg-ruby-tint hover:bg-ruby-tint',
                  )}
                >
                  <span className="sm mut">
                    {tile.short ? (
                      <>
                        <span className="max-lg:hidden">{tile.label}</span>
                        <span className="lg:hidden">{tile.short}</span>
                      </>
                    ) : (
                      tile.label
                    )}
                  </span>
                  <b className="num text-[28px] leading-none">{tile.count ?? '–'}</b>
                </button>
              );
            })}
          </div>

          {/* Mobile: status chips */}
          <div className="md:hidden">
            <ChipGroup
              aria-label={tt('inquiries.stand')}
              scrollable
              options={chipOptions}
              value={filter}
              onChange={(value) => changeFilter(value as InquiryFilter)}
              className="-mx-4 px-4"
            />
          </div>

          {errorBlock}

          {isTabletUp ? (
            <Panel aria-labelledby="inquiries-heading" className="overflow-hidden">
              <div className="panel-h">
                <h2 className="h2" id="inquiries-heading">
                  {tt('inquiries.alleAnfragen')}
                </h2>
                <Tabs
                  aria-label={tt('inquiries.filter')}
                  tabs={tabs}
                  value={tabValue}
                  onChange={(id) => changeFilter(id as InquiryFilter)}
                />
              </div>
              <div className="border-b border-line-soft px-5 py-3">{searchField}</div>
              {loading ? (
                <Table aria-label={tt('inquiries.anfragenWirdGeladen')} className="relative">
                  <TBody>
                    <SkeletonTableRows rows={6} columns={4} />
                  </TBody>
                </Table>
              ) : emptyList && !loadError ? (
                emptyState
              ) : (
                <Table aria-label={tt('common.anfragen')} className="relative">
                  <THead>
                    <Tr>
                      <Th>{tt('common.kunde')}</Th>
                      <Th>{tt('inquiries.fahrzeugUndZeitraum')}</Th>
                      <Th>{tt('inquiries.stand')}</Th>
                      <Th align="right">
                        <span className="sr-only">{tt('inquiries.oeffnen')}</span>
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {visibleRows.map((inq) => (
                      <Tr key={inq.id} selected={inq.id === selectedId} onClick={() => openInquiry(inq)}>
                        <Td>
                          <Cell2 primary={inq.fullName} secondary={fmtRelative(inq.createdAt, { capitalize: true })} />
                        </Td>
                        <Td>
                          <Cell2
                            primary={inq.vehicleOfInterest || <span className="font-semibold text-warn">{tt('inquiries.fahrzeugOffen')}</span>}
                            secondary={<span className="num">{period(inq)}</span>}
                          />
                        </Td>
                        <Td>
                          <StatusPill kind="contact" status={inq.status} />
                        </Td>
                        <Td>
                          <div className="acts">
                            <IconButton aria-label={tt('inquiries.anfrageVonOeffnen', { fullName: inq.fullName })} aria-current={inq.id === selectedId ? 'true' : undefined} onClick={(e) => { e.stopPropagation(); openInquiry(inq); }}>
                              <ChevronRight size={20} aria-hidden="true" />
                            </IconButton>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
              {!loading && pagination}
            </Panel>
          ) : (
            <div className="flex flex-col gap-3">
              {searchField}
              {loading ? (
                <SkeletonRows rows={4} />
              ) : emptyList && !loadError ? (
                emptyState
              ) : (
                visibleRows.map((inq) => (
                  <MobileCard
                    key={inq.id}
                    title={<span className="text-base">{inq.fullName}</span>}
                    subtitle={fmtRelative(inq.createdAt, { capitalize: true })}
                    status={<StatusPill kind="contact" status={inq.status} />}
                    onOpen={() => openInquiry(inq)}
                    actions={
                      <Button variant="outline" fullWidth onClick={() => openInquiry(inq)} aria-label={tt('inquiries.anfrageVonOeffnen', { fullName: inq.fullName })}>
                        {tt('inquiries.oeffnen')}
                      </Button>
                    }
                  >
                    <div>{inq.vehicleOfInterest || <span className="font-semibold text-warn">{tt('inquiries.fahrzeugOffen')}</span>}</div>
                    <div className="num mut">{period(inq)}</div>
                  </MobileCard>
                ))
              )}
              {!loading && pagination}
            </div>
          )}
        </div>

        <InquiryDetail
          inquiry={selected}
          vehicles={vehicles}
          bookings={bookings}
          tiers={tiers}
          canEdit={canEdit}
          assignedVehicleId={selected ? (assigned[selected.id] ?? '') : ''}
          onAssignVehicle={(vehicleId) => {
            if (!selected) return;
            setAssigned((a) => ({ ...a, [selected.id]: vehicleId }));
            setActionError(null);
          }}
          actionError={selected && actionError?.id === selected.id ? actionError.text : null}
          busy={busy}
          onClose={closeDetail}
          onMarkReviewed={() => selected && void handleStatus(selected, 'reviewed')}
          onMarkResponded={() => selected && void handleStatus(selected, 'responded')}
          onApprove={() => selected && void handleApprove(selected)}
          onApproveWithoutCode={() => selected && void handleApprove(selected, true)}
          discountCode={selected ? (selected.id in codeEdits ? codeEdits[selected.id] : (selected.discountCode ?? null)) : null}
          discountRejected={selected ? Boolean(codeRejected[selected.id]) : false}
          onChangeDiscountCode={(code) => {
            if (!selected) return;
            setCodeEdits((e) => ({ ...e, [selected.id]: code.trim() ? code : null }));
            setCodeRejected((r) => ({ ...r, [selected.id]: false }));
            setActionError(null);
          }}
          onDeny={(reason) => selected && void handleDeny(selected, reason)}
        />
      </DrawerLayout>
    </div>
  );
}
