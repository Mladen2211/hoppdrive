'use client';

/**
 * Bussen (permission area "fines"): who had the car when a fine happened, the list of recorded fines
 * and the workflow around one (assign -> driver data for the authority -> notify the renter -> invoice).
 * Deep link: /fines?id=<fineId> opens the detail drawer.
 */
import { Gavel, Plus, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { FineDto, FineStatus, FinesPageDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Cell2,
  ChipGroup,
  DrawerLayout,
  EmptyState,
  Input,
  MobileCard,
  PageHeader,
  SkeletonRows,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useMediaQuery,
  useToast,
} from '@/components/ui';
import { FineStatusPill } from '@/components/fines/FineStatusPill';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtNumber, fmtMoney } from '@/lib/format';
import { FINE_STATUSES, fmtFineTime } from '@/lib/fine-model';
import { formatPlate } from '@/lib/plate';
import { tr } from '@/i18n/active';
import { FineDrawer } from './FineDrawer';
import { FineModal, type FineSaveResult } from './FineModal';
import { LookupCard, type FinePrefill } from './LookupCard';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | FineStatus;
type ModalState = { kind: 'create'; prefill: FinePrefill | null } | { kind: 'edit'; fine: FineDto } | null;

export default function FinesPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <FinesView />
    </Suspense>
  );
}

