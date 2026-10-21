/**
 * Helpers for the per-language content editors (homepage, FAQ, testimonials, vehicle descriptions,
 * translatable settings).
 *
 * German lives in the normal fields. Other languages are stored as `translations[locale]` (or
 * `i18n[locale]` inside a setting) with the SAME shape as the German content. The website merges
 * them over the German value (see apps/api/src/application/i18n/localeMerge.ts), so anything left
 * empty falls back to German. This file mirrors that merge for the editors' preview and offers the
 * small immutable path helpers the editors need.
 */
import type { AppLocale, TranslatableLocale } from '@hoppdrive/shared';

export type Json = Record<string, unknown>;

export const TRANSLATABLE_LOCALES: readonly TranslatableLocale[] = ['en', 'fr', 'it', 'hr'];
export const CONTENT_LOCALES: readonly AppLocale[] = ['de', 'en', 'fr', 'it', 'hr'];

export type TranslationState = 'complete' | 'partial' | 'missing';

const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isFilled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Same rules as the API: objects key by key, arrays by index (German decides the length), non-empty strings win. */
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
      out[key] = key in base ? mergeLocaleValue(base[key], override[key]) : isFilled(override[key]) ? override[key] : undefined;
      if (out[key] === undefined) delete out[key];
    }
    return out;
  }
  if (typeof base === 'string') return isFilled(override) ? override : base;
  if (base === null || base === undefined) return isFilled(override) ? override : base;
  return base;
}

/**
 * Removes what carries no translation: blank strings, empty objects, trailing blank array entries.
 * Blank entries INSIDE an array stay (as {} / '') because the website merges arrays by index.
 * Returns undefined when nothing is left.
 */
export function pruneBlob(value: unknown): unknown {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value;
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      const pruned = pruneBlob(item);
      if (pruned !== undefined) return pruned;
      return isObject(item) ? {} : typeof item === 'string' ? '' : undefined;
    });
    while (items.length > 0) {
      const last = items[items.length - 1];
      const blank = last === undefined || last === '' || (isObject(last) && Object.keys(last).length === 0);
      if (!blank) break;
      items.pop();
    }
    return items.length > 0 ? items : undefined;
  }
  if (isObject(value)) {
    const out: Json = {};
    for (const [key, v] of Object.entries(value)) {
      const pruned = pruneBlob(v);
      if (pruned !== undefined) out[key] = pruned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return value === null || value === undefined ? undefined : value;
}

/** Cleaned `{ en: {...}, fr: {...} }` ready for the API; null when no language has any content. */
export function cleanTranslations(map: Partial<Record<TranslatableLocale, unknown>> | null | undefined): Record<string, unknown> | null {
  if (!map) return null;
  const out: Record<string, unknown> = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    const pruned = pruneBlob(map[locale]);
    if (pruned !== undefined) out[locale] = pruned;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Reads a path ('a', 0, 'b') from nested objects / arrays. */
export function getAt(source: unknown, path: (string | number)[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Immutable set at a path; missing objects / arrays on the way are created (a number key makes an array). */
export function setAt<T>(source: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const useArray = typeof head === 'number';
  const base: unknown = source ?? (useArray ? [] : {});
  if (useArray) {
    const copy = Array.isArray(base) ? [...base] : [];
    while (copy.length < (head as number)) copy.push(undefined);
    copy[head as number] = setAt(copy[head as number], rest, value);
    return copy as unknown as T;
  }
  const obj: Json = isObject(base) ? { ...base } : {};
  obj[head as string] = setAt(obj[head as string], rest, value);
  return obj as unknown as T;
}

/**
 * State of one translation from German texts and the translated texts at the same positions:
 * 'complete' = every German text has a translation, 'missing' = none has, otherwise 'partial'.
 * Without any German text there is nothing to translate (complete).
 */
export function stateOf(pairs: { base: unknown; value: unknown }[]): TranslationState {
  const needed = pairs.filter((p) => isFilled(p.base));
  if (needed.length === 0) return 'complete';
  const done = needed.filter((p) => isFilled(p.value)).length;
  if (done === 0) return 'missing';
  return done === needed.length ? 'complete' : 'partial';
}

/** Merged text for display: the translation when filled, else the German text. */
export const pick = (base: string | null | undefined, value: string | null | undefined): string => (isFilled(value) ? value : base ?? '');
