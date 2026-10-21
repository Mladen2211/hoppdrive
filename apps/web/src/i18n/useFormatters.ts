import { useLocale } from 'next-intl';
import { DEFAULT_CURRENCY, fmtDate, fmtDateShort, fmtMoney, fmtNumber, joinList, type DateInput, type FmtMoneyOptions } from '@/lib/format';

/**
 * Formatters bound to the locale of the current page (works in server and client components):
 *
 *   const f = useFormatters();            // currency defaults to 'CHF'
 *   f.money(79, { decimals: 0 })          // 'CHF 79' / '79 CHF' (fr) / ...
 *   f.date('2026-11-23')                  // '23.11.2026'
 *
 * Pass the currency code of the data you format (e.g. `vehicle.currency`) to `useFormatters`
 * or per call in the options.
 */
export function useFormatters(currency: string = DEFAULT_CURRENCY) {
  const locale = useLocale();
  return {
    locale,
    money: (value: number | string | null | undefined, options: FmtMoneyOptions = {}) =>
      fmtMoney(value, { currency, locale, ...options }),
    number: (value: number | string | null | undefined, decimals = 0) => fmtNumber(value, decimals, locale),
    date: (input: DateInput) => fmtDate(input, locale),
    dateShort: (input: DateInput) => fmtDateShort(input, locale),
    list: (items: string[]) => joinList(items, locale),
  };
}
