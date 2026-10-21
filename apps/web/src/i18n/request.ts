import { getRequestConfig } from 'next-intl/server';
import { isLocale, routing } from './routing';

/**
 * Per-request next-intl config (picked up by the `createNextIntlPlugin` in next.config.js).
 * `requestLocale` is the `[locale]` segment, set via `setRequestLocale()` in the layouts and
 * pages so they can stay statically rendered.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // A fixed zone keeps server and client output identical for any date/time formatting.
    timeZone: 'Europe/Zurich',
  };
});
