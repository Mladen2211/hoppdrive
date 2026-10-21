/**
 * Shared formatting helpers for the admin. They follow the ACTIVE LANGUAGE (see i18n/active.ts):
 * dates and numbers go through Intl with the Swiss variant of the locale where one exists
 * (de-CH, fr-CH, it-CH), en-GB for English and hr-HR for Croatian. German output is unchanged.
 *
 *   fmtDate('2026-11-23')                  -> '23.11.2026'            (en: '23/11/2026')
 *   fmtDateShort('2026-11-23')             -> '23.11.'
 *   fmtDateTime('2026-11-23T16:40:00')     -> '23.11.2026, 16:40'
 *   fmtMoney(995.4)                        -> 'CHF 995.40'            (fr/hr: '995,40 CHF')
 *   fmtMoney(14820, { decimals: 0 })       -> 'CHF 14’820'
 *   fmtMoney(80, { currency: 'EUR' })      -> 'EUR 80.00'
 *   fmtCHF(...)                            -> alias of fmtMoney for older call sites
 *   fmtRelative(date)                      -> 'vor 12 Minuten' | 'Gestern, 16:40' | 'vor 3 Tagen' | '23.11.2026'
 *   monthName(0) / monthShort(0)           -> 'Januar' / 'Jan'
 *   weekdayShort(0) / weekdayLong(0)       -> 'Mo' / 'Montag'  (Monday first)
 *   daysBetween(a, b)                      -> whole calendar days from a to b
 *   toInputDate(new Date())                -> 'YYYY-MM-DD' in LOCAL time (for <input type="date">)
 *
 * Date-only strings ('YYYY-MM-DD') are parsed as LOCAL dates, so they never
 * shift by a day because of UTC. Invalid or empty input returns '–'.
 */
import { activeLocale, tr } from '@/i18n/active';
import { INTL_LOCALE } from '@/i18n/config';

export type DateInput = Date | string | number | null | undefined;

const EMPTY = '–';
// Thousands separator: typographic apostrophe, as on the design boards (14’820).
const APOSTROPHE = '’';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string') {
    const match = DATE_ONLY.exec(input);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Intl formatters are expensive to build; keep one per locale and shape.
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function dateFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = INTL_LOCALE[activeLocale()];
  const id = `d|${tag}|${key}`;
  let formatter = cache.get(id) as Intl.DateTimeFormat | undefined;
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag, options);
    cache.set(id, formatter);
  }
  return formatter;
}
function numberFormatter(decimals: number): Intl.NumberFormat {
  const tag = INTL_LOCALE[activeLocale()];
  const id = `n|${tag}|${decimals}`;
  let formatter = cache.get(id) as Intl.NumberFormat | undefined;
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(id, formatter);
  }
  return formatter;
}

