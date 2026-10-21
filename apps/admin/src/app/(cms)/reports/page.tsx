'use client';

import type { ReportSummaryDto } from '@hoppdrive/shared';
import { Download } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  ChipGroup,
  Field,
  Input,
  KpiCard,
  PageHeader,
  Panel,
  Skeleton,
  Tabs,
  deriveInvoiceStatus,
  useMediaQuery,
  useToast,
} from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtDate, fmtMoney, fmtNumber, toInputDate } from '@/lib/format';
import {
  EXPORT_OPTIONS,
  bookingRows,
  exportFilename,
  invoiceRows,
  invoicesInRange,
  revenueRows,
  type ExportKind,
  type InvoiceRow,
} from '@/lib/reports-csv';
import {
  CATEGORY_LABELS,
  PERIOD_TABS,
  PRESETS,
  absoluteDelta,
  chartMonths,
  chartSummary,
  comparisonLabel,
  comparisonYear,
  currentRange,
  daysText,
  futureMonthsNote,
  kpiRange,
  percentDelta,
  pointsText,
  presetRange,
  rangeLabel,
  reportRangeParams,
  seriesNames,
  type BookingReport,
  type Delta,
  type FixedPeriodKind,
  type PeriodKind,
  type PresetKey,
  type Range,
} from '@/lib/reports-model';
import { ChartLegend, RevenueChart } from './RevenueChart';
import { VehicleRevenue, type VehicleRow } from './VehicleRevenue';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

interface LoadedReport {
  /** The range that was asked for (chart, booking list, CSV) */
  range: Range;
  /** The range the KPIs, the vehicle table and the deltas cover (up to today for a running period) */
  kpi: Range & { clamped: boolean };
  summary: ReportSummaryDto;
  chart: ReportSummaryDto;
  report: BookingReport | null;
}

const sameRange = (a: Range, b: Range) => a.from === b.from && a.to === b.to;

function trend(delta: Delta | null) {
  if (!delta) {
    return {
      node: (
        <>
          <span aria-hidden="true">–</span>
          <span className="sr-only">{tr('reports.keinVorjahreswertZumVergleich')}</span>
        </>
      ),
      tone: 'mute' as const,
    };
  }
  return { node: delta.text, tone: delta.tone };
}

