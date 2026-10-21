import { TimeUtils } from '../../domain';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Resolves an admin date input.
 *  - "YYYY-MM-DD" is a business day: 'start' = 00:00 of that day, 'end' = the last millisecond of that day
 *    (so a code "valid until 31.12." works the whole day).
 *  - a full ISO date-time is taken as is.
 * Returns undefined for undefined, null for null / empty, and throws for invalid input.
 */
export function resolveDateInput(
  value: string | null | undefined,
  kind: 'start' | 'end',
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const m = DATE_ONLY.exec(value);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`Invalid date: ${value}`);
    return kind === 'start'
      ? TimeUtils.zonedTimeToUtc(y, mo - 1, d, 0, 0)
      : new Date(TimeUtils.zonedTimeToUtc(y, mo - 1, d + 1, 0, 0).getTime() - 1);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

/** "YYYY-MM-DD" (calendar day, no time zone shift) for a @db.Date column value. */
export function dateOnlyString(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Parses "YYYY-MM-DD" into a UTC-midnight Date for a @db.Date column. */
export function parseDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const m = DATE_ONLY.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
