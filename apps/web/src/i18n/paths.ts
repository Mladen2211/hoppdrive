/**
 * Pure helpers that turn an internal pathname (a key of `routing.pathnames`, e.g.
 * `/fahrzeuge/[slug]`) into the public path of a locale (`/fahrzeuge/x` for German,
 * `/en/vehicles/x` for English). No React and no next-intl runtime, so it is usable from
 * metadata, JSON-LD, the sitemap and client components alike.
 */
import { DEFAULT_LOCALE, LOCALES, isLocale, routing, type AppPathname, type Locale } from './routing';

export type PathParams = Record<string, string>;

export function localizedPath(locale: Locale | string, pathname: AppPathname, params: PathParams = {}): string {
  const loc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const entry = routing.pathnames[pathname] as string | Record<Locale, string>;
  let path = typeof entry === 'string' ? entry : entry[loc];
  for (const [name, value] of Object.entries(params)) {
    path = path.replace(`[${name}]`, encodeURIComponent(value));
  }
  if (loc === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${loc}` : `/${loc}${path}`;
}

/** The path in every locale, keyed by locale (for `alternates.languages` / sitemap alternates). */
export function localizedPaths(pathname: AppPathname, params: PathParams = {}): Record<Locale, string> {
  return Object.fromEntries(LOCALES.map((loc) => [loc, localizedPath(loc, pathname, params)])) as Record<Locale, string>;
}
