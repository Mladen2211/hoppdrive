'use client';

/**
 * "Fahrzeuge nach Umsatz": per vehicle bookings, rented days, utilisation and revenue. A row opens the
 * per-vehicle booking list of the old report (Kunde, Zeitraum, Tage, Preis, Status, Zwischensumme).
 * Table from 768 px, cards below.
 */
import { BarChart3, ChevronDown } from 'lucide-react';
import { Fragment } from 'react';
import { Alert, Button, EmptyState, MobileCard, Skeleton, StatusPill, cn } from '@/components/ui';
import { useCurrency } from '@/hooks/useCurrency';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';
import type { VehicleReport } from '@/lib/reports-model';
import { useTranslations } from 'next-intl';

export interface VehicleRow {
  id: string;
  name: string;
  bookings: number;
  days: number;
  /** null when the summary does not know the vehicle */
  utilization: number | null;
  revenue: number;
  detail?: VehicleReport;
}

export interface VehicleRevenueProps {
  rows: VehicleRow[];
  total: { bookings: number; days: number; revenue: number };
  expandedId: string | null;
  onToggle: (id: string) => void;
  /** Booking list state: the report request can fail separately from the summary. */
  detailsLoading: boolean;
  detailsFailed: boolean;
  onRetryDetails: () => void;
  isTabletUp: boolean;
}

function UtilBar({ value, label }: { value: number | null; label: string }) {
  const t = useTranslations();
  if (value === null) return <span className="mut">–</span>;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-line-soft" role="img" aria-label={t('reports.auslastung2', { label, round: Math.round(pct) })}>
        <div className="h-full rounded-full bg-ruby" style={{ width: `${pct}%` }} />
      </div>
      <span className="num w-[42px] text-right">{Math.round(pct)} %</span>
    </div>
  );
}

