/**
 * Time-zone aware calendar helpers (month / week / day boundaries).
 *
 * Servers run in UTC, but "this month", "this week" and report ranges are business
 * concepts in Swiss local time. All helpers take an IANA zone (default Europe/Zurich,
 * override with APP_TIMEZONE) and work with Intl only, so there is no dependency.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function businessTimeZone(): string {
  return process.env.APP_TIMEZONE || 'Europe/Zurich';
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  /** 0-11 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, tz: string = businessTimeZone()): ZonedParts {
  const parts = formatterFor(tz).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset (local - UTC) in ms of `tz` at the given instant. */
function offsetAt(utcMs: number, tz: string): number {
  const p = zonedParts(new Date(utcMs), tz);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The UTC instant at which the wall clock in `tz` shows the given local date/time. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  tz: string = businessTimeZone(),
): Date {
  const guess = Date.UTC(year, month, day, hour, minute, 0);
  const off1 = offsetAt(guess, tz);
  let utc = guess - off1;
  const off2 = offsetAt(utc, tz);
  if (off2 !== off1) utc = guess - off2; // crossed a DST boundary
  return new Date(utc);
}

export function startOfDay(date: Date, tz: string = businessTimeZone()): Date {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, tz);
}

/** Start of the next local day (exclusive end of the day containing `date`). */
export function startOfNextDay(date: Date, tz: string = businessTimeZone()): Date {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.year, p.month, p.day + 1, 0, 0, tz);
}

/** Start of the local calendar month containing `date`, shifted by `monthOffset` months. */
export function startOfMonth(date: Date, monthOffset = 0, tz: string = businessTimeZone()): Date {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.year, p.month + monthOffset, 1, 0, 0, tz);
}

/** Monday 00:00 (local) of the week containing `date`. */
export function startOfIsoWeek(date: Date, tz: string = businessTimeZone()): Date {
  const p = zonedParts(date, tz);
  const weekday = new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay(); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  return zonedTimeToUtc(p.year, p.month, p.day - sinceMonday, 0, 0, tz);
}

/** 'YYYY-MM' of the local month containing `date`. */
export function monthKey(date: Date, tz: string = businessTimeZone()): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}`;
}

/** Same local wall-clock moment `years` years earlier/later (Feb 29 clamps to Feb 28). */
export function shiftYears(date: Date, years: number, tz: string = businessTimeZone()): Date {
  const p = zonedParts(date, tz);
  const year = p.year + years;
  const daysInMonth = new Date(Date.UTC(year, p.month + 1, 0)).getUTCDate();
  return zonedTimeToUtc(year, p.month, Math.min(p.day, daysInMonth), p.hour, p.minute, tz);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a report range boundary.
 *  - "YYYY-MM-DD" is a local calendar day: start of that day, or (as `end`) the start of the
 *    NEXT day, so the range is half-open [from, to) and the `to` day is fully included.
 *  - any other string is parsed as an absolute instant.
 * Returns null when the input is not a valid date.
 */
export function parseRangeBoundary(
  value: string,
  kind: 'start' | 'end',
  tz: string = businessTimeZone(),
): Date | null {
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return zonedTimeToUtc(y, m - 1, kind === 'start' ? d : d + 1, 0, 0, tz);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
