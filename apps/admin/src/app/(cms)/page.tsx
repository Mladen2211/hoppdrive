'use client';

import {
  CalendarCheck,
  CarFront,
  ChevronRight,
  CircleCheck,
  Download,
  FileText,
  MessageSquare,
  PenTool,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuditLogEntryDto, DashboardStatsDto } from '@hoppdrive/shared';
import {
  Alert,
  Button,
  Cell2,
  EmptyState,
  IconButton,
  KpiCard,
  MobileCard,
  Panel,
  PanelHeader,
  Skeleton,
  SkeletonRows,
  StatusPill,
  Table,
  TBody,
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
import { useCurrency } from '@/hooks/useCurrency';
import { useCan } from '@/hooks/usePermission';
import { api, isForbidden } from '@/lib/api';
import { describeAudit } from '@/lib/audit';
import { contractFilename } from '@/lib/booking';
import { fetchBookings } from '@/lib/bookings';
import { errorText } from '@/lib/errors';
import { fmtDateShort, fmtMoney, fmtRelative } from '@/lib/format';
import { triggerBlobDownload } from '@/lib/download';
import { inquiryDays, matchVehicleByName, sinceText } from '@/lib/inquiry';
import { fetchPriceQuote } from '@/lib/pricing';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

// ─── Types ──────────────────────────────────────────────────────

interface Booking {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  totalPrice?: number;
  currency?: string;
  contractStatus?: string;
  createdAt?: string;
  vehicle?: { brand: string; model: string } | null;
}

interface Vehicle {
  id: string;
  brand: string;
  model: string;
}

interface Maintenance {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface PendingInquiry {
  id: string;
  fullName: string;
  vehicleOfInterest?: string | null;
  desiredStartDate?: string | null;
  desiredEndDate?: string | null;
  createdAt: string;
}

const MAINTENANCE_REASON: Record<string, string> = { get repair() { return tr('dashboard.reparatur'); }, get accident() { return tr('dashboard.unfall'); }, get other() { return tr('dashboard.sonstiges'); } };
const RECENT_BOOKINGS = 6;

const vehicleLabel = (b: Booking) => (b.vehicle?.brand ? `${b.vehicle.brand} ${b.vehicle.model}` : '–');
const periodText = (b: Booking) => `${fmtDateShort(b.startDate)} – ${fmtDateShort(b.endDate)}`;

function coversToday(start: string, end: string): boolean {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return new Date(start).getTime() < dayEnd && new Date(end).getTime() >= dayStart;
}

type FleetState = 'rented' | 'reserved' | 'maintenance' | 'available';

// ─── Page ───────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const t = useTranslations();
  const { token, role } = useAdminAuth();
  const { toast } = useToast();
  const { bookingsVersion } = useNewBooking();
  const { refresh: refreshCounts } = useShellCounts();
  const currency = useCurrency();

  const canContractsView = useCan('contracts', 'view');
  const canContractsEdit = useCan('contracts', 'edit');
  const canCalendarView = useCan('calendar', 'view');
  const canFleetPage = useCan('fleet', 'view');
  const canInquiries = useCan('inquiries', 'view');
  const canActivity = useCan('users', 'view');
  const canBookings = canContractsView || canCalendarView; // GET /bookings: contracts or calendar
  const canFleetData = canFleetPage || canCalendarView; // GET /maintenance, /vehicles/admin/all: fleet or calendar

  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isUltra = useMediaQuery('(min-width: 1600px)');

  const [stats, setStats] = useState<DashboardStatsDto | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [pending, setPending] = useState<PendingInquiry[] | null>(null);
  const [audit, setAudit] = useState<AuditLogEntryDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [quotes, setQuotes] = useState<Record<string, number>>({});

  // Contract signing (SignaturePad) and downloads
  const [signing, setSigning] = useState<Booking | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !role) return;
    let cancelled = false;

    async function load() {
      const [statsRes, bookingsRes, maintenanceRes, vehiclesRes, pendingRes, auditRes] = await Promise.allSettled([
        api.getDashboardStats(),
        canBookings ? fetchBookings() : Promise.resolve(null),
        canFleetData ? api.getMaintenance() : Promise.resolve(null),
        canFleetData ? api.getAllVehicles() : Promise.resolve(null),
        canInquiries ? api.getContactRequests({ status: 'pending', page: 1, pageSize: 100 }) : Promise.resolve(null),
        canActivity ? api.getAuditLogs({ pageSize: 8 }) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value as DashboardStatsDto);
        setStatsFailed(false);
      } else {
        setStatsFailed(true);
      }
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value) setBookings((bookingsRes.value.items || []) as Booking[]);
      if (maintenanceRes.status === 'fulfilled' && maintenanceRes.value) setMaintenance(maintenanceRes.value as Maintenance[]);
      if (vehiclesRes.status === 'fulfilled' && vehiclesRes.value) setVehicles(vehiclesRes.value as Vehicle[]);
      if (pendingRes.status === 'fulfilled' && pendingRes.value) setPending(pendingRes.value.items as PendingInquiry[]);
      // The activity log is Administrator-only: a 403 simply hides the panel.
      if (auditRes.status === 'fulfilled' && auditRes.value) setAudit(auditRes.value.items);
      else if (auditRes.status === 'rejected' && !isForbidden(auditRes.reason)) setAudit([]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, role, canBookings, canFleetData, canInquiries, canActivity, reloadKey, bookingsVersion]);

  // ── Derived data ──────────────────────────────────────────────

  const recentBookings = useMemo(
    () =>
      [...(bookings ?? [])]
        .sort((a, b) => new Date(b.createdAt ?? b.startDate).getTime() - new Date(a.createdAt ?? a.startDate).getTime())
        .slice(0, RECENT_BOOKINGS),
    [bookings],
  );

  const vehicleName = useCallback(
    (id: string) => {
      const v = vehicles?.find((x) => x.id === id);
      return v ? `${v.brand} ${v.model}` : tr('common.fahrzeug');
    },
    [vehicles],
  );

  const maintenanceToday = useMemo(() => (maintenance ?? []).filter((m) => coversToday(m.startDate, m.endDate)), [maintenance]);

  const fleetToday = useMemo(() => {
    if (!vehicles) return null;
    const inMaintenance = new Set(maintenanceToday.map((m) => m.vehicleId));
    const rented = new Set((bookings ?? []).filter((b) => b.status === 'active').map((b) => b.vehicleId));
    const reserved = new Set(
      (bookings ?? []).filter((b) => b.status === 'reserved' && coversToday(b.startDate, b.endDate)).map((b) => b.vehicleId),
    );
    return vehicles.map((v) => {
      const state: FleetState = inMaintenance.has(v.id)
        ? 'maintenance'
        : rented.has(v.id)
          ? 'rented'
          : reserved.has(v.id)
            ? 'reserved'
            : 'available';
      return { id: v.id, name: `${v.brand} ${v.model}`, state };
    });
  }, [vehicles, bookings, maintenanceToday]);

  const newestPending = useMemo(
    () => [...(pending ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3),
    [pending],
  );
  const oldestPending = useMemo(() => {
    if (!pending || pending.length === 0) return null;
    return pending.reduce((oldest, p) => (new Date(p.createdAt) < new Date(oldest.createdAt) ? p : oldest)).createdAt;
  }, [pending]);

  const activity = useMemo(
    () =>
      (audit ?? [])
        .map((entry) => ({ entry, sentence: describeAudit(entry) }))
        .filter((row): row is { entry: AuditLogEntryDto; sentence: NonNullable<ReturnType<typeof describeAudit>> } => row.sentence !== null)
        .slice(0, 3),
    [audit],
  );

  // Richtpreis of the newest inquiries (ultra-wide column only; needs a matching vehicle and dates).
  useEffect(() => {
    if (!isUltra || !vehicles || newestPending.length === 0) return;
    let cancelled = false;
    newestPending.forEach((inq) => {
      const vehicle = matchVehicleByName(vehicles, inq.vehicleOfInterest);
      const days = inquiryDays(inq);
      if (!vehicle || days < 1) return;
      fetchPriceQuote(vehicle.id, days)
        .then((quote) => {
          if (!cancelled) setQuotes((current) => ({ ...current, [inq.id]: quote.totalPrice }));
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [isUltra, vehicles, newestPending]);

  // ── Actions ───────────────────────────────────────────────────

  async function handleDownloadContract(bookingId: string) {
    setDownloadingId(bookingId);
    try {
      const blob = await api.downloadContract(bookingId);
      triggerBlobDownload(blob, contractFilename(bookingId));
    } catch (err) {
      toast.error(tr('common.vertragKonnteNichtHeruntergela'), errorText(err));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSignContract(signatureDataUrl: string) {
    if (!signing) return;
    setSigningLoading(true);
    try {
      await api.finalizeContract(signing.id, {
        signature: signatureDataUrl,
        customerEmail: signing.customerEmail || undefined,
      });
      toast.success(tr('common.vertragSigniert'), signing.customerEmail ? tr('common.derVertragWurdePer') : tr('dashboard.vertragVonGespeichert', { customerName: signing.customerName }));
      setSigning(null);
      setReloadKey((k) => k + 1);
      refreshCounts();
    } catch (err) {
      toast.error(tr('common.vertragKonnteNichtSigniert'), errorText(err));
    } finally {
      setSigningLoading(false);
    }
  }

  // ── "Heute zu tun" rows (only rows with something to do) ──────

  const todayRows: TodayRowData[] = [];
  const pendingInquiries = pending ? pending.length : (stats?.pendingInquiries ?? 0);
  if (canInquiries && pendingInquiries > 0) {
    todayRows.push({
      key: 'inquiries',
      href: '/inquiries',
      tone: 'info',
      icon: <MessageSquare size={20} aria-hidden="true" />,
      title: `${pendingInquiries} ${t('dashboard.neueAnfrageN', { count: pendingInquiries })}`,
      text: oldestPending ? t('dashboard.aeltesteUnbeantwortet', { sinceText: sinceText(oldestPending) }) : t('dashboard.wartenAufEineAntwort'),
    });
  }
  const endingSoon = stats?.pendingReturns ?? 0;
  if (canContractsView && endingSoon > 0) {
    todayRows.push({
      key: 'returns',
      href: '/contracts',
      tone: 'warn',
      icon: <FileText size={20} aria-hidden="true" />,
      title: t('dashboard.baldAus', { endingSoon }),
      text: t('dashboard.innerhalbDerNaechsten7'),
    });
  }
  const overdue = stats?.overdueInvoices ?? 0;
  if (canContractsView && overdue > 0) {
    todayRows.push({
      key: 'overdue',
      href: '/contracts?tab=rechnungen',
      tone: 'err',
      icon: <TriangleAlert size={20} aria-hidden="true" />,
      title: `${overdue} ${t('dashboard.rechnungUeberfaelligN', { count: overdue })}`,
      text: t('dashboard.zahlungsfristAbgelaufenMahnung'),
    });
  }
  if (maintenanceToday.length > 0) {
    const names = Array.from(new Set(maintenanceToday.map((m) => vehicleName(m.vehicleId))));
    const first = maintenanceToday[0];
    todayRows.push({
      key: 'maintenance',
      href: canFleetPage ? (maintenanceToday.length === 1 ? `/fleet?id=${first.vehicleId}` : '/fleet') : undefined,
      tone: 'neutral',
      icon: <Wrench size={20} aria-hidden="true" />,
      title: maintenanceToday.length === 1 ? t('dashboard.wartungHeute') : t('dashboard.fahrzeugeInWartung', { length: maintenanceToday.length }),
      text:
        maintenanceToday.length === 1
          ? `${names[0]}${first.reason ? `, ${MAINTENANCE_REASON[first.reason] ?? first.reason}` : ''}`
          : names.join(', '),
    });
  }

  // ── KPI values ────────────────────────────────────────────────

  const change = stats?.revenueChangePercent ?? 0;
  const revenueTrend =
    change > 0 ? t('dashboard.zumVormonat', { change }) : change < 0 ? t('dashboard.zumVormonat2', { abs: Math.abs(change) }) : t('dashboard.unveraendertZumVormonat');
  const revenueTone: 'ok' | 'err' | 'mute' = change > 0 ? 'ok' : change < 0 ? 'err' : 'mute';
  const returnsTrend = endingSoon > 0 ? t('dashboard.in7Tagen', { endingSoon }) : t('dashboard.keineRueckgabenIn7');
  const kpiMobile = 'max-md:gap-1 max-md:p-3 max-md:[&_.ic]:hidden max-md:[&_b]:text-[28px] max-md:[&_.l]:text-[13px]';

  const todayPanel = (
    <TodayPanel rows={todayRows} loading={loading} idSuffix={isUltra ? 'side' : 'main'} />
  );
  const activityPanel = canActivity && audit !== null ? <ActivityPanel rows={activity} /> : null;

  const mainColumn = (
    <div className="flex min-w-0 flex-col gap-5 md:gap-6 3xl:p-8">
      <header className="pg-h">
        <div>
          <h1 className="h1 max-md:text-2xl">{t('dashboard.uebersicht')}</h1>
          <p className="max-md:hidden">{t('dashboard.mietvertraegeUndSystemstatusAu')}</p>
        </div>
      </header>

      {statsFailed && !stats && (
        <Alert
          tone="err"
          title={t('dashboard.dieUebersichtKonnteNicht')}
          action={
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {t('dashboard.dieVerbindungZumServer')}
        </Alert>
      )}

      <section aria-label={t('dashboard.kennzahlen')} className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
        {loading && !stats ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] md:h-[156px]" rounded={16} />)
        ) : (
          <>
            <KpiCard
              className={kpiMobile}
              label={<><span className="md:hidden">{t('common.fahrzeuge')}</span><span className="max-md:hidden">{t('dashboard.fahrzeugeGesamt')}</span></>}
              value={stats?.totalVehicles ?? '–'}
              icon={<CarFront size={20} />}
              trend={stats ? t('dashboard.auslastung', { fleetUtilization: stats.fleetUtilization }) : undefined}
              trendTone="mute"
            />
            <KpiCard
              className={kpiMobile}
              label={t('dashboard.neueAnfragen')}
              value={stats?.pendingInquiries ?? '–'}
              icon={<MessageSquare size={20} />}
              trend={stats ? t('dashboard.dieseWoche', { newInquiriesThisWeek: stats.newInquiriesThisWeek }) : undefined}
              trendTone={stats && stats.newInquiriesThisWeek > 0 ? 'ok' : 'mute'}
              href={canInquiries ? '/inquiries' : undefined}
            />
            <KpiCard
              className={kpiMobile}
              label={t('dashboard.aktiveBuchungen')}
              value={stats?.activeRentals ?? '–'}
              icon={<CalendarCheck size={20} />}
              trend={stats ? returnsTrend : undefined}
              trendTone="mute"
              href={canContractsView ? '/contracts' : undefined}
            />
            <KpiCard
              className={cn(kpiMobile, 'max-md:[&_b]:text-[22px]')}
              label={<><span className="md:hidden">{t('dashboard.umsatzMonat')}</span><span className="max-md:hidden">{t('dashboard.monatlicherUmsatz')}</span></>}
              value={stats ? fmtMoney(stats.monthlyRevenue, { currency, decimals: 0 }) : '–'}
              icon={<TrendingUp size={20} />}
              trend={stats ? revenueTrend : undefined}
              trendTone={revenueTone}
            />
          </>
        )}
      </section>

      {isUltra && fleetToday && <FleetPanel fleet={fleetToday} canLink={canFleetPage} />}

      <div className="grid min-w-0 gap-5 md:gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:items-start 3xl:grid-cols-1">
        {!isUltra && <div className="lg:col-start-2 lg:row-start-1">{todayPanel}</div>}
        {canBookings && (
          <div className={cn('min-w-0', !isUltra && 'lg:col-start-1 lg:row-span-2 lg:row-start-1')}>
            <BookingsSection
              bookings={recentBookings}
              loading={loading && bookings === null}
              tabletUp={isTabletUp}
              desktop={isDesktop}
              ultra={isUltra}
              canContractsView={canContractsView}
              canContractsEdit={canContractsEdit}
              downloadingId={downloadingId}
              onDownload={handleDownloadContract}
              onSign={setSigning}
            />
          </div>
        )}
        {!isUltra && activityPanel && <div className="lg:col-start-2 lg:row-start-2">{activityPanel}</div>}
      </div>
    </div>
  );

  return (
    <>
      <div className="3xl:-m-8 3xl:grid 3xl:min-h-[calc(100dvh-68px-env(safe-area-inset-top))] 3xl:grid-cols-[minmax(0,1fr)_420px]">
        {mainColumn}
        {isUltra && (
          <aside aria-label={t('common.heute')} className="flex min-w-0 flex-col gap-6 border-l border-line bg-card px-6 py-8">
            {todayPanel}
            {canInquiries && pending !== null && (
              <NewInquiriesPanel rows={newestPending} vehicles={vehicles} quotes={quotes} />
            )}
            {activityPanel}
          </aside>
        )}
      </div>

      {signing && (
        <SignaturePad
          customerName={signing.customerName}
          loading={signingLoading}
          onCancel={() => setSigning(null)}
          onConfirm={handleSignContract}
        />
      )}
    </>
  );
}

// ─── Heute zu tun ───────────────────────────────────────────────

interface TodayRowData {
  key: string;
  href?: string;
  tone: 'info' | 'warn' | 'err' | 'neutral';
  icon: ReactNode;
  title: string;
  text: string;
}

const TODAY_TONE: Record<TodayRowData['tone'], string> = {
  info: 'bg-info-tint text-info',
  warn: 'bg-warn-tint text-warn',
  err: 'bg-err-tint text-err-strong',
  neutral: 'bg-paper text-graphite',
};

function TodayPanel({ rows, loading, idSuffix }: { rows: TodayRowData[]; loading: boolean; idSuffix: string }) {
  const t = useTranslations();
  const headingId = `today-heading-${idSuffix}`;
  return (
    <Panel aria-labelledby={headingId} className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2 max-md:h3" id={headingId}>
          {t('dashboard.heuteZuTun')}
        </h2>
        {rows.length > 0 && <span className="st s-amber">{t('dashboard.offen', { length: rows.length })}</span>}
      </div>
      {loading ? (
        <SkeletonRows rows={3} pill={false} className="px-5 py-2" />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          tone="ok"
          icon={<CircleCheck size={32} />}
          title={t('dashboard.allesErledigt')}
          text={t('dashboard.heuteGibtEsNichts')}
          headingLevel={3}
        />
      ) : (
        <ul>
          {rows.map((row) => {
            const inner = (
              <>
                <span className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-xl max-md:h-9 max-md:w-9 max-md:rounded-10', TODAY_TONE[row.tone])}>
                  {row.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold">{row.title}</b>
                  <span className="sm mut block">{row.text}</span>
                </span>
                {row.href && <ChevronRight size={20} aria-hidden="true" className="flex-none text-graphite" />}
              </>
            );
            const cls = 'flex min-h-[64px] items-center gap-3.5 border-b border-line-soft px-5 py-3.5 no-underline last:border-b-0 max-md:min-h-[56px] max-md:px-3.5 max-md:py-1.5';
            return (
              <li key={row.key}>
                {row.href ? (
                  <Link href={row.href} className={cn(cls, 'hover:bg-row')}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ─── Letzte Aktivität ───────────────────────────────────────────

function ActivityPanel({ rows }: { rows: { entry: AuditLogEntryDto; sentence: { actor: string; text: string } }[] }) {
  const t = useTranslations();
  return (
    <Panel aria-labelledby="activity-heading" className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2 max-md:h3" id="activity-heading">
          {t('dashboard.letzteAktivitaet')}
        </h2>
        <Link href="/settings?tab=activity" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ruby-dark underline">
          {t('dashboard.protokoll')}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mut px-5 py-5">{t('dashboard.nochKeineAktivitaetAufgezeichn')}</p>
      ) : (
        <ul className="px-5 pb-3 pt-1.5">
          {rows.map(({ entry, sentence }) => (
            <li key={entry.id} className="border-b border-line-soft py-2.5 last:border-b-0">
              <b className="font-semibold">{sentence.actor}</b> {sentence.text}
              <div className="sm mut">{fmtRelative(entry.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ─── Neue Anfragen (ultra-wide column) ──────────────────────────

function NewInquiriesPanel({
  rows,
  vehicles,
  quotes,
}: {
  rows: PendingInquiry[];
  vehicles: Vehicle[] | null;
  quotes: Record<string, number>;
}) {
  const t = useTranslations();
  const currency = useCurrency();
  return (
    <Panel aria-labelledby="new-inquiries-heading" className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2" id="new-inquiries-heading">
          {t('dashboard.neueAnfragen')}
        </h2>
        <Link href="/inquiries" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ruby-dark underline">
          {t('common.alle')}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mut px-5 py-5">{t('dashboard.keineNeuenAnfragen')}</p>
      ) : (
        <ul>
          {rows.map((inq) => {
            const vehicle = vehicles ? matchVehicleByName(vehicles, inq.vehicleOfInterest) : undefined;
            const quote = quotes[inq.id];
            const period =
              inq.desiredStartDate && inq.desiredEndDate ? `${fmtDateShort(inq.desiredStartDate)} – ${fmtDateShort(inq.desiredEndDate)}` : t('dashboard.zeitraumOffen');
            return (
              <li key={inq.id} className="border-b border-line-soft last:border-b-0">
                <Link href={`/inquiries?id=${inq.id}`} className="block px-5 py-3 no-underline hover:bg-row">
                  <b className="font-semibold">{inq.fullName}</b>
                  {(vehicle || inq.vehicleOfInterest) && (
                    <span className="mut"> · {vehicle ? `${vehicle.brand} ${vehicle.model}` : inq.vehicleOfInterest}</span>
                  )}
                  <div className="sm num mut">
                    {period}
                    {quote !== undefined && ` · ${fmtMoney(quote, { currency })}`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ─── Flotte heute (ultra-wide) ──────────────────────────────────

const FLEET_ORDER: FleetState[] = ['rented', 'reserved', 'available', 'maintenance'];
const FLEET_LABEL: Record<FleetState, string> = {
  get rented() { return tr('dashboard.vermietet'); },
  get reserved() { return tr('common.reserviert'); },
  get available() { return tr('dashboard.verfuegbar'); },
  get maintenance() { return tr('common.wartung'); },
};
const FLEET_TONE = { rented: 'green', reserved: 'blue', available: 'gray', maintenance: 'amber' } as const;

function FleetPanel({ fleet, canLink }: { fleet: { id: string; name: string; state: FleetState }[]; canLink: boolean }) {
  const t = useTranslations();
  const counts = FLEET_ORDER.map((state) => ({ state, n: fleet.filter((f) => f.state === state).length }));
  return (
    <Panel aria-labelledby="fleet-heading">
      <div className="panel-h">
        <h2 className="h2" id="fleet-heading">
          {t('dashboard.flotteHeute')}
        </h2>
        <ul className="sm flex flex-wrap gap-2 md:gap-4">
          {counts.map(({ state, n }) => (
            <li key={state}>
              <StatusPill tone={FLEET_TONE[state]} label={`${FLEET_LABEL[state]} ${n}`} className="!h-[22px]" />
            </li>
          ))}
        </ul>
      </div>
      {fleet.length === 0 ? (
        <p className="mut px-5 py-5">{t('dashboard.nochKeineFahrzeugeAngelegt')}</p>
      ) : (
        <ul className="panel-b grid grid-cols-6 gap-3">
          {fleet.map((f) => {
            const body = (
              <>
                <b className="text-sm leading-tight">{f.name}</b>
                <StatusPill tone={FLEET_TONE[f.state]} label={FLEET_LABEL[f.state]} className="!h-[22px] self-start !text-xs" />
              </>
            );
            const cls = 'flex min-w-0 flex-col gap-1.5 rounded-xl border-[1.5px] border-line bg-card px-3 py-2.5 no-underline';
            return (
              <li key={f.id} className="min-w-0">
                {canLink ? (
                  <Link href={`/fleet?id=${f.id}`} className={cn(cls, 'hover:border-ink')}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ─── Aktuelle Buchungen ─────────────────────────────────────────

interface BookingsSectionProps {
  bookings: Booking[];
  loading: boolean;
  tabletUp: boolean;
  desktop: boolean;
  ultra: boolean;
  canContractsView: boolean;
  canContractsEdit: boolean;
  downloadingId: string | null;
  onDownload: (bookingId: string) => void;
  onSign: (booking: Booking) => void;
}

function BookingActions({
  booking,
  canView,
  canEdit,
  downloadingId,
  onDownload,
  onSign,
}: {
  booking: Booking;
  canView: boolean;
  canEdit: boolean;
  downloadingId: string | null;
  onDownload: (id: string) => void;
  onSign: (b: Booking) => void;
}) {
  const t = useTranslations();
  const signed = booking.contractStatus === 'SIGNED';
  return (
    <>
      {signed && canView && (
        <IconButton
          aria-label={t('dashboard.vertragVonHerunterladen', { customerName: booking.customerName })}
          className="pr"
          disabled={downloadingId === booking.id}
          onClick={() => onDownload(booking.id)}
        >
          <Download size={20} aria-hidden="true" />
        </IconButton>
      )}
      {!signed && canEdit && booking.status !== 'cancelled' && (
        <IconButton
          aria-label={t('dashboard.vertragVonUnterschreiben', { customerName: booking.customerName })}
          className="pr"
          onClick={() => onSign(booking)}
        >
          <PenTool size={20} aria-hidden="true" />
        </IconButton>
      )}
    </>
  );
}

function BookingsSection(props: BookingsSectionProps) {
  const tt = useTranslations();
  const t = useTranslations();
  const { bookings, loading, tabletUp, desktop, ultra, canContractsView, canContractsEdit, downloadingId, onDownload, onSign } = props;
  const businessCurrency = useCurrency();
  const actionProps = { canView: canContractsView, canEdit: canContractsEdit, downloadingId, onDownload, onSign };
  const allLink = canContractsView ? (
    <Button href="/contracts" variant="ghost" size="sm" className="max-md:hidden">
      {t('dashboard.alleVertraege')}
    </Button>
  ) : null;

  // Mobile: heading + cards (no panel)
  if (!tabletUp) {
    return (
      <section aria-labelledby="bookings-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="h3" id="bookings-heading">
            {t('dashboard.aktuelleBuchungen')}
          </h2>
          {canContractsView && (
            <Link href="/contracts" className="inline-flex min-h-[44px] items-center font-semibold text-ruby-dark underline">
              {t('common.alle')}
            </Link>
          )}
        </div>
        {loading ? (
          <Skeleton className="h-[110px]" rounded={14} />
        ) : bookings.length === 0 ? (
          <p className="mut">{t('dashboard.keineBuchungenVorhanden')}</p>
        ) : (
          bookings.map((b) => (
            <MobileCard
              key={b.id}
              title={b.customerName}
              subtitle={vehicleLabel(b)}
              status={<StatusPill kind="booking" status={b.status} />}
              href={canContractsView ? `/contracts?id=${b.id}` : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num sm">{periodText(b)}</span>
                <div className="-my-1.5 flex gap-1">
                  <BookingActions booking={b} {...actionProps} />
                </div>
              </div>
            </MobileCard>
          ))
        )}
      </section>
    );
  }

  const variant = ultra ? 'ultra' : desktop ? 'desktop' : 'tablet';
  return (
    <Panel aria-labelledby="bookings-heading" className="overflow-hidden">
      <PanelHeader title={<span id="bookings-heading">{t('dashboard.aktuelleBuchungen')}</span>} actions={allLink} />
      {loading ? (
        <SkeletonRows rows={5} className="px-5 py-2" />
      ) : bookings.length === 0 ? (
        <EmptyState
          compact
          title={t('dashboard.nochKeineBuchungen')}
          text={t('dashboard.sobaldEineBuchungAngelegt')}
          headingLevel={3}
        />
      ) : (
        <Table aria-label={t('dashboard.aktuelleBuchungen')} className="relative">
          <THead>
            <Tr>
              <Th>{variant === 'tablet' ? t('dashboard.kundeUndFahrzeug') : t('common.kunde')}</Th>
              {variant !== 'tablet' && <Th>{t('common.fahrzeug')}</Th>}
              {variant === 'ultra' ? (
                <>
                  <Th>{t('common.zeitraum')}</Th>
                  <Th>{t('common.status')}</Th>
                  <Th align="right">{t('dashboard.betrag')}</Th>
                </>
              ) : (
                <>
                  <Th>{t('common.status')}</Th>
                  <Th>{t('common.zeitraum')}</Th>
                </>
              )}
              <Th align="right">
                <span className="sr-only">{t('common.aktionen')}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {bookings.map((b) => {
              const customer = (
                <Cell2
                  primary={
                    canContractsView ? (
                      <Link href={`/contracts?id=${b.id}`} className="text-ink no-underline hover:underline">
                        {b.customerName}
                      </Link>
                    ) : (
                      b.customerName
                    )
                  }
                  secondary={variant === 'tablet' ? vehicleLabel(b) : (b.customerEmail ?? tt('dashboard.keineEMailHinterlegt'))}
                />
              );
              const period = <Td className="num whitespace-nowrap">{periodText(b)}</Td>;
              const status = (
                <Td>
                  <StatusPill kind="booking" status={b.status} />
                </Td>
              );
              return (
                <Tr key={b.id}>
                  <Td>{customer}</Td>
                  {variant !== 'tablet' && <Td>{vehicleLabel(b)}</Td>}
                  {variant === 'ultra' ? (
                    <>
                      {period}
                      {status}
                      <Td align="right" className="num text-base">
                        <b>{b.status === 'cancelled' || !b.totalPrice ? '–' : fmtMoney(b.totalPrice, { currency: b.currency || businessCurrency })}</b>
                      </Td>
                    </>
                  ) : (
                    <>
                      {status}
                      {period}
                    </>
                  )}
                  <Td>
                    <div className="acts">
                      <BookingActions booking={b} {...actionProps} />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </Panel>
  );
}
