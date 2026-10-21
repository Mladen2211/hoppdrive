/**
 * Translations of settings. A translatable setting keeps its German texts in the normal fields and the
 * other languages in an `i18n` sub-key with the same shape: `{ ...german, i18n: { en: {...}, fr: {...} } }`.
 * The website merges `i18n[locale]` over the German value; empty texts fall back to German.
 */
import type { TranslatableLocale } from '@hoppdrive/shared';
import { cleanTranslations, getAt, setAt, stateOf, type Json, type TranslationState } from './translations';
import type { AppLocale } from '@hoppdrive/shared';
import { TRANSLATABLE_LOCALES } from './translations';

type WithI18n = { i18n?: Record<string, unknown> };

/** The translations blob of one language (empty object when there is none). */
export function i18nBlob(setting: WithI18n | null | undefined, locale: TranslatableLocale): Json {
  const blob = setting?.i18n?.[locale];
  return blob && typeof blob === 'object' && !Array.isArray(blob) ? (blob as Json) : {};
}

/** Copy of the setting with `i18n[locale]` replaced; `i18n` disappears when no language has any text. */
export function withI18n<T extends WithI18n>(setting: T, locale: TranslatableLocale, blob: Json): T {
  const merged = { ...(setting.i18n ?? {}), [locale]: blob } as Partial<Record<TranslatableLocale, unknown>>;
  const cleaned = cleanTranslations(merged);
  const { i18n: _drop, ...rest } = setting; // eslint-disable-line @typescript-eslint/no-unused-vars
  return (cleaned ? { ...rest, i18n: cleaned } : rest) as T;
}

/** Sets one text inside a language's blob. */
export function setI18nText<T extends WithI18n>(setting: T, locale: TranslatableLocale, path: (string | number)[], value: string): T {
  return withI18n(setting, locale, setAt(i18nBlob(setting, locale), path, value));
}

export const i18nText = (setting: WithI18n | null | undefined, locale: TranslatableLocale, path: (string | number)[]): string => {
  const value = getAt(i18nBlob(setting, locale), path);
  return typeof value === 'string' ? value : '';
};

/** State per language from a list of German texts and the paths of their translations. */
export function i18nStates(
  setting: WithI18n | null | undefined,
  texts: { base: string | null | undefined; path: (string | number)[] }[],
): Partial<Record<AppLocale, TranslationState>> {
  const out: Partial<Record<AppLocale, TranslationState>> = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    out[locale] = stateOf(texts.map((t) => ({ base: t.base, value: i18nText(setting, locale, t.path) })));
  }
  return out;
}
