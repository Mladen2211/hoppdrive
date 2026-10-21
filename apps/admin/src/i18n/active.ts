/**
 * The translator for code that runs outside React components (lib/format, lib/audit, lib/errors,
 * lib/booking, models ...). I18nProvider keeps `active` in sync with the locale on every render, so
 * calls made while rendering always use the current language.
 *
 * Inside components prefer useTranslations() from next-intl (it re-renders on language change);
 * use tr() only in plain helper functions. Never call tr() at module load time: German would be
 * baked in. Wrap the lookup in a function instead.
 */
import { createTranslator, type RichTranslationValues } from 'next-intl';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE, TIME_ZONE, type Locale } from './config';
import { germanMessages, type Messages } from './messages';

type Values = Record<string, string | number | Date | boolean | null | undefined>;

interface Active {
  locale: Locale;
  messages: Messages;
  translate: (key: string, values?: Values) => string;
  rich: (key: string, values: RichTranslationValues) => ReactNode;
}

function build(locale: Locale, messages: Messages): Active {
  const translator = createTranslator({
    locale,
    messages,
    timeZone: TIME_ZONE,
    onError: () => {
      /* missing keys fall back to the key text below */
    },
    getMessageFallback: ({ namespace, key }) => (namespace ? `${namespace}.${key}` : key),
  });
  return {
    locale,
    messages,
    translate: (key, values) =>
      // The generic key type of createTranslator only knows keys of a typed message object.
      (translator as unknown as (k: string, v?: Values) => string)(key, values),
    rich: (key, values) =>
      (translator as unknown as { rich: (k: string, v: RichTranslationValues) => ReactNode }).rich(key, values),
  };
}

let active: Active = build(DEFAULT_LOCALE, germanMessages());

/** Called by I18nProvider while rendering. Cheap when nothing changed. */
export function setActiveLocale(locale: Locale, messages: Messages): void {
  if (active.locale === locale && active.messages === messages) return;
  active = build(locale, messages);
}

export function activeLocale(): Locale {
  return active.locale;
}

/**
 * Translate outside of a component, e.g. tr('time.justNow') or tr('errors.timeout').
 * tr.rich('key', { b: (chunks) => <b>{chunks}</b> }) renders messages with <b>...</b> tags.
 */
export const tr = Object.assign(
  (key: string, values?: Values): string => active.translate(key, values),
  { rich: (key: string, values: RichTranslationValues): ReactNode => active.rich(key, values) },
);
