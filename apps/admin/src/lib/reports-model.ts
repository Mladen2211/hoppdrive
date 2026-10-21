/**
 * Pure helpers for the Berichte page: periods and presets, year-over-year deltas, labels and the
 * axis scale of the monthly chart.
 *
 * All dates are LOCAL 'YYYY-MM-DD' (toInputDate). The old presets used `toISOString()`, which put the
 * first day of a month one day early (local midnight is the previous day in UTC for Switzerland).
 */
import { fmtDate, fmtDateShort, fmtNumber, monthName, monthShort, parseDate, toInputDate } from '@/lib/format';
import { activeLocale, tr } from '@/i18n/active';
import { INTL_LOCALE } from '@/i18n/config';

// ─── Periods ────────────────────────────────────────────────────

export type PeriodKind = 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type FixedPeriodKind = Exclude<PeriodKind, 'custom'>;

export interface Range {
  from: string;
  to: string;
}

export const PERIOD_TABS: { id: PeriodKind; label: string }[] = [
  { id: 'week', get label() { return tr('reportsModel.woche'); } },
  { id: 'month', get label() { return tr('reportsModel.monat'); } },
  { id: 'quarter', get label() { return tr('reportsModel.quartal'); } },
  { id: 'year', get label() { return tr('reportsModel.jahr'); } },
  { id: 'custom', get label() { return tr('reportsModel.eigenerZeitraum'); } },
];

export type PresetKey = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear';

/** The five quick ranges of the old report page. */
export const PRESETS: { key: PresetKey; label: string; kind: FixedPeriodKind }[] = [
  { key: 'thisMonth', get label() { return tr('reportsModel.dieserMonat'); }, kind: 'month' },
  { key: 'lastMonth', get label() { return tr('reportsModel.letzterMonat'); }, kind: 'month' },
  { key: 'thisQuarter', get label() { return tr('reportsModel.diesesQuartal'); }, kind: 'quarter' },
  { key: 'thisYear', get label() { return tr('reportsModel.diesesJahr'); }, kind: 'year' },
  { key: 'lastYear', get label() { return tr('reportsModel.letztesJahr'); }, kind: 'year' },
];

const range = (from: Date, to: Date): Range => ({ from: toInputDate(from), to: toInputDate(to) });

/** The current week (Mon-Sun), month, quarter or year. */
export function currentRange(kind: FixedPeriodKind, now: Date = new Date()): Range {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (kind) {
    case 'week': {
      const offset = (now.getDay() + 6) % 7;
      return range(new Date(y, m, now.getDate() - offset), new Date(y, m, now.getDate() - offset + 6));
    }
    case 'month':
      return range(new Date(y, m, 1), new Date(y, m + 1, 0));
    case 'quarter': {
      const q = Math.floor(m / 3) * 3;
      return range(new Date(y, q, 1), new Date(y, q + 3, 0));
    }
    case 'year':
      return range(new Date(y, 0, 1), new Date(y, 11, 31));
  }
}

export function presetRange(key: PresetKey, now: Date = new Date()): Range {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'thisMonth':
      return currentRange('month', now);
    case 'lastMonth':
      return range(new Date(y, m - 1, 1), new Date(y, m, 0));
    case 'thisQuarter':
      return currentRange('quarter', now);
    case 'thisYear':
      return currentRange('year', now);
    case 'lastYear':
      return range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
  }
}

/**
 * Comparing a running period with the full period of the previous year would always look like a
 * drop, so the KPIs, the vehicle table and the year-over-year deltas use the range up to today.
 */
export function kpiRange(r: Range, todayKey: string): Range & { clamped: boolean } {
  if (r.from <= todayKey && r.to > todayKey) return { from: r.from, to: todayKey, clamped: true };
  return { ...r, clamped: false };
}

// ─── Labels ─────────────────────────────────────────────────────

/**
 * 'Jan–Nov' (months), 'Oktober', 'Q4', or '12.10.–18.10.' for anything else; with `year`: 'Jan–Nov 2026'.
 */
