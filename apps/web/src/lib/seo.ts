/**
 * Shared SEO helpers. One source of truth for site URLs, canonical host,
 * asset/vehicle URL building, category metadata and the Metadata object
 * every page builds from. Deliberately free of server-only imports (no
 * `next/headers`, no Node APIs) so it can also be imported from client
 * components such as VehicleCard.
 */

import type { Metadata } from 'next';
import type { VehicleType } from '@hoppdrive/shared';

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
 */
export function vehicleSlug(vehicle: { id: string; brand: string; model: string; year: number }): string {
  const base = slugify(`${vehicle.brand}-${vehicle.model}-${vehicle.year}`);
  const hash = vehicle.id.slice(0, 8).toLowerCase();
  return base ? `${base}-${hash}` : hash;
}

export interface CategoryInfo {
  slug: string;
  label: string;
  intro: string;
}

// German category slugs + unique, non-spammy intro copy (2-3 sentences each)
// for the /mieten/[kategorie] landing pages.
export const CATEGORIES: Record<VehicleType, CategoryInfo> = {
  estate: {
    slug: 'kombi',
    label: 'Kombi',
    intro:
      'Der Kombi ist der Alltagsheld für Familien und Vielfahrer: viel Stauraum im Kofferraum, komfortabel auf langen Strecken und trotzdem wendig genug für die Stadt. Bei HoppDrive mieten Sie Kombis bekannter Marken – ideal für Umzüge, Ferien oder den Transport grösserer Gegenstände.',
  },
  suv: {
    slug: 'suv',
    label: 'SUV',
    intro:
      'SUVs bieten eine erhöhte Sitzposition, viel Platz und ein sicheres Fahrgefühl auf jeder Strasse – ob in der Stadt oder auf alpinen Pässen. Unsere SUV-Flotte eignet sich für Familien, Ausflüge in die Berge und alle, die etwas mehr Raum und Bodenfreiheit schätzen.',
  },
  sedan: {
    slug: 'limousine',
    label: 'Limousine',
    intro:
      'Limousinen punkten mit ruhigem Fahrverhalten, grossem Kofferraum und einem repräsentativen Auftritt – perfekt für Geschäftsreisen oder entspannte Langstrecken. Bei HoppDrive mieten Sie Limousinen zu transparenten Tagespreisen, inklusive Vollkasko.',
  },
  van: {
    slug: 'van',
    label: 'Van',
    intro:
      'Vans bieten maximalen Platz für Passagiere und Gepäck und sind die erste Wahl für grössere Gruppen, Familien oder Vereinsausflüge. Unsere Vans lassen sich flexibel mieten – vom einzelnen Wochenende bis zur mehrmonatigen Nutzung.',
  },
  electric: {
    slug: 'elektroauto',
    label: 'Elektroauto',
    intro:
      'Elektrofahrzeuge fahren lokal emissionsfrei und leise – ideal, um die Schweiz CO2-bewusst zu entdecken. Bei HoppDrive mieten Sie Elektroautos inklusive Vollkasko, ganz ohne eigene Ladeinfrastruktur oder Anschaffungskosten.',
  },
  coupe: {
    slug: 'coupe',
    label: 'Coupé',
    intro:
      'Coupés verbinden sportliches Design mit direktem Fahrgefühl – für alle, die auch beim Mietwagen nicht auf Fahrfreude verzichten möchten. Die zweitürige Bauweise bringt Stil auf jede Fahrt, vom Wochenendausflug bis zum besonderen Anlass.',
  },
  convertible: {
    slug: 'cabrio',
    label: 'Cabrio',
    intro:
      'Ein Cabrio macht aus jeder Fahrt ein Erlebnis – offenes Fahren bei Sonnenschein, ob entlang eines Schweizer Sees oder durch die Alpen. Mieten Sie bei HoppDrive ein Cabrio für den besonderen Ausflug oder die Ferienwoche.',
  },
};

export function translateType(type: string): string {
  const labels: Record<string, string> = {
    sedan: 'Limousine',
    suv: 'SUV',
    estate: 'Kombi',
    coupe: 'Coupé',
    convertible: 'Cabrio',
    electric: 'Elektrofahrzeug',
    van: 'Van',
  };
  return labels[type] || type;
}

export function translateFuel(fuel: string): string {
  const labels: Record<string, string> = {
    petrol: 'Benzin',
    diesel: 'Diesel',
    electric: 'Elektrisch',
    hybrid: 'Hybrid',
  };
  return labels[fuel] || fuel;
}

export function translateTransmission(transmission: string): string {
  return transmission === 'automatic' ? 'Automatik' : 'Schaltgetriebe';
}

interface BuildMetadataOptions {
  title: string;
  description: string;
  /** Site-relative path, e.g. `/fahrzeuge/skoda-octavia-2023-1a2b3c4d`. */
  path: string;
  /** Relative (`/uploads/...`) or absolute image URL. Falls back to the default OG image. */
  image?: string | null;
  imageAlt?: string;
  /** Skip the layout's `%s | HoppDrive` template — for titles that already lead with the brand (home). */
  absoluteTitle?: boolean;
}

/**
 * Returns a complete Metadata object: a canonical resolved through
 * metadataBase, and full openGraph + twitter blocks (Next replaces the whole
 * openGraph/twitter object per page rather than merging it key-by-key with
 * the parent, so a partial override silently drops fields — this always
 * builds the complete thing). Page titles go through the root layout's
 * `%s | HoppDrive` template; pass `absoluteTitle` for titles that already
 * contain the brand. openGraph/twitter titles don't get the template, so the
 * brand is appended to them here.
 */
export function buildMetadata({ title, description, path, image, imageAlt, absoluteTitle }: BuildMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const resolvedImage = assetUrl(image);
  const usingDefaultImage = !resolvedImage;
  const imageUrl = resolvedImage || `${SITE_URL}/og-default.jpg`;
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const alt = imageAlt || fullTitle;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'de_CH',
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