function FinesView() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = useCan('fines', 'edit');
  const currency = useCurrency();
  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const selectedId = searchParams.get('id');

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FinesPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [drawerRefresh, setDrawerRefresh] = useState(0);
  const dataRef = useRef<FinesPageDto | null>(null);
  dataRef.current = data;

  // Debounced search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await api.getFines({ status: filter === 'all' ? undefined : filter, q: query || undefined, page, pageSize: PAGE_SIZE });
        setData(res);
        setLoadError(null);
      } catch (err) {
        if (!silent) setLoadError(errorText(err, tr('fines.listFailed')));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, filter, query, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const select = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const handleUpdated = useCallback(
    (fine: FineDto) => {
      const existing = dataRef.current?.items.find((i) => i.id === fine.id);
      setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === fine.id ? fine : i)) } : d));
      // Counts (and the filtered list) change with the status: refresh quietly.
      if (existing && existing.status !== fine.status) void load(true);
    },
    [load],
  );

  const handleSaved = useCallback(
    ({ fine, created, assigned }: FineSaveResult) => {
      setModal(null);
      const name = fine.reference || formatPlate(fine.licensePlate);
      if (!created) toast.success(tr('fines.saved'), name);
      else if (assigned === false) toast.error(tr('fines.createdNotAssigned'), tr('fines.createdNotAssignedText', { name }));
      else toast.success(tr('fines.created'), assigned ? tr('fines.createdAssigned', { name, renter: fine.booking?.customerName ?? '' }) : name);
      void load(true);
      if (created) select(fine.id);
      else {
        handleUpdated(fine);
        setDrawerRefresh((n) => n + 1);
      }
    },
    [toast, load, select, handleUpdated],
  );

  const total = data ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : 0;
  const options: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: t('common.alle'), count: data ? total : undefined },
    ...FINE_STATUSES.map((status) => ({ value: status as StatusFilter, label: t(`fines.status.${status}`), count: data?.statusCounts[status] })),
  ];

  const items = data?.items ?? [];
  const drawerInline = Boolean(selectedId) && isDesktop;
  const selectedCached = items.find((f) => f.id === selectedId) ?? null;
  const rangeFrom = !data || data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const rangeTo = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const filtered = filter !== 'all' || query !== '';

  const addButton = canEdit ? (
    <Button iconLeft={<Plus size={18} aria-hidden="true" />} onClick={() => setModal({ kind: 'create', prefill: null })}>
      {t('fines.add')}
    </Button>
  ) : undefined;

  const renterOf = (f: FineDto) => (f.booking ? f.booking.customerName : null);

  const listView = loading ? (
    isTabletUp ? (
      <Table aria-label={t('fines.listTitle')}>
        <TBody>
          <SkeletonTableRows rows={5} columns={5} />
        </TBody>
      </Table>
    ) : (
      <SkeletonRows rows={3} />
    )
  ) : loadError ? (
    <div className="p-4">
      <Alert
        tone="err"
        action={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t('common.erneutVersuchen')}
          </Button>
        }
      >
        {loadError}
      </Alert>
    </div>
  ) : items.length === 0 ? (
    <EmptyState
      compact
      tone="neutral"
      icon={<Gavel size={32} />}
      title={filtered ? t('fines.emptyFilteredTitle') : t('fines.emptyTitle')}
      text={filtered ? t('fines.emptyFiltered') : t('fines.emptyText')}
      actions={
        filtered ? (
          <Button
            variant="ghost"
            onClick={() => {
              setFilter('all');
              setSearch('');
            }}
          >
            {t('contracts.filterZuruecksetzen')}
          </Button>
        ) : (
          addButton
        )
      }
    />
  ) : isTabletUp ? (
    <Table aria-label={t('fines.listTitle')} className={drawerInline ? '[&_td]:px-3 [&_th]:px-3' : undefined}>
      <THead>
        <Tr>
          <Th>{t('fines.colFine')}</Th>
          <Th>{t('fines.colWhen')}</Th>
          {!drawerInline && <Th>{t('fines.colRenter')}</Th>}
          <Th align="right">{t('fines.amount')}</Th>
          <Th>{t('common.status')}</Th>
        </Tr>
      </THead>
      <TBody>
        {items.map((f) => (
          <Tr key={f.id} selected={f.id === selectedId} onClick={() => select(f.id)}>
            <Td>
              <Cell2
                primary={
                  <button
                    type="button"
                    className="num text-left font-semibold hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      select(f.id);
                    }}
                  >
                    {formatPlate(f.licensePlate)}
                  </button>
                }
                secondary={[f.reference, f.authority].filter(Boolean).join(' · ') || undefined}
              />
            </Td>
            <Td>
              <Cell2 primary={<span className="num">{fmtFineTime(f.occurredAt)}</span>} secondary={f.place || undefined} />
            </Td>
            {!drawerInline && <Td>{renterOf(f) ?? <span className="mut">{t('fines.notAssignedShort')}</span>}</Td>}
            <Td align="right" className="num whitespace-nowrap">
              <b>{fmtMoney(f.amount, { currency: f.currency })}</b>
            </Td>
            <Td>
              <FineStatusPill status={f.status} />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  ) : (
    <div className="flex flex-col gap-3 p-4">
      {items.map((f) => (
        <MobileCard
          key={f.id}
          title={<span className="num text-base">{formatPlate(f.licensePlate)}</span>}
          subtitle={[f.reference, f.authority].filter(Boolean).join(' · ') || undefined}
          status={<FineStatusPill status={f.status} />}
          onOpen={() => select(f.id)}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="sm mut num">{fmtFineTime(f.occurredAt)}</span>
            <b className="num text-lg">{fmtMoney(f.amount, { currency: f.currency })}</b>
          </div>
          <div className="sm">{renterOf(f) ?? <span className="mut">{t('fines.notAssignedShort')}</span>}</div>
        </MobileCard>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DrawerLayout className="lg:-m-8">
        <div className="flex min-w-0 flex-col gap-5 md:gap-6 lg:p-8">
          <div className="max-md:hidden">
            <PageHeader title={t('fines.title')} subtitle={t('fines.subtitle')} actions={addButton} />
          </div>
          <h1 className="sr-only md:hidden">{t('fines.title')}</h1>
          {!isTabletUp && addButton && <div className="[&>button]:w-full">{addButton}</div>}

          <LookupCard canEdit={canEdit} onRecord={(prefill) => setModal({ kind: 'create', prefill })} />

          <section className="panel overflow-hidden" aria-labelledby="fines-list-h">
            <div className="panel-h">
              <h2 className="h2" id="fines-list-h">
                {t('fines.listTitle')}
              </h2>
            </div>
            <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-3 max-md:px-4">
              <ChipGroup
                aria-label={t('fines.filterStatus')}
                scrollable
                options={options}
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setPage(1);
                }}
              />
              <div className="relative max-w-[360px] max-md:max-w-none">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
                <Input type="search" aria-label={t('fines.search')} placeholder={t('fines.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            {listView}
            {data && data.total > 0 && !loading && !loadError && (
              <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3 max-md:px-4">
                <span className="sm mut" aria-live="polite">
                  {t('emailLog.range', { from: rangeFrom, to: rangeTo, total: fmtNumber(data.total) })}
                </span>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {t('common.zurueck')}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                    {t('fleet.weiter')}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        {selectedId && (
          <FineDrawer
            key={selectedId}
            id={selectedId}
            cached={selectedCached}
            refreshKey={drawerRefresh}
            canEdit={canEdit}
            onClose={() => select(null)}
            onUpdated={handleUpdated}
            onDeleted={() => {
              select(null);
              void load(true);
            }}
            onEdit={(fine) => setModal({ kind: 'edit', fine })}
          />
        )}
      </DrawerLayout>

      {modal && (
        <FineModal
          fine={modal.kind === 'edit' ? modal.fine : null}
          prefill={modal.kind === 'create' ? modal.prefill : null}
          currency={currency}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