export function rangeLabel(from: string, to: string, options: { year?: boolean } = {}): string {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return '';
  const y = options.year ? ` ${a.getFullYear()}` : '';
  if (from === to) return fmtDate(a);
  const sameYear = a.getFullYear() === b.getFullYear();
  const lastDayOfMonth = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
  if (sameYear && a.getDate() === 1) {
    if (a.getMonth() === 0 && b.getMonth() === 11 && b.getDate() === 31) return options.year ? `${a.getFullYear()}` : tr('reportsModel.jahr');
    if (a.getMonth() === b.getMonth()) return `${monthName(a.getMonth())}${y}`;
    if (a.getMonth() % 3 === 0 && b.getMonth() === a.getMonth() + 2 && b.getDate() === lastDayOfMonth) return `Q${a.getMonth() / 3 + 1}${y}`;
    return `${monthShort(a.getMonth())}–${monthShort(b.getMonth())}${y}`;
  }
  return sameYear ? `${fmtDateShort(a)}–${fmtDate(b)}` : `${fmtDate(a)}–${fmtDate(b)}`;
}

/** 'zu 2025' for a range inside one year, else 'zum Vorjahr'. */
export function comparisonLabel(from: string, to: string): string {
  const a = parseDate(from);
  const b = parseDate(to);
  if (a && b && a.getFullYear() === b.getFullYear()) return tr('reports.comparedToYear', { year: a.getFullYear() - 1 });
  return tr('reportsModel.zumVorjahr');
}

/** The year the previous period lies in when the range is inside one year, else null ('zum Vorjahr'). */
export function comparisonYear(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  return a && b && a.getFullYear() === b.getFullYear() ? a.getFullYear() - 1 : null;
}

/** Legend names: '2026' / '2025', or generic ones when the range crosses a year boundary. */
export function seriesNames(from: string, to: string): { current: string; previous: string } {
  const a = parseDate(from);
  const b = parseDate(to);
  if (a && b && a.getFullYear() === b.getFullYear()) return { current: String(a.getFullYear()), previous: String(a.getFullYear() - 1) };
  return { current: tr('reportsModel.zeitraum'), previous: tr('reportsModel.vorjahr') };
}

/**
 * 'Dezember steht noch aus.' / 'November und Dezember stehen noch aus.': months of the chart that have not
 * begun. Reservations can already carry revenue there; the note then says that only booked revenue is shown.
 */
export function futureMonthsNote(months: { key: string; future: boolean; revenue: number }[]): string | null {
  const future = months.filter((m) => m.future);
  if (future.length === 0) return null;
  const names = future.map((m) => monthName(Number(m.key.slice(5, 7)) - 1));
  const list = new Intl.ListFormat(INTL_LOCALE[activeLocale()], { style: 'long', type: 'conjunction' }).format(names);
  const base = tr('reports.futureMonths', { list, count: names.length });
  return future.some((m) => m.revenue > 0) ? `${base} ${tr('reports.bookedRevenueOnly')}` : base;
}

// ─── Deltas ─────────────────────────────────────────────────────

