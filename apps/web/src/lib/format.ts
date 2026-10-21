/**
 * Shared formatting helpers for the public site. Numbers, money and dates follow the
 * locale of the page (`de`, `en`, `fr`, `it`, `hr` -> de-CH, en-GB, fr-CH, it-CH, hr-HR via
 * `intlLocale`), so the Swiss conventions come straight from Intl:
 *
 *   fmtMoney(79)                                      -> 'CHF 79.00'          (de, default)
 *   fmtMoney(14820, { decimals: 0 })                  -> 'CHF 14’820'
 *   fmtMoney(79, { decimals: 0, locale: 'fr' })       -> '79 CHF'
 *   fmtMoney(79, { decimals: 0, currency: 'EUR' })    -> 'EUR 79'
 *   fmtMoney(79.5, { decimals: 'auto' })              -> 'CHF 79.50'  (integers get no decimals)
 *   fmtMoney(14820, { decimals: 0, withCurrency: false }) -> '14’820'
 *   fmtDate('2026-11-23')                             -> '23.11.2026' (en: '23/11/2026')
 *   fmtDateShort('2026-11-23')                        -> '23.11.'
 *   toInputDate(new Date())                           -> 'YYYY-MM-DD' in LOCAL time (for <input type="date">)
 *   daysBetween(from, to, { inclusive: true })        -> rental days
 *   joinList(['a', 'b', 'c'], 'de')                   -> 'a, b und c'
 *
 * The money output keeps the no-break space between code and number. Pass `plain: true`
 * for metadata / JSON-LD / plain text, where regular spaces are expected.
 * Date-only strings are parsed as LOCAL dates, so they never shift by a day.
 * Invalid or empty input returns '–'.
 */
import { intlLocale } from '@/i18n/locales';
import { DEFAULT_LOCALE } from '@/i18n/routing';

export type DateInput = Date | string | number | null | undefined;

const EMPTY = '–';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DEFAULT_CURRENCY = 'CHF';

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

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string, short: boolean): Intl.DateTimeFormat {
  const key = `${locale}|${short ? 's' : 'l'}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(
      intlLocale(locale),
      short ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' },
    );
    dateFormats.set(key, format);
  }
  return format;
}

/** 'DD.MM.YYYY' (en: 'DD/MM/YYYY', hr: 'D. M. YYYY.') */
export function fmtDate(input: DateInput, locale: string = DEFAULT_LOCALE): string {
  const d = parseDate(input);
  return d ? dateFormat(locale, false).format(d) : EMPTY;
}

/** 'DD.MM.' */
export function fmtDateShort(input: DateInput, locale: string = DEFAULT_LOCALE): string {
  const d = parseDate(input);
  return d ? dateFormat(locale, true).format(d) : EMPTY;
}

/** Long date for running text ("23. November 2026"). */
export function fmtDateLong(input: DateInput, locale: string = DEFAULT_LOCALE): string {
  const d = parseDate(input);
  return d
    ? new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
    : EMPTY;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, decimals: number, currency?: string): Intl.NumberFormat {
  const key = `${locale}|${decimals}|${currency ?? ''}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(intlLocale(locale), {
      ...(currency ? { style: 'currency' as const, currency, currencyDisplay: 'code' as const } : {}),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormats.set(key, format);
  }
  return format;
}

/**
 * The Swiss thousands separator differs between ICU versions (Node: U+2019 `’`, some browsers: U+0027 `'`),
 * which made React report a hydration mismatch for every price above 999. One character everywhere.
 */
function unifyApostrophe(text: string): string {
  return text.replace(/'/g, '’');
}

/** NBSP / narrow NBSP -> regular space (for metadata, JSON-LD and other plain text). */
export function plainSpaces(text: string): string {
  return text.replace(/[\u00A0\u202F]/g, ' ');
}

function isEmptyNumber(value: unknown): boolean {
  return value === null || value === undefined || value === '' || Number.isNaN(Number(value));
}

/** Number with the locale's thousands separator, e.g. 14’820 or 1’794.00. */
export function fmtNumber(value: number | string | null | undefined, decimals = 0, locale: string = DEFAULT_LOCALE): string {
  if (isEmptyNumber(value)) return EMPTY;
  return unifyApostrophe(numberFormat(locale, decimals).format(Number(value)));
}

export interface FmtMoneyOptions {
  /** ISO 4217 code (default 'CHF'). */
  currency?: string;
  /** App locale ('de' | 'en' | 'fr' | 'it' | 'hr', default 'de'). */
  locale?: string;
  /** Fraction digits (default 2: 'CHF 79.00'; 0 for price tags; 'auto' = none for whole amounts, else 2). */
  decimals?: number | 'auto';
  /** Include the currency code (default true); false returns just the formatted number. */
  withCurrency?: boolean;
  /** Replace no-break spaces by regular ones (metadata, JSON-LD, plain text). */
  plain?: boolean;
}

export function fmtMoney(value: number | string | null | undefined, options: FmtMoneyOptions = {}): string {
  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, withCurrency = true, plain = false } = options;
  if (isEmptyNumber(value)) return EMPTY;
  const amount = Number(value);
  const decimals = options.decimals === 'auto' ? (Number.isInteger(amount) ? 0 : 2) : (options.decimals ?? 2);

  let text: string;
  if (!withCurrency) {
    text = numberFormat(locale, decimals).format(amount);
  } else {
    try {
      text = numberFormat(locale, decimals, currency.toUpperCase()).format(amount);
    } catch {
      // Not a valid ISO code: show it verbatim in front of the number.
      text = `${currency} ${numberFormat(locale, decimals).format(amount)}`;
    }
  }
  text = unifyApostrophe(text);
  return plain ? plainSpaces(text) : text;
}

/** "a, b und c" (locale conjunction). */
export function joinList(items: string[], locale: string = DEFAULT_LOCALE): string {
  if (items.length <= 1) return items.join('');
  return new Intl.ListFormat(intlLocale(locale), { style: 'long', type: 'conjunction' }).format(items);
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
