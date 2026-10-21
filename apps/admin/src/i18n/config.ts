/**
 * Admin i18n configuration (no URL routing: the locale lives in the admin profile, a cookie and
 * localStorage). See I18nProvider.tsx for the runtime and ../messages/*.json for the strings.
 */

export const LOCALES = ['de', 'en', 'fr', 'it', 'hr'] as const;
export type Locale = (typeof LOCALES)[number];

/** German is the source language and the fallback for every missing key. */
export const DEFAULT_LOCALE: Locale = 'de';

/** Names in their own language, shown in the language pickers. */
export const LOCALE_NAMES: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  hr: 'Hrvatski',
};

/** `lang` attribute of <html>. */
export const HTML_LANG: Record<Locale, string> = {
  de: 'de-CH',
  en: 'en',
  fr: 'fr-CH',
  it: 'it-CH',
  hr: 'hr',
};

/** BCP 47 tag handed to Intl (dates, numbers). Swiss variants where they exist. */
export const INTL_LOCALE: Record<Locale, string> = {
  de: 'de-CH',
  en: 'en-GB',
  fr: 'fr-CH',
  it: 'it-CH',
  hr: 'hr-HR',
};

export const TIME_ZONE = 'Europe/Zurich';

/** Cookie (read on the server for the first paint) and localStorage key holding the locale. */
export const LOCALE_COOKIE = 'hd-locale';
export const LOCALE_STORAGE_KEY = 'hd-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** First supported language of a list like navigator.languages or an Accept-Language header value. */
export function pickLocale(languages: readonly string[] | string | null | undefined): Locale | null {
  if (!languages) return null;
  const list =
    typeof languages === 'string'
      ? languages
          .split(',')
          .map((part) => {
            const [tag, q] = part.trim().split(';q=');
            return { tag: tag.trim(), q: q ? Number(q) : 1 };
          })
          .filter((entry) => entry.tag && !Number.isNaN(entry.q))
          .sort((a, b) => b.q - a.q)
          .map((entry) => entry.tag)
      : languages;
  for (const tag of list) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return null;
}
