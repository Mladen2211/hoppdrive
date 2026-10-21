import { cookies, headers } from 'next/headers';
import { createTranslator } from 'next-intl';
import { DEFAULT_LOCALE, LOCALE_COOKIE, TIME_ZONE, isLocale, pickLocale, type Locale } from './config';
import { loadMessages } from './messages';

/** Locale for server rendering: cookie (set by the language picker), else Accept-Language, else German. */
export function getServerLocale(): Locale {
  const cookieValue = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;
  return pickLocale(headers().get('accept-language')) ?? DEFAULT_LOCALE;
}

/**
 * Server-side translator for pages/metadata rendered on the server (root layout metadata, offline page).
 *   const { t, locale, messages } = await getServerTranslator();
 */
export async function getServerTranslator() {
  const locale = getServerLocale();
  const messages = await loadMessages(locale);
  const translator = createTranslator({
    locale,
    messages,
    timeZone: TIME_ZONE,
    onError: () => undefined,
    getMessageFallback: ({ namespace, key }) => (namespace ? `${namespace}.${key}` : key),
  });
  const t = (key: string, values?: Record<string, string | number>) =>
    (translator as unknown as (k: string, v?: Record<string, string | number>) => string)(key, values);
  return { t, locale, messages };
}