export interface Delta {
  text: string;
  tone: 'ok' | 'err' | 'mute';
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const num1 = (n: number) => String(round1(n));
const signOf = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const toneOf = (n: number): Delta['tone'] => (n > 0 ? 'ok' : n < 0 ? 'err' : 'mute');

/** '+24 % zu 2025'; null when there is no previous value to compare with. */
export function percentDelta(current: number, previous: number, suffix: string): Delta | null {
  if (!(previous > 0)) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${signOf(pct)}${Math.abs(pct)} % ${suffix}`, tone: toneOf(pct) };
}

/** '+1.4 Tage' / '+6 Prozentpunkte'; null when the previous value is 0. */
export function absoluteDelta(current: number, previous: number, unit: (n: number) => string): Delta | null {
  if (!(previous > 0)) return null;
  const diff = round1(current - previous);
  return { text: `${signOf(diff)}${unit(Math.abs(diff))}`, tone: toneOf(diff) };
}

export const daysText = (n: number) => tr('reports.daysDecimal', { count: round1(n) });
export const pointsText = (n: number) => tr('reports.percentagePoints', { count: round1(n) });

// ─── Chart ──────────────────────────────────────────────────────

export interface AxisScale {
  top: number;
  step: number;
  ticks: number[];
}

/** Axis with 4-5 steps of 1, 2, 2.5, 5 x 10^n (CHF 16'200 -> 0 to 20'000 in steps of 5'000). */
export function niceScale(max: number): AxisScale {
  if (!(max > 0)) return { top: 1000, step: 250, ticks: [0, 250, 500, 750, 1000] };
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * pow);
  const step = candidates.find((c) => Math.ceil(max / c) <= 5) ?? candidates[candidates.length - 1];
  let top = Math.ceil(max / step) * step;
  if (top - max < step * 0.05) top += step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, step, ticks };
}

export interface ChartMonth {
  key: string;
  /** 'Jan' (or 'Jan 27' when the range spans years) */
  label: string;
  /** 'Januar 2026' */
  fullLabel: string;
  revenue: number;
  previous: number;
  future: boolean;
}

export function chartMonths(monthly: { month: string; revenue: number; prevRevenue: number }[], todayKey: string): ChartMonth[] {
  const years = new Set(monthly.map((m) => m.month.slice(0, 4)));
  const thisMonth = todayKey.slice(0, 7);
  return monthly.map((m) => {
    const index = Number(m.month.slice(5, 7)) - 1;
    const yy = m.month.slice(2, 4);
    return {
      key: m.month,
      label: years.size > 1 ? `${monthShort(index)} ${yy}` : monthShort(index),
      fullLabel: `${monthName(index)} ${m.month.slice(0, 4)}`,
      revenue: m.revenue,
      previous: m.prevRevenue,
      future: m.month > thisMonth,
    };
  });
}

/** 'Umsatz pro Monat 2026 im Vergleich zu 2025. Höchster Monat: …' for screen readers. */
export function chartSummary(months: ChartMonth[], names: { current: string; previous: string }): string {
  const withRevenue = months.filter((m) => !m.future);
  const total = withRevenue.reduce((s, m) => s + m.revenue, 0);
  const head = tr('reports.chartSummary.head', { current: names.current, previous: names.previous });
  if (months.length === 0 || total === 0) return `${head} ${tr('reports.chartSummary.empty')}`;
  const best = withRevenue.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const last = withRevenue[withRevenue.length - 1];
  const parts = [head, tr('reports.chartSummary.best', { month: best.fullLabel, amount: fmtNumber(best.revenue, 0) })];
  if (last && last.key !== best.key) {
    const diff = last.previous > 0 ? Math.round(((last.revenue - last.previous) / last.previous) * 100) : null;
    const trend = diff === null ? 'none' : diff === 0 ? 'same' : diff > 0 ? 'above' : 'below';
    parts.push(tr('reports.chartSummary.last', { month: last.fullLabel, amount: fmtNumber(last.revenue, 0), trend, percent: Math.abs(diff ?? 0) }));
  }
  return parts.join(' ');
}

// ─── Categories ─────────────────────────────────────────────────

export { VEHICLE_TYPE_LABELS as CATEGORY_LABELS } from '@/lib/fleet-model';

// ─── Booking report (GET /bookings/report) ──────────────────────

export interface ReportBooking {
  id: string;
  customerName: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: string;
  status: string;
  days: number;
}

export interface VehicleReport {
  vehicleId: string;
  brand: string;
  model: string;
  bookings: ReportBooking[];
  totalEarnings: number;
  totalDays: number;
}

export interface BookingReport {
  from: string;
  to: string;
  vehicles: VehicleReport[];
  grandTotal: number;
  grandDays: number;
  totalBookings: number;
}

/**
 * GET /bookings/report refuses a range whose start is not before its end, which a single-day range
 * ('2026-10-12' to '2026-10-12') is; a time on the end date makes it valid without changing the days.
 */
export function reportRangeParams(r: Range): { from: string; to: string } {
  return r.from === r.to ? { from: r.from, to: `${r.to}T12:00:00` } : r;
}
