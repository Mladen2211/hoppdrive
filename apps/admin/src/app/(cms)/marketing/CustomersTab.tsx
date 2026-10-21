'use client';

/**
 * Marketing > Kunden: the customer directory (from bookings and inquiries, one row per e-mail address).
 * Search and filters (berechtigt / Einwilligung / Kunden mit Buchung / abgemeldet), checkbox selection and
 * "Alle berechtigten auswählen". Customers who cannot receive campaigns (unsubscribed, or no consent and no
 * booking yet) are disabled and say why. The selection lives in the page, so it survives tab changes and is
 * used by the campaign form.
 */
import { Check, Search, Send, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { CustomerDto, CustomerFilter, CustomersPageDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Checkbox,
  ChipGroup,
  EmptyState,
  Input,
  MobileCard,
  SkeletonRows,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/ui';
import { LocaleBadge } from '@/components/LocaleBadge';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtDate, fmtNumber } from '@/lib/format';
import { tr } from '@/i18n/active';
import { ineligibleReason } from './shared';

const PAGE_SIZE = 25;
const FILTERS: CustomerFilter[] = ['all', 'eligible', 'consent', 'customers', 'unsubscribed'];

export interface CustomersTabProps {
  canEdit: boolean;
  selection: Set<string>;
  setSelection: Dispatch<SetStateAction<Set<string>>>;
  onCompose: () => void;
}

function CustomerStatus({ customer }: { customer: CustomerDto }) {
  const t = useTranslations();
  if (customer.unsubscribed) return <StatusPill tone="red" label={t('marketing.customers.unsubscribed')} />;
  if (customer.eligible) return <StatusPill tone="green" label={t('marketing.customers.eligible')} />;
  return <StatusPill tone="gray" label={t('marketing.customers.notEligible')} />;
}

export function CustomersTab({ canEdit, selection, setSelection, onCompose }: CustomersTabProps) {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();

  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomersPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getCustomers({ q: query || undefined, filter, page, pageSize: PAGE_SIZE }));
      setError(null);
    } catch (err) {
      setError(errorText(err, tr('marketing.customers.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [query, filter, page]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const items = data?.items ?? [];
  const selectable = items.filter((c) => c.eligible);
  const allOnPage = selectable.length > 0 && selectable.every((c) => selection.has(c.email));
  const someOnPage = selectable.some((c) => selection.has(c.email));

  function toggle(email: string, on: boolean) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (on) next.add(email);
      else next.delete(email);
      return next;
    });
  }

  function togglePage(on: boolean) {
    setSelection((prev) => {
      const next = new Set(prev);
      for (const c of selectable) {
        if (on) next.add(c.email);
        else next.delete(c.email);
      }
      return next;
    });
  }

  /** Every eligible customer (all pages), not just the visible ones. */
  async function selectAllEligible() {
    setSelectingAll(true);
    try {
      const emails: string[] = [];
      for (let p = 1; p <= 40; p += 1) {
        const res = await api.getCustomers({ filter: 'eligible', page: p, pageSize: 500 });
        emails.push(...res.items.map((c) => c.email));
        if (p >= res.totalPages) break;
      }
      setSelection(new Set(emails));
      toast.success(t('marketing.customers.allSelected', { count: emails.length }));
    } catch (err) {
      toast.error(t('marketing.customers.selectAllFailed'), errorText(err));
    } finally {
      setSelectingAll(false);
    }
  }

  const counts = data?.counts;
  const options = FILTERS.map((value) => ({ value, label: t(`marketing.customers.filter.${value}`), count: counts ? fmtNumber(counts[value]) : undefined }));
  const eligibleTotal = counts?.eligible ?? 0;

  const checkbox = (c: CustomerDto) => {
    const reason = ineligibleReason(c);
    return (
      <span title={reason ?? undefined}>
        <Checkbox
          checked={selection.has(c.email)}
          disabled={!c.eligible || !canEdit}
          onChange={(e) => toggle(c.email, e.target.checked)}
          aria-label={reason ? t('marketing.customers.selectDisabled', { name: c.name || c.email, reason }) : t('marketing.customers.select', { name: c.name || c.email })}
          className="!min-h-0"
        />
      </span>
    );
  };

  return (
    <section className="panel overflow-hidden" aria-labelledby="customers-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="customers-h">
            {t('marketing.customers.title')}
          </h2>
          <p className="sm mut mt-0.5">{t('marketing.customers.subtitle')}</p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" loading={selectingAll} disabled={eligibleTotal === 0} onClick={() => void selectAllEligible()} iconLeft={<Check size={16} aria-hidden="true" />}>
            {t('marketing.customers.selectAllEligible', { count: fmtNumber(eligibleTotal) })}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 border-b border-line-soft p-4">
        <ChipGroup aria-label={t('marketing.customers.filterLabel')} options={options} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} scrollable />
        <div className="relative">
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <Input type="search" aria-label={t('marketing.customers.search')} placeholder={t('marketing.customers.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {canEdit && selection.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-ruby-tint px-4 py-3" role="status">
          <b className="text-ruby-fg">{t('marketing.customers.selectedCount', { count: selection.size })}</b>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelection(new Set())}>
              {t('marketing.customers.clearSelection')}
            </Button>
            <Button size="sm" onClick={onCompose} iconLeft={<Send size={16} aria-hidden="true" />}>
              {t('marketing.customers.compose')}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4">
          <Alert tone="err" action={<Button variant="outline" size="sm" onClick={() => void load()}>{t('common.erneutVersuchen')}</Button>}>
            {error}
          </Alert>
        </div>
      )}

      {loading && !error ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('marketing.customers.title')}>
              <TBody>
                <SkeletonTableRows rows={6} columns={6} />
              </TBody>
            </Table>
          </div>
          <div className="p-4 md:hidden">
            <SkeletonRows rows={4} avatar={false} />
          </div>
        </>
      ) : !error && items.length === 0 ? (
        <EmptyState compact tone="neutral" icon={<Users size={32} />} title={t('marketing.customers.emptyTitle')} text={filter !== 'all' || query ? t('marketing.customers.emptyFiltered') : t('marketing.customers.emptyText')} />
      ) : !error ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('marketing.customers.title')}>
              <THead>
                <Tr>
                  <Th className="w-12">
                    {canEdit && (
                      <Checkbox
                        checked={allOnPage}
                        ref={(el) => {
                          if (el) el.indeterminate = !allOnPage && someOnPage;
                        }}
                        disabled={selectable.length === 0}
                        onChange={(e) => togglePage(e.target.checked)}
                        aria-label={t('marketing.customers.selectPage')}
                        className="!min-h-0"
                      />
                    )}
                  </Th>
                  <Th>{t('common.name')}</Th>
                  <Th>{t('common.telefon')}</Th>
                  <Th align="right">{t('common.buchungen')}</Th>
                  <Th>{t('marketing.customers.lastRental')}</Th>
                  <Th>{t('marketing.customers.consent')}</Th>
                  <Th>{t('common.status')}</Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((c) => {
                  const reason = ineligibleReason(c);
                  return (
                    <Tr key={c.email} selected={selection.has(c.email)} className={c.eligible ? undefined : 'text-graphite'}>
                      <Td>{canEdit && checkbox(c)}</Td>
                      <Td>
                        <div className="cell-2">
                          <b className="font-semibold">{c.name || '–'}</b>
                          <span className="break-all">{c.email}</span>
                          <LocaleBadge locale={c.locale} showName={false} className="mt-0.5" />
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{c.phone || '–'}</Td>
                      <Td align="right" className="num">
                        {c.bookingsCount}
                        {c.inquiriesCount > 0 && <span className="sm mut block">{t('marketing.customers.inquiries', { count: c.inquiriesCount })}</span>}
                      </Td>
                      <Td className="num whitespace-nowrap">{c.lastRentalAt ? fmtDate(c.lastRentalAt) : '–'}</Td>
                      <Td>
                        {c.marketingConsent ? (
                          <span className="inline-flex items-center gap-1 text-ok">
                            <Check size={16} aria-hidden="true" />
                            {t('marketing.customers.yes')}
                          </span>
                        ) : (
                          <span className="mut">{t('marketing.customers.no')}</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1">
                          <CustomerStatus customer={c} />
                          {reason && <span className="sm mut">{reason}</span>}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 p-4 md:hidden">
            {canEdit && selectable.length > 0 && (
              <Checkbox
                checked={allOnPage}
                onChange={(e) => togglePage(e.target.checked)}
                label={t('marketing.customers.selectPage')}
              />
            )}
            {items.map((c) => {
              const reason = ineligibleReason(c);
              return (
                <MobileCard key={c.email} title={c.name || c.email} subtitle={c.name ? c.email : undefined} status={<CustomerStatus customer={c} />}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="sm flex flex-col gap-0.5">
                      {c.phone && <span>{c.phone}</span>}
                      <span className="mut">
                        {t('marketing.customers.bookingsLine', { count: c.bookingsCount })}
                        {c.lastRentalAt ? ` · ${t('marketing.customers.lastRentalLine', { date: fmtDate(c.lastRentalAt) })}` : ''}
                      </span>
                      <span className="mut">{c.marketingConsent ? t('marketing.customers.consentYes') : t('marketing.customers.consentNo')}</span>
                      {reason && <span className="font-semibold text-err-strong">{reason}</span>}
                    </div>
                    {canEdit && checkbox(c)}
                  </div>
                </MobileCard>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
            <span className="sm mut" aria-live="polite">
              {t('marketing.customers.count', { count: data?.total ?? 0 })}
            </span>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('common.zurueck')}
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>
                {t('fleet.weiter')}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
