/**
 * Formatting helpers shared by the PDFs and the e-mails (German, Swiss conventions, business time zone).
 * All dates are rendered in the business time zone (APP_TIMEZONE, default Europe/Zurich), never in the
 * server's zone, so a container running in UTC prints the same times as the admin sees.
 */
import { TimeUtils } from '../domain';

const tz = () => TimeUtils.businessTimeZone();

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(kind: 'date' | 'time' | 'dateTime'): Intl.DateTimeFormat {
  const key = `${kind}|${tz()}`;
  let f = dateFormats.get(key);
  if (!f) {
    const base: Intl.DateTimeFormatOptions = { timeZone: tz() };
    if (kind === 'date') Object.assign(base, { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (kind === 'time') Object.assign(base, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (kind === 'dateTime') {
      Object.assign(base, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    }
    f = new Intl.DateTimeFormat('de-CH', base);
    dateFormats.set(key, f);
  }
  return f;
}

/** 18.10.2026 */
export function fmtDate(d: Date): string {
  return dateFormat('date').format(d);
}

/** 14:30 */
export function fmtTime(d: Date): string {
  return dateFormat('time').format(d);
}

/** 18.10.2026, 14:30 */
export function fmtDateTime(d: Date): string {
  return dateFormat('dateTime').format(d);
}

/** True when the local time of day is not exactly 00:00 (legacy bookings are stored at 00:00 = whole day). */
export function hasTimeOfDay(d: Date): boolean {
  const p = TimeUtils.zonedParts(d);
  return p.hour !== 0 || p.minute !== 0;
}

/** Date with the time only when the booking carries a real time (see hasTimeOfDay). */
export function fmtDateMaybeTime(d: Date): string {
  return hasTimeOfDay(d) ? fmtDateTime(d) : fmtDate(d);
}

const numberFormat = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1’234.50 */
export function fmtAmount(n: number): string {
  return numberFormat.format(Math.round((Number(n) || 0) * 100) / 100);
}

/** CHF 1’234.50 */
export function fmtMoney(n: number, currency: string): string {
  return `${currency} ${fmtAmount(n)}`;
}

/** Whole rental days, rounded up (24 h blocks), at least 1. */
export function rentalDays(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}