/** 'DD.MM.YYYY' (en: 'DD/MM/YYYY') */
export function fmtDate(input: DateInput): string {
  const d = parseDate(input);
  return d ? dateFormatter('date', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : EMPTY;
}

/** 'DD.MM.' */
export function fmtDateShort(input: DateInput): string {
  const d = parseDate(input);
  return d ? dateFormatter('short', { day: '2-digit', month: '2-digit' }).format(d) : EMPTY;
}

/** 'HH:mm' (24 hours in every language) */
export function fmtTime(input: DateInput): string {
  const d = parseDate(input);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : EMPTY;
}

/** 'DD.MM.YYYY, HH:mm' */
export function fmtDateTime(input: DateInput): string {
  const d = parseDate(input);
  return d ? `${fmtDate(d)}, ${fmtTime(d)}` : EMPTY;
}

/** 'Dienstag, 3. November 2026' / 'Tuesday, 3 November 2026' */
export function fmtDateLong(input: DateInput): string {
  const d = parseDate(input);
  return d ? dateFormatter('long', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) : EMPTY;
}

/** Month names: index 0 = January. Texts live in messages (months.long / months.short). */
export const monthName = (index: number): string => tr(`months.long.m${index + 1}`);
export const monthShort = (index: number): string => tr(`months.short.m${index + 1}`);
/** Weekday names, Monday first: index 0 = Monday. */
export const weekdayShort = (index: number): string => tr(`weekdays.short.d${index + 1}`);
export const weekdayLong = (index: number): string => tr(`weekdays.long.d${index + 1}`);

function groupedNumber(value: number, decimals: number): string {
  const text = numberFormatter(decimals).format(value);
  const locale = activeLocale();
  // Swiss German / Italian: different ICU versions emit ' (U+0027), ’ (U+2019) or narrow no-break spaces.
  return locale === 'de' || locale === 'it' ? text.replace(/['’ʼ  ]/g, APOSTROPHE) : text;
}

/** Number with the locale's thousands separator, e.g. 14’820 or 1’794.00. */
export function fmtNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return EMPTY;
  return groupedNumber(Number(value), decimals);
}

export interface FmtMoneyOptions {
  /** ISO currency code, default 'CHF'. */
  currency?: string;
  /** Fraction digits (default 2: 'CHF 79.00'; use 0 for KPI tiles: 'CHF 14’820'). */
  decimals?: number;
  /** Add the currency code (default true). false returns the bare number. */
  withCode?: boolean;
}

/** Amount with currency code: before the number in de/en/it ('CHF 79.00'), after it in fr/hr ('79,00 CHF'). */
export function fmtMoney(value: number | string | null | undefined, options: FmtMoneyOptions = {}): string {
  const { currency = 'CHF', decimals = 2, withCode = true } = options;
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return EMPTY;
  const text = groupedNumber(Number(value), decimals);
  if (!withCode) return text;
  const locale = activeLocale();
  return locale === 'fr' || locale === 'hr' ? `${text} ${currency}` : `${currency} ${text}`;
}

export interface FmtCHFOptions {
  /** Fraction digits (default 2). */
  decimals?: number;
  /** Legacy switch: false returns the bare number without 'CHF'. */
  currency?: boolean;
}

/** @deprecated Use fmtMoney; kept so older call sites compile. */
export function fmtCHF(value: number | string | null | undefined, options: FmtCHFOptions = {}): string {
  return fmtMoney(value, { decimals: options.decimals, withCode: options.currency !== false });
}

function dayNumber(d: Date): number {
  // Days since epoch for the LOCAL calendar date (DST-safe).
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). `inclusive` adds one day (rental days). */
export function daysBetween(from: DateInput, to: DateInput, options: { inclusive?: boolean } = {}): number {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  return dayNumber(b) - dayNumber(a) + (options.inclusive ? 1 : 0);
}

/** 'YYYY-MM-DD' from the LOCAL date parts (no UTC shift, unlike toISOString()). */
export function toInputDate(input: DateInput = new Date()): string {
  const d = parseDate(input);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

/**
 * Relative time in the active language (German shown):
 *   < 1 min 'gerade eben', < 1 h 'vor 12 Minuten', same day 'vor 3 Stunden',
 *   yesterday 'Gestern, 16:40', < 7 days 'vor 3 Tagen', else 'DD.MM.YYYY'.
 * `capitalize` gives 'Vor 12 Minuten' for use at the start of a sentence/list item.
 */
export function fmtRelative(input: DateInput, options: { now?: Date; capitalize?: boolean } = {}): string {
  const d = parseDate(input);
  if (!d) return EMPTY;
  const now = options.now ?? new Date();
  const cap = (s: string) => (options.capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const diffMs = now.getTime() - d.getTime();
  if (diffMs < -60_000) return fmtDateTime(d); // in the future: show the absolute time
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return cap(tr('time.justNow'));
  if (minutes < 60) return cap(tr('time.minutesAgo', { count: minutes }));

  const dayDiff = dayNumber(now) - dayNumber(d);
  if (dayDiff === 0) return cap(tr('time.hoursAgo', { count: Math.floor(minutes / 60) }));
  if (dayDiff === 1) return tr('time.yesterdayAt', { time: fmtTime(d) });
  if (dayDiff < 7) return cap(tr('time.daysAgo', { count: dayDiff }));
  return fmtDate(d);
}
