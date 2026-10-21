import { APP_LOCALES, type AppLocale } from '@hoppdrive/shared';

/**
 * Locale handling for public content. German is the authoritative source and lives in the normal
 * columns / settings values; other languages are stored as `translations[locale]` (or `i18n[locale]`
 * inside settings) and merged over the German value. Anything missing falls back to German.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFilledString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Accepts 'de' | 'en' | 'fr' | 'it' | 'hr' (also 'en-US' style tags); anything else is ignored. */
export function parseLocale(value: unknown): AppLocale | null {
  if (typeof value !== 'string') return null;
  const short = value.trim().toLowerCase().split(/[-_]/)[0];
  return (APP_LOCALES as readonly string[]).includes(short) ? (short as AppLocale) : null;
}

/**
 * Merges `override` over `base`.
 *  - objects are merged key by key, arrays element by element (by index; German decides the length)
 *  - strings are replaced only by non-empty strings, so an empty translation falls back to German
 *  - other values (numbers, booleans) are language independent and never replaced
 */
export function mergeLocaleValue(base: unknown, override: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(override)) return base;
    return base.map((item, i) => (i < override.length ? mergeLocaleValue(item, override[i]) : item));
  }
  if (isObject(base)) {
    if (!isObject(override)) return base;
    const out: Json = { ...base };
    for (const key of Object.keys(override)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      out[key] = key in base ? mergeLocaleValue(base[key], override[key]) : isFilledString(override[key]) ? override[key] : undefined;
      if (out[key] === undefined) delete out[key];
    }
    return out;
  }
  if (typeof base === 'string') return isFilledString(override) ? override : base;
  if (base === null || base === undefined) return isFilledString(override) ? override : base;
  return base;
}

/** translations -> the blob of one locale (or undefined). */
export function translationFor(translations: unknown, locale: AppLocale): Json | undefined {
  if (!isObject(translations)) return undefined;
  const blob = translations[locale];
  return isObject(blob) ? blob : undefined;
}

/**
 * Row with a `translations` column (FAQ, testimonial, vehicle): returns a copy where the listed text
 * fields are replaced by their translation, and `translations` removed (public output).
 * Without a (non-German) locale the German row is returned, still without `translations`.
 */
export function localizeRow<T extends { translations?: unknown }>(
  row: T,
  locale: AppLocale | null,
  fields: readonly string[],
): Omit<T, 'translations'> {
  const { translations, ...rest } = row;
  const out = { ...rest } as Record<string, unknown>;
  if (locale && locale !== 'de') {
    const blob = translationFor(translations, locale);
    if (blob) {
      for (const field of fields) {
        if (isFilledString(blob[field])) out[field] = blob[field];
      }
    }
  }
  return out as Omit<T, 'translations'>;
}

/** Homepage section: content deep-merged with translations[locale]; `translations` removed. */
export function localizeSection<T extends { content: unknown; translations?: unknown }>(
  row: T,
  locale: AppLocale | null,
): Omit<T, 'translations'> {
  const { translations, ...rest } = row;
  if (!locale || locale === 'de') return rest as Omit<T, 'translations'>;
  const blob = translationFor(translations, locale);
  return { ...rest, content: blob ? mergeLocaleValue(rest.content, blob) : rest.content } as Omit<T, 'translations'>;
}

/** Setting value: `i18n[locale]` deep-merged over the German value; `i18n` removed. */
export function localizeSetting(value: unknown, locale: AppLocale): unknown {
  if (!isObject(value)) return value;
  const { i18n, ...german } = value;
  if (locale === 'de') return german;
  const blob = translationFor(i18n, locale);
  return blob ? mergeLocaleValue(german, blob) : german;
}

/**
 * Validates the shape of a `translations` payload from the admin:
 * { en: {...}, fr: {...} } with only known locales (German is not stored here) and object blobs.
 * Returns the cleaned value, or an error message.
 */
export function sanitizeTranslations(input: unknown): { value: Json | null } | { error: string } {
  if (input === null) return { value: null };
  if (!isObject(input)) return { error: 'translations must be an object like { en: {...}, fr: {...} }' };
  const out: Json = {};
  for (const [locale, blob] of Object.entries(input)) {
    if (!(APP_LOCALES as readonly string[]).includes(locale) || locale === 'de') {
      return { error: `Unknown locale "${locale}" in translations (allowed: en, fr, it, hr)` };
    }
    if (blob === null || blob === undefined) continue;
    if (!isObject(blob)) return { error: `translations.${locale} must be an object` };
    out[locale] = blob;
  }
  if (JSON.stringify(out).length > 200_000) return { error: 'translations are too large' };
  return { value: Object.keys(out).length > 0 ? out : null };
}
