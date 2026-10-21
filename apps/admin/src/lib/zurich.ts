/**
 * Business time zone helpers. Pickup / return times of a booking are entered and shown in Swiss time
 * (Europe/Zurich), whatever time zone the browser is in; the API stores UTC instants.
 *
 *   zurichToIso('2026-11-23', '09:00')   -> '2026-11-23T08:00:00.000Z'  (winter: UTC+1)
 *   zurichParts('2026-11-23T08:00:00Z')  -> { date: '2026-11-23', time: '09:00' }
 *   fmtZurichPeriod(booking)             -> '23.11.2026, 09:00 – 25.11.2026, 18:00' (or just the dates when the
 *                                           booking is a legacy whole-day booking without times)
 */
import { activeLocale } from '@/i18n/active';
import { INTL_LOCALE, TIME_ZONE } from '@/i18n/config';

export const DEFAULT_PICKUP_TIME = '09:00';
export const DEFAULT_RETURN_TIME = '18:00';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Offset of the business time zone to UTC (minutes, local minus UTC) at the given instant. */
function offsetMinutes(utcMs: number): number {
  const parts = partsFormatter.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' + 'HH:mm' in Swiss local time -> ISO instant (UTC). Returns '' for incomplete / invalid input. */
export function zurichToIso(date: string, time: string): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time || '00:00');
  if (!d || !t) return '';
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  if (Number.isNaN(wall)) return '';
  // Two passes so the result is right across the daylight saving switch.
  let guess = wall - offsetMinutes(wall) * 60_000;
  guess = wall - offsetMinutes(guess) * 60_000;
  return new Date(guess).toISOString();
}

/** ISO instant -> Swiss local date ('YYYY-MM-DD') and time ('HH:mm'). null for invalid input. */
export function zurichParts(input: string | Date | null | undefined): { date: string; time: string } | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${pad(Number(get('hour')))}:${get('minute')}` };
}

const dateCache = new Map<string, Intl.DateTimeFormat>();
function dateFormat(): Intl.DateTimeFormat {
  const tag = INTL_LOCALE[activeLocale()];
  let formatter = dateCache.get(tag);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
    dateCache.set(tag, formatter);
  }
  return formatter;
}

/** '23.11.2026' in Swiss time. */
export function fmtZurichDate(input: string | Date | null | undefined): string {
  const date = input ? new Date(input) : null;
  return date && !Number.isNaN(date.getTime()) ? dateFormat().format(date) : '–';
}

/** '09:00' in Swiss time. */
export function fmtZurichTime(input: string | Date | null | undefined): string {
  return zurichParts(input)?.time ?? '–';
}

/** '23.11.2026, 09:00' in Swiss time. */
export function fmtZurichDateTime(input: string | Date | null | undefined): string {
  const parts = zurichParts(input);
  return parts ? `${fmtZurichDate(input)}, ${parts.time}` : '–';
}

/**
 * Period of a booking. Legacy whole-day bookings (`hasTimes` false) show the dates only; bookings with
 * real times show date and time on both ends.
 */
export function fmtZurichPeriod(booking: { startDate: string; endDate: string; hasTimes?: boolean }): string {
  if (booking.hasTimes !== true) return `${fmtZurichDate(booking.startDate)} – ${fmtZurichDate(booking.endDate)}`;
  return `${fmtZurichDateTime(booking.startDate)} – ${fmtZurichDateTime(booking.endDate)}`;
}
