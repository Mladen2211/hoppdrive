/**
 * Per-locale constants: `<html lang>`, OpenGraph locale, the Intl locale used for numbers
 * and dates, and the native language names for the language switcher.
 * Pure data, safe to import anywhere (server, client, edge).
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from './routing';

interface LocaleMeta {
  /** `<html lang>` and JSON-LD `inLanguage`. */
  htmlLang: string;
  /** `og:locale`. */
  ogLocale: string;
  /** BCP 47 tag for Intl.NumberFormat / Intl.DateTimeFormat. */
  intl: string;
  /** Name of the language in that language (language switcher). */
  nativeName: string;
  /** Short code shown in the compact switcher. */
  code: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  de: { htmlLang: 'de-CH', ogLocale: 'de_CH', intl: 'de-CH', nativeName: 'Deutsch', code: 'DE' },
  en: { htmlLang: 'en', ogLocale: 'en_GB', intl: 'en-GB', nativeName: 'English', code: 'EN' },
  fr: { htmlLang: 'fr-CH', ogLocale: 'fr_CH', intl: 'fr-CH', nativeName: 'Français', code: 'FR' },
  it: { htmlLang: 'it-CH', ogLocale: 'it_CH', intl: 'it-CH', nativeName: 'Italiano', code: 'IT' },
  hr: { htmlLang: 'hr', ogLocale: 'hr_HR', intl: 'hr-HR', nativeName: 'Hrvatski', code: 'HR' },
};

function meta(locale: string): LocaleMeta {
  return LOCALE_META[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export const htmlLang = (locale: string) => meta(locale).htmlLang;
export const ogLocale = (locale: string) => meta(locale).ogLocale;
export const intlLocale = (locale: string) => meta(locale).intl;
