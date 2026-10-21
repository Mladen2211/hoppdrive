import type { MetadataRoute } from 'next';
import type { PathParams } from '@/i18n/paths';
import { DEFAULT_LOCALE, LOCALES, type AppPathname } from '@/i18n/routing';
import { getAllVehicles } from '@/lib/server-api';
import { CATEGORY_SLUGS, CATEGORY_TYPES, pageUrl, vehicleSlug } from '@/lib/seo';

export const revalidate = 3600;

interface SitemapPage {
  pathname: AppPathname;
  params?: PathParams;
  lastModified?: Date;
}

// NOTE on images: Next 14.2.35's installed `MetadataRoute.Sitemap` type
// (node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts,
// `SitemapFile`) only supports `url`, `lastModified`, `changeFrequency`,
// `priority` and `alternates` — there is no `images` field in this version,
// so `<image:image>` entries are omitted here rather than produced as
// untyped/unsupported output.
//
// Every page is listed once per language (de without a prefix, en/fr/it/hr localised) and every
// entry carries the full hreflang set plus x-default (the German URL), as Google expects.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Slugs and updatedAt do not depend on the language.
  const vehicles = await getAllVehicles(DEFAULT_LOCALE);

  const newestOverall = vehicles.length > 0
    ? new Date(Math.max(...vehicles.map((v) => new Date(v.updatedAt).getTime())))
    : undefined;

  const activeTypes = CATEGORY_TYPES.filter((type) => vehicles.some((v) => v.type === type));

  const categoryPages: SitemapPage[] = activeTypes.map((type) => {
    const categoryVehicles = vehicles.filter((v) => v.type === type);
    const newest = categoryVehicles.length > 0
      ? new Date(Math.max(...categoryVehicles.map((v) => new Date(v.updatedAt).getTime())))
      : undefined;
    return {
      pathname: '/mieten/[kategorie]',
      params: { kategorie: CATEGORY_SLUGS[type] },
      lastModified: newest,
    };
  });

  const vehiclePages: SitemapPage[] = vehicles.map((v) => ({
    pathname: '/fahrzeuge/[slug]',
    params: { slug: vehicleSlug(v) },
    lastModified: new Date(v.updatedAt),
  }));

  const pages: SitemapPage[] = [
    { pathname: '/', lastModified: newestOverall },
    { pathname: '/fahrzeuge', lastModified: newestOverall },
    ...categoryPages,
    ...vehiclePages,
    // Legal pages: no lastModified rather than `new Date()` on every crawl,
    // which taught Google to ignore the field entirely.
    { pathname: '/impressum' },
    { pathname: '/privacy' },
    { pathname: '/agb' },
  ];

  return pages.flatMap((page) => {
    const languages: Record<string, string> = {};
    for (const locale of LOCALES) languages[locale] = pageUrl(locale, page.pathname, page.params);
    languages['x-default'] = pageUrl(DEFAULT_LOCALE, page.pathname, page.params);

    return LOCALES.map((locale) => ({
      url: pageUrl(locale, page.pathname, page.params),
      ...(page.lastModified ? { lastModified: page.lastModified } : {}),
      alternates: { languages },
    }));
  });
}
