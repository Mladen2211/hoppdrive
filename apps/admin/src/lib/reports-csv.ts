/**
 * CSV rows for the three exports of the Berichte page. Everything is built in the browser and written
 * with downloadCsv (';' separated, UTF-8 BOM, '\n').
 *
 * "Buchungen" keeps the format of the old export exactly (header, rows per vehicle, a subtotal line per
 * vehicle, GESAMT) and its file name `hoppdrive-bericht-{from}-bis-{to}.csv`.
 * The per-vehicle subtotal line is aligned to the header (the old export had one cell too few there).
 */
import type { CsvCell } from '@/lib/download';
import { fmtDate, fmtMoney, monthName, toInputDate } from '@/lib/format';
import { type BookingReport, type Range } from '@/lib/reports-model';
import { tr } from '@/i18n/active';

/** '1’794.00': two decimals, no currency (the header names it). */
const amount = (n: number | string | null | undefined) => fmtMoney(n, { withCode: false });

export type ExportKind = 'bookings' | 'invoices' | 'revenue';

export const EXPORT_OPTIONS: { value: ExportKind; label: string }[] = [
  { value: 'bookings', get label() { return tr('common.buchungen'); } },
  { value: 'invoices', get label() { return tr('common.rechnungen'); } },
  { value: 'revenue', get label() { return tr('common.umsatz'); } },
];

export function exportFilename(kind: ExportKind, r: Range): string {
  const name = kind === 'bookings' ? 'bericht' : kind === 'invoices' ? 'rechnungen' : 'umsatz';
  return `hoppdrive-${name}-${r.from}-bis-${r.to}.csv`;
}

// ─── Buchungen (the existing report) ────────────────────────────

export function bookingRows(report: BookingReport, currency: string): CsvCell[][] {
  const rows: CsvCell[][] = [[tr('common.fahrzeug'), tr('common.kunde'), tr('common.von'), tr('common.bis'), tr('common.tage'), tr('reportsCsv.priceCur', { currency }), tr('common.status')]];
  for (const v of report.vehicles) {
    const name = `${v.brand} ${v.model}`;
    for (const b of v.bookings) {
      rows.push([name, b.customerName, fmtDate(b.startDate), fmtDate(b.endDate), b.days, amount(b.totalPrice), b.status]);
    }
    rows.push([tr('reportsCsv.gesamt', { name }), '', '', '', v.totalDays, amount(v.totalEarnings), '']);
  }
  rows.push(['GESAMT', '', '', '', report.grandDays, amount(report.grandTotal), '']);
  return rows;
}

// ─── Rechnungen ─────────────────────────────────────────────────

export interface InvoiceRow {
  invoiceNumber: string;
  customerName?: string | null;
  booking?: { customerName?: string | null } | null;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  vatAmount: number;
  penalty: number;
  total: number;
  status: string;
  isOverdue?: boolean;
  parentInvoiceId?: string | null;
}

const INVOICE_STATUS: Record<string, string> = { get PAID() { return tr('common.bezahlt'); }, get PENDING() { return tr('common.offen'); }, get OVERDUE() { return tr('reportsCsv.ueberfaellig'); } };

/** Invoices issued inside the range (by Ausstelldatum). */
export function invoicesInRange<T extends { issueDate: string }>(invoices: T[], r: Range): T[] {
  return invoices.filter((inv) => {
    const key = toInputDate(inv.issueDate);
    return key >= r.from && key <= r.to;
  });
}

export function invoiceRows(invoices: InvoiceRow[], overdue: (inv: InvoiceRow) => boolean, currency: string): CsvCell[][] {
  const rows: CsvCell[][] = [
    [tr('reportsCsv.rechnungsnummer'), tr('common.kunde'), tr('reportsCsv.ausgestellt'), tr('reportsCsv.faellig'), tr('reportsCsv.zeitraumVon'), tr('reportsCsv.zeitraumBis'), tr('reportsCsv.netCur', { currency }), tr('reportsCsv.vatCur', { currency }), tr('reportsCsv.dunningCur', { currency }), tr('reportsCsv.totalCur', { currency }), tr('common.status'), tr('reportsCsv.art')],
  ];
  let total = 0;
  for (const inv of invoices) {
    total += Number(inv.total) || 0;
    const status = inv.status === 'PAID' ? INVOICE_STATUS.PAID : overdue(inv) ? INVOICE_STATUS.OVERDUE : INVOICE_STATUS.PENDING;
    rows.push([
      inv.invoiceNumber,
      inv.customerName ?? inv.booking?.customerName ?? '',
      fmtDate(inv.issueDate),
      fmtDate(inv.dueDate),
      fmtDate(inv.periodStart),
      fmtDate(inv.periodEnd),
      amount(inv.subtotal),
      amount(inv.vatAmount),
      amount(inv.penalty),
      amount(inv.total),
      status,
      inv.parentInvoiceId ? tr('common.mahnung') : tr('reportsCsv.rechnung'),
    ]);
  }
  rows.push(['GESAMT', '', '', '', '', '', '', '', '', amount(total), '', '']);
  return rows;
}

// ─── Umsatz (per month) ─────────────────────────────────────────

export function revenueRows(monthly: { month: string; revenue: number; prevRevenue: number }[], currency: string): CsvCell[][] {
  const rows: CsvCell[][] = [[tr('reportsCsv.monat'), tr('reportsCsv.revenueCur', { currency }), tr('reportsCsv.prevYearCur', { currency }), tr('reportsCsv.veraenderung')]];
  let revenue = 0;
  let previous = 0;
  const change = (cur: number, prev: number) => (prev > 0 ? String(Math.round(((cur - prev) / prev) * 1000) / 10) : '');
  for (const m of monthly) {
    revenue += m.revenue;
    previous += m.prevRevenue;
    rows.push([`${monthName(Number(m.month.slice(5, 7)) - 1)} ${m.month.slice(0, 4)}`, amount(m.revenue), amount(m.prevRevenue), change(m.revenue, m.prevRevenue)]);
  }
  rows.push(['GESAMT', amount(revenue), amount(previous), change(revenue, previous)]);
  return rows;
}