export default function ReportsPage() {
  const tt = useTranslations();
  const { token } = useAdminAuth();
  const currency = useCurrency();
  const { toast } = useToast();
  const isTabletUp = useMediaQuery('(min-width: 768px)');

  const [kind, setKind] = useState<PeriodKind>('year');
  const [range, setRange] = useState<Range>(() => currentRange('year'));
  const [exportKinds, setExportKinds] = useState<ExportKind[]>(['bookings']);
  const [exporting, setExporting] = useState(false);

  const [data, setData] = useState<LoadedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportFailed, setReportFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestId = useRef(0);

  const rangeInvalid = range.from > range.to;

  // ── Loading: automatically whenever the period changes ────────

  const load = useCallback(async () => {
    if (!token || !range.from || !range.to || range.from > range.to) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const todayKey = toInputDate(new Date());
    const k = kpiRange(range, todayKey);
    const booking = reportRangeParams(range);
    const [summaryRes, chartRes, reportRes] = await Promise.allSettled([
      api.getReportSummary(k.from, k.to),
      k.clamped ? api.getReportSummary(range.from, range.to) : Promise.resolve(null),
      api.getBookingReport(booking.from, booking.to),
    ]);
    if (id !== requestId.current) return; // a newer period was picked meanwhile

    if (summaryRes.status === 'rejected') {
      setError(errorText(summaryRes.reason, tr('reports.derBerichtKonnteNicht')));
      setLoading(false);
      return;
    }
    const summary = summaryRes.value;
    const chart = chartRes.status === 'fulfilled' && chartRes.value ? chartRes.value : summary;
    setData({
      range: { ...range },
      kpi: k,
      summary,
      chart,
      report: reportRes.status === 'fulfilled' ? (reportRes.value as BookingReport) : null,
    });
    setReportFailed(reportRes.status === 'rejected');
    setExpandedId(null);
    setLoading(false);
  }, [token, range]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Period controls ───────────────────────────────────────────

  const pickKind = (next: PeriodKind) => {
    setKind(next);
    if (next !== 'custom') setRange(currentRange(next as FixedPeriodKind));
  };

  const activePreset = PRESETS.find((p) => sameRange(presetRange(p.key), range))?.key ?? null;
  const pickPreset = (key: PresetKey) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setKind(preset.kind);
    setRange(presetRange(key));
  };

  // ── Derived ───────────────────────────────────────────────────

  const todayKey = toInputDate(new Date());

  const view = useMemo(() => {
    if (!data) return null;
    const { kpi, summary, chart } = data;
    const label = rangeLabel(kpi.from, kpi.to);
    const names = seriesNames(data.range.from, data.range.to);
    const compare = comparisonLabel(kpi.from, kpi.to);
    const compareYear = comparisonYear(kpi.from, kpi.to);
    const months = chartMonths(chart.monthly, todayKey);

    // One row per vehicle: the summary (revenue prorated to the range, utilisation) joined with the booking list.
    const detailById = new Map((data.report?.vehicles ?? []).map((v) => [v.vehicleId, v]));
    const rows: VehicleRow[] = summary.byVehicle
      .filter((v) => v.bookings > 0)
      .map((v) => ({
        id: v.vehicleId,
        name: v.name,
        bookings: v.bookings,
        days: v.days,
        utilization: v.utilizationPercent,
        revenue: v.revenue,
        detail: detailById.get(v.vehicleId),
      }));
    // Vehicles that only the booking list knows (e.g. no longer in the fleet) must not disappear.
    const known = new Set(summary.byVehicle.map((v) => v.vehicleId));
    (data.report?.vehicles ?? []).forEach((v) => {
      if (!known.has(v.vehicleId)) {
        rows.push({ id: v.vehicleId, name: `${v.brand} ${v.model}`, bookings: v.bookings.length, days: v.totalDays, utilization: null, revenue: v.totalEarnings, detail: v });
      }
    });

    return {
      label,
      compare,
      compareYear,
      names,
      months,
      rows,
      total: {
        bookings: rows.reduce((s, r) => s + r.bookings, 0),
        days: rows.reduce((s, r) => s + r.days, 0),
        revenue: rows.reduce((s, r) => s + r.revenue, 0),
      },
      note: futureMonthsNote(months),
      summaryText: chartSummary(months, names),
      deltas: {
        revenue: percentDelta(summary.revenue, summary.previous.revenue, compare),
        bookings: percentDelta(summary.bookings, summary.previous.bookings, compare),
        duration: absoluteDelta(summary.avgDurationDays, summary.previous.avgDurationDays, daysText),
        utilization: absoluteDelta(summary.utilizationPercent, summary.previous.utilizationPercent, pointsText),
      },
    };
  }, [data, todayKey]);

  // ── Export ────────────────────────────────────────────────────

  const canExport = Boolean(data) && exportKinds.length > 0 && !exporting && !rangeInvalid;

  async function exportCsv() {
    if (!data || exporting || exportKinds.length === 0) return;
    setExporting(true);
    const names: string[] = [];
    try {
      for (const choice of EXPORT_OPTIONS.map((o) => o.value).filter((v) => exportKinds.includes(v))) {
        if (choice === 'bookings') {
          if (!data.report) throw new Error(tr('reports.dieBuchungsdatenKonntenNicht'));
          if (data.report.vehicles.length === 0) {
            toast.info(tr('reports.keineBuchungenImGewaehlten'), tr('reports.dieBuchungsCSVWurde'));
            continue;
          }
          downloadCsv(bookingRows(data.report, currency), exportFilename('bookings', data.range));
          names.push(tr('common.buchungen'));
        } else if (choice === 'invoices') {
          const all = (await api.getInvoices()) as (InvoiceRow & { issueDate: string })[];
          const rows = invoicesInRange(all, data.range);
          downloadCsv(invoiceRows(rows, (inv) => Boolean(inv.isOverdue) || deriveInvoiceStatus(inv) === 'OVERDUE', currency), exportFilename('invoices', data.range));
          names.push(tr('common.rechnungen'));
        } else {
          downloadCsv(revenueRows(data.chart.monthly, currency), exportFilename('revenue', data.range));
          names.push(tr('common.umsatz'));
        }
      }
      if (names.length > 0) toast.success(names.length === 1 ? tr('common.cSVExportiert') : tr('reports.cSVDateienExportiert', { length: names.length }), names.join(', '));
    } catch (err) {
      toast.error(tr('common.exportFehlgeschlagen'), errorText(err));
    } finally {
      setExporting(false);
    }
  }

  const exportButton = (className?: string) => (
    <Button variant="outline" className={className} iconLeft={<Download size={18} aria-hidden="true" />} disabled={!canExport} loading={exporting} onClick={() => void exportCsv()}>
      {tt('reports.cSVExportieren')}
    </Button>
  );

  // ── Render ────────────────────────────────────────────────────

  const showSkeleton = loading && !data;
  const busy = loading && Boolean(data);

  const presetBar = (
    <ChipGroup
      aria-label={tt('reports.schnellauswahl')}
      scrollable
      options={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
      value={(activePreset ?? '') as PresetKey}
      onChange={pickPreset}
      className="-mx-4 px-4 md:mx-0 md:px-0"
    />
  );

  const periodTabs = <Tabs aria-label={tt('common.zeitraum')} tabs={PERIOD_TABS} value={kind} onChange={(id) => pickKind(id as PeriodKind)} />;

  const kpis =
    showSkeleton || !data || !view ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[138px]" rounded={16} />
        ))}
      </div>
    ) : (
      <section aria-label={tt('reports.kennzahlen', { label: view.label })} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(() => {
          const t1 = trend(view.deltas.revenue);
          const t2 = trend(view.deltas.bookings);
          const t3 = trend(view.deltas.duration);
          const t4 = trend(view.deltas.utilization);
          return (
            <>
              <KpiCard label={tt('reports.umsatz', { label: view.label })} value={fmtMoney(data.summary.revenue, { currency, decimals: 0 })} trend={t1.node} trendTone={t1.tone} />
              <KpiCard label={tt('common.buchungen')} value={fmtNumber(data.summary.bookings)} trend={t2.node} trendTone={t2.tone} />
              <KpiCard label={tt('reports.mietdauer')} value={data.summary.bookings > 0 ? daysText(data.summary.avgDurationDays) : '–'} trend={t3.node} trendTone={t3.tone} />
              <KpiCard label={tt('reports.auslastung')} value={`${Math.round(data.summary.utilizationPercent)} %`} trend={t4.node} trendTone={t4.tone} />
            </>
          );
        })()}
      </section>
    );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="max-md:hidden">
        <PageHeader
          title={tt('reports.berichte')}
          subtitle={tt('reports.umsatzUndAuslastungMit')}
          tabs={periodTabs}
          tabsInline
          actions={exportButton()}
        />
      </div>
      <h1 className="sr-only md:hidden">{tt('reports.berichte')}</h1>

      {!isTabletUp && (
        <ChipGroup
          aria-label={tt('common.zeitraum')}
          scrollable
          options={PERIOD_TABS.map((t) => ({ value: t.id, label: t.label }))}
          value={kind}
          onChange={pickKind}
          className="-mx-4 px-4"
        />
      )}

      <div className="flex flex-col gap-3">
        {presetBar}
        {kind === 'custom' && (
          <div className="grid max-w-[480px] grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <Field label={tt('common.von')} required>
              <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            </Field>
            <Field label={tt('common.bis')} required error={rangeInvalid ? tt('reports.dasEnddatumLiegtVor') : undefined}>
              <Input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </Field>
          </div>
        )}
      </div>

      {error && (
        <Alert
          tone="err"
          title={tt('reports.berichtKonnteNichtGeladen')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {tt('common.erneutVersuchen')}
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className={busy ? 'pointer-events-none flex flex-col gap-5 opacity-60 transition-opacity motion-reduce:transition-none md:gap-6' : 'flex flex-col gap-5 md:gap-6'} aria-busy={loading || undefined}>
        {kpis}

        {view && data?.kpi.clamped && (
          <p className="hint -mt-2">{tt('reports.clampedHint', { date: fmtDate(todayKey), year: view.compareYear ?? 'none' })}</p>
        )}

        <div className="grid items-start gap-5 md:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel aria-labelledby="chart-heading">
            <div className="panel-h">
              <h2 className="h2" id="chart-heading">
                {tt('reports.umsatzProMonat')}
              </h2>
              {view && <ChartLegend names={view.names} />}
            </div>
            <div className="panel-b">
              {showSkeleton || !view ? (
                <Skeleton className="h-[300px]" rounded={12} />
              ) : (
                <>
                  <RevenueChart months={view.months} names={view.names} summary={view.summaryText} />
                  {view.note && <p className="hint mt-3.5">{view.note}</p>}
                </>
              )}
            </div>
          </Panel>

          <Panel aria-labelledby="category-heading">
            <div className="panel-h">
              <h2 className="h2" id="category-heading">
                {tt('reports.umsatzNachKategorie')}
              </h2>
            </div>
            {showSkeleton || !data ? (
              <div className="panel-b flex flex-col gap-[18px]">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : data.summary.byCategory.length === 0 ? (
              <p className="mut panel-b">{tt('reports.imGewaehltenZeitraumGibt')}</p>
            ) : (
              <ul className="panel-b flex flex-col gap-[18px]">
                {data.summary.byCategory.map((c) => {
                  const label = CATEGORY_LABELS[c.type] ?? c.type;
                  return (
                    <li key={c.type}>
                      <div className="mb-1.5 flex justify-between gap-3">
                        <b className="font-semibold">{label}</b>
                        <span className="num whitespace-nowrap">
                          <b>{fmtMoney(c.revenue, { currency, decimals: 0 })}</b> <span className="mut">{Math.round(c.share)} %</span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-line-soft" role="img" aria-label={tt('reports.desUmsatzes', { label, round: Math.round(c.share) })}>
                        <div className="h-full rounded-full bg-ruby" style={{ width: `${Math.max(0, Math.min(100, c.share))}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-line-soft p-5">
              <div className="lbl mb-2" id="export-label">
                {tt('reports.export')}
              </div>
              <ChipGroup<ExportKind>
                multiple
                aria-label={tt('reports.exportInhalteDerCSV')}
                options={EXPORT_OPTIONS}
                value={exportKinds}
                onChange={setExportKinds}
              />
              <p className="hint mt-2">{tt('reports.dieCSVEnthaeltDen')}</p>
              <div className="mt-3 md:hidden">{exportButton('w-full')}</div>
            </div>
          </Panel>
        </div>

        <Panel aria-labelledby="vehicles-heading" className="overflow-hidden">
          <div className="panel-h">
            <h2 className="h2" id="vehicles-heading">
              {tt('reports.fahrzeugeNachUmsatz')}
            </h2>
            {view && data && <span className="sm mut">{rangeLabel(data.kpi.from, data.kpi.to, { year: true })}</span>}
          </div>
          {showSkeleton || !view ? (
            <div className="p-5">
              <Skeleton className="h-40" rounded={12} />
            </div>
          ) : (
            <VehicleRevenue
              rows={view.rows}
              total={view.total}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              detailsLoading={false}
              detailsFailed={reportFailed}
              onRetryDetails={() => void load()}
              isTabletUp={isTabletUp}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