function Details({
  row,
  loading,
  failed,
  onRetry,
  compact,
}: {
  row: VehicleRow;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  compact?: boolean;
}) {
  const t = useTranslations();
  const currency = useCurrency();
  if (loading) return <Skeleton className="m-4 h-16" />;
  if (failed) {
    return (
      <div className="p-4">
        <Alert
          tone="err"
          title={t('reports.buchungenKonntenNichtGeladen')}
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        />
      </div>
    );
  }
  const detail = row.detail;
  if (!detail || detail.bookings.length === 0) return <p className="mut p-4">{t('reports.keineBuchungenFuerDieses')}</p>;
  const differs = Math.abs(detail.totalEarnings - row.revenue) > 0.01;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
        {detail.bookings.map((b) => (
          <div key={b.id} className="flex flex-col gap-1 rounded-10 bg-row p-3">
            <div className="flex items-start justify-between gap-2">
              <b className="min-w-0 break-words font-semibold">{b.customerName}</b>
              <StatusPill kind="booking" status={b.status} />
            </div>
            <div className="sm mut num">
              {fmtDate(b.startDate)} – {fmtDate(b.endDate)} · {b.days} {t('reports.tagN', { count: Number(b.days) })}
            </div>
            <b className="num">{fmtMoney(b.totalPrice, { currency })}</b>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-2 px-1 pt-1 font-semibold">
          <span>{t('reports.zwischensumme')}</span>
          <span className="num">{t('reports.tage', { totalDays: detail.totalDays, cHF: fmtMoney(detail.totalEarnings, { currency }) })}</span>
        </div>
        {differs && <p className="hint px-1">{t('reports.volleBuchungsbetraegeDerUmsatz')}</p>}
      </div>
    );
  }

  return (
    <div className="bg-row px-5 pb-4 pt-1">
      <table className="tbl !bg-transparent">
        <thead>
          <tr>
            <th scope="col">{t('common.kunde')}</th>
            <th scope="col">{t('common.zeitraum')}</th>
            <th scope="col" className="r">
              {t('common.tage')}
            </th>
            <th scope="col" className="r">
              {t('reports.preis')}
            </th>
            <th scope="col">{t('common.status')}</th>
          </tr>
        </thead>
        <tbody>
          {detail.bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.customerName}</td>
              <td className="num whitespace-nowrap">
                {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
              </td>
              <td className="r num">{b.days}</td>
              <td className="r num whitespace-nowrap">
                <b>{fmtMoney(b.totalPrice, { currency })}</b>
              </td>
              <td>
                <StatusPill kind="booking" status={b.status} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={2} className="border-b-0">
              {t('reports.zwischensumme')}
            </td>
            <td className="r num border-b-0">{detail.totalDays}</td>
            <td className="r num whitespace-nowrap border-b-0">{fmtMoney(detail.totalEarnings, { currency })}</td>
            <td className="border-b-0" />
          </tr>
        </tfoot>
      </table>
      {differs && <p className="hint mt-1">{t('reports.volleBuchungsbetraegeDerUmsatz2')}</p>}
    </div>
  );
}

export function VehicleRevenue({ rows, total, expandedId, onToggle, detailsLoading, detailsFailed, onRetryDetails, isTabletUp }: VehicleRevenueProps) {
  const tt = useTranslations();
  const t = useTranslations();
  const currency = useCurrency();
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        tone="neutral"
        icon={<BarChart3 size={32} />}
        title={t('reports.keineBuchungenImGewaehlten2')}
        text={t('reports.waehlenSieEinenAnderen')}
      />
    );
  }

  if (!isTabletUp) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {rows.map((row) => {
          const open = expandedId === row.id;
          return (
            <MobileCard
              key={row.id}
              title={row.name}
              subtitle={`${row.bookings} ${t('reports.buchungN', { count: Number(row.bookings) })} · ${fmtNumber(row.days)} ${t('reports.tagN', { count: Number(row.days) })}`}
              status={<b className="num text-base">{fmtMoney(row.revenue, { currency, decimals: 0 })}</b>}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-0 flex-1"
                  aria-expanded={open}
                  iconRight={<ChevronDown size={16} aria-hidden="true" className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-180')} />}
                  onClick={() => onToggle(row.id)}
                >
                  {open ? tt('reports.buchungenAusblenden') : tt('reports.buchungenAnzeigen')}
                </Button>
              }
            >
              <UtilBar value={row.utilization} label={row.name} />
              {open && <Details row={row} loading={detailsLoading} failed={detailsFailed} onRetry={onRetryDetails} compact />}
            </MobileCard>
          );
        })}
        <div className="flex items-baseline justify-between gap-3 rounded-14 bg-inverse p-4 text-on-inverse">
          <div>
            <b className="block text-lg">{t('reports.gesamt')}</b>
            <span className="sm opacity-80">{t('reports.buchungenTage', { bookings: total.bookings, number: fmtNumber(total.days) })}</span>
          </div>
          <b className="num text-2xl">{fmtMoney(total.revenue, { currency, decimals: 0 })}</b>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="tbl" aria-label={t('reports.fahrzeugeNachUmsatz')}>
        <thead>
          <tr>
            <th scope="col">{t('common.fahrzeug')}</th>
            <th scope="col" className="r">
              {t('common.buchungen')}
            </th>
            <th scope="col" className="r">
              {t('reports.miettage')}
            </th>
            <th scope="col" className="w-[260px]">
              {t('reports.auslastung')}
            </th>
            <th scope="col" className="r">
              {t('common.umsatz')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = expandedId === row.id;
            const detailId = `vehicle-detail-${row.id}`;
            return (
              <Fragment key={row.id}>
                <tr className={cn('cursor-pointer', open && 'sel')} onClick={() => onToggle(row.id)}>
                  <td>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailId}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(row.id);
                      }}
                      className="flex min-h-[44px] items-center gap-2 text-left font-semibold"
                    >
                      <ChevronDown size={18} aria-hidden="true" className={cn('flex-none text-graphite transition-transform motion-reduce:transition-none', !open && '-rotate-90')} />
                      {row.name}
                    </button>
                  </td>
                  <td className="r num">{row.bookings}</td>
                  <td className="r num">{fmtNumber(row.days)}</td>
                  <td>
                    <UtilBar value={row.utilization} label={row.name} />
                  </td>
                  <td className="r num whitespace-nowrap text-base">
                    <b>{fmtMoney(row.revenue, { currency, decimals: 0 })}</b>
                  </td>
                </tr>
                {open && (
                  <tr id={detailId}>
                    <td colSpan={5} className="!p-0">
                      <Details row={row} loading={detailsLoading} failed={detailsFailed} onRetry={onRetryDetails} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-inverse text-on-inverse [&>td]:border-b-0">
            <td className="font-bold">{t('reports.gesamt')}</td>
            <td className="r num font-semibold">{total.bookings}</td>
            <td className="r num font-semibold">{fmtNumber(total.days)}</td>
            <td />
            <td className="r num whitespace-nowrap text-lg font-bold">{fmtMoney(total.revenue, { currency, decimals: 0 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
