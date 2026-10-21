/**
 * Shared SEO helpers. One source of truth for site URLs, canonical host,
 * asset/vehicle URL building, category slugs, label translation and the Metadata
 * object every page builds from. Deliberately free of server-only imports (no
 * `next/headers`, no Node APIs) so it can also be imported from client
 * components such as VehicleCard.
 *
 * All user-facing text (category names and intros, vehicle type / fuel / transmission labels)
 * lives in messages/<locale>.json; the helpers below take a translator for it.
 */

import type { Metadata } from 'next';
import type { VehicleType } from '@hoppdrive/shared';
import { ogLocale } from '@/i18n/locales';
import { localizedPath, type PathParams } from '@/i18n/paths';
import { DEFAULT_LOCALE, LOCALES, type AppPathname, type Locale } from '@/i18n/routing';
import type { Translate } from '@/i18n/types';

export const SITE_NAME = 'HoppDrive';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hoppdrive.ch').replace(/\/+$/, '');

// Hostname only (no scheme, no port) — e.g. "hoppdrive.ch". Used by the
// middleware and robots.ts to decide which host is allowed to be indexed.
export const CANONICAL_HOST = (() => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return 'hoppdrive.ch';
  }
})();

/** Resolves a site-relative path to an absolute `https://hoppdrive.ch/...` URL. Absolute URLs pass through untouched. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Absolute URL of a page in a locale, without a trailing slash on the home page
 * (`https://hoppdrive.ch`, `https://hoppdrive.ch/en`): for JSON-LD, the sitemap and llms.txt.
 */
export function pageUrl(locale: Locale | string, pathname: AppPathname, params: PathParams = {}): string {
  const path = localizedPath(locale, pathname, params);
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Turns a relative upload path (`/uploads/<uuid>.webp`, as stored by the API)
 * into an absolute URL on the SITE origin — resolvable because
 * `next.config.js` rewrites `/uploads/:path*` to the API origin. Absolute
 * URLs (e.g. already-hosted images) pass through untouched. Returns null for
 * empty input so callers can fall back to a default image.
 */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Strips diacritics and non-alphanumeric characters, lowercases, and hyphenates. */
function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritical marks (Š→S, ü→u, …)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Builds a stable, human-readable vehicle slug: `skoda-octavia-2023-1a2b3c4d`.
 * The trailing segment is the first 8 hex characters of the vehicle's UUID
 * (its first UUID segment), so no DB migration is needed — the id remains
 * the source of truth and the slug can always be recomputed from it.
 * The slug is the same in every language.
 */
export function vehicleSlug(vehicle: { id: string; brand: string; model: string; year: number }): string {
  const base = slugify(`${vehicle.brand}-${vehicle.model}-${vehicle.year}`);
  const hash = vehicle.id.slice(0, 8).toLowerCase();
  return base ? `${base}-${hash}` : hash;
}

// Category slugs of the /mieten/[kategorie] landing pages. They are German on purpose and
// identical in every language (only the pathname segment before them is localised).
export const CATEGORY_SLUGS: Record<VehicleType, string> = {
  estate: 'kombi',
  suv: 'suv',
  sedan: 'limousine',
  van: 'van',
  electric: 'elektroauto',
  coupe: 'coupe',
  convertible: 'cabrio',
};

export const CATEGORY_TYPES = Object.keys(CATEGORY_SLUGS) as VehicleType[];

export function findCategoryType(slug: string): VehicleType | undefined {
  return CATEGORY_TYPES.find((type) => CATEGORY_SLUGS[type] === slug);
}

export function isCategoryType(type: string): type is VehicleType {
  return Object.prototype.hasOwnProperty.call(CATEGORY_SLUGS, type);
}

/** "Kombi" / "Estate": the short category name. `t` = translator of the `category` namespace. */
export function categoryLabel(type: VehicleType, t: Translate): string {
  return t(`${type}.label`);
}

/** "Kombi mieten" / "Estate car rental": the rental phrase used in headings, links and breadcrumbs. */
export function categoryRent(type: VehicleType, t: Translate): string {
  return t(`${type}.rent`);
}

/** Unique intro copy of a category landing page. `t` = translator of the `categoryIntro` namespace. */
export function categoryIntro(type: VehicleType, t: Translate): string {
  return t(type);
}

const VEHICLE_TYPES = new Set(['sedan', 'suv', 'estate', 'coupe', 'convertible', 'electric', 'van']);
const FUEL_TYPES = new Set(['petrol', 'diesel', 'electric', 'hybrid']);

/** `t` = translator of the `labels` namespace for the three functions below. */
export function translateType(type: string, t: Translate): string {
  return VEHICLE_TYPES.has(type) ? t(`type.${type}`) : type;
}

export function translateFuel(fuel: string, t: Translate): string {
  return FUEL_TYPES.has(fuel) ? t(`fuel.${fuel}`) : fuel;
}

export function translateTransmission(transmission: string, t: Translate): string {
  return transmission === 'automatic' ? t('transmission.automatic') : t('transmission.manual');
}

interface BuildMetadataOptions {
  /** Locale of the page (drives canonical, hreflang alternates and og:locale). */
  locale: Locale | string;
  title: string;
  description: string;
  /** Internal pathname (a key of the routing table), e.g. `/fahrzeuge/[slug]`. */
  pathname: AppPathname;
  /** Values for the dynamic segments of `pathname`, e.g. `{ slug }`. */
  params?: PathParams;
  /** Relative (`/uploads/...`) or absolute image URL. Falls back to the default OG image. */
  image?: string | null;
  imageAlt?: string;
  /** Skip the layout's `%s | HoppDrive` template — for titles that already lead with the brand (home). */
  absoluteTitle?: boolean;
}

/**
 * Returns a complete Metadata object: a canonical (the localised URL of THIS page), hreflang
 * alternates for all five languages plus `x-default` (the German URL), resolved through
 * metadataBase, and full openGraph + twitter blocks (Next replaces the whole
 * openGraph/twitter object per page rather than merging it key-by-key with
 * the parent, so a partial override silently drops fields — this always
 * builds the complete thing). Page titles go through the root layout's
 * `%s | HoppDrive` template; pass `absoluteTitle` for titles that already
 * contain the brand. openGraph/twitter titles don't get the template, so the
 * brand is appended to them here.
 */
export function buildMetadata({
  locale,
  title,
  description,
  pathname,
  params,
  image,
  imageAlt,
  absoluteTitle,
}: BuildMetadataOptions): Metadata {
  const path = localizedPath(locale, pathname, params);
  const url = absoluteUrl(path);
  const resolvedImage = assetUrl(image);
  const usingDefaultImage = !resolvedImage;
  const imageUrl = resolvedImage || `${SITE_URL}/og-default.jpg`;
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const alt = imageAlt || fullTitle;

  const languages: Record<string, string> = {};
  for (const loc of LOCALES) languages[loc] = localizedPath(loc, pathname, params);
  languages['x-default'] = localizedPath(DEFAULT_LOCALE, pathname, params);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
      languages,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      alternateLocale: LOCALES.filter((loc) => loc !== locale).map(ogLocale),
      type: 'website',
      images: [
        usingDefaultImage
          ? { url: imageUrl, width: 1200, height: 630, alt }
          : { url: imageUrl, alt },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
    },
  };
}
