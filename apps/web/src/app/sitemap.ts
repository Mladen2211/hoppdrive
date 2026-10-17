import type { MetadataRoute } from 'next';
import type { VehicleType } from '@hoppdrive/shared';
import { getAllVehicles } from '@/lib/server-api';
import { SITE_URL, CATEGORIES, vehicleSlug } from '@/lib/seo';

export const revalidate = 3600;

// NOTE on images: Next 14.2.35's installed `MetadataRoute.Sitemap` type
// (node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts,
// `SitemapFile`) only supports `url`, `lastModified`, `changeFrequency`,
// `priority` and `alternates` — there is no `images` field in this version,
// so `<image:image>` entries are omitted here rather than produced as
// untyped/unsupported output.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vehicles = await getAllVehicles();

  const newestOverall = vehicles.length > 0
    ? new Date(Math.max(...vehicles.map((v) => new Date(v.updatedAt).getTime())))
    : undefined;

  const activeTypes = (Object.keys(CATEGORIES) as VehicleType[]).filter((type) =>
    vehicles.some((v) => v.type === type)
  );

  const categoryEntries: MetadataRoute.Sitemap = activeTypes.map((type) => {
    const categoryVehicles = vehicles.filter((v) => v.type === type);
    const newest = categoryVehicles.length > 0
      ? new Date(Math.max(...categoryVehicles.map((v) => new Date(v.updatedAt).getTime())))
      : undefined;
    return {
      url: `${SITE_URL}/mieten/${CATEGORIES[type].slug}`,
      ...(newest ? { lastModified: newest } : {}),
    };
  });

  const vehicleEntries: MetadataRoute.Sitemap = vehicles.map((v) => ({
    url: `${SITE_URL}/fahrzeuge/${vehicleSlug(v)}`,
    lastModified: new Date(v.updatedAt),
  }));

  return [
    {
      url: SITE_URL,
      ...(newestOverall ? { lastModified: newestOverall } : {}),
    },
    {
      url: `${SITE_URL}/fahrzeuge`,
      ...(newestOverall ? { lastModified: newestOverall } : {}),
    },
    ...categoryEntries,
    ...vehicleEntries,
    // Legal pages: no lastModified rather than `new Date()` on every crawl,
    // which taught Google to ignore the field entirely.
    { url: `${SITE_URL}/impressum` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/agb` },
  ];
}
