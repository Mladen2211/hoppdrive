import { getAllVehicles } from '@/lib/server-api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hoppdrive.ch';

type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

export default async function sitemap(): Promise<SitemapEntry[]> {
  const vehicles = await getAllVehicles();

  const vehicleEntries: SitemapEntry[] = vehicles.map((v) => ({
    url: `${SITE_URL}/fahrzeuge/${v.id}`,
    lastModified: v.updatedAt ? new Date(v.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/#fleet`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/impressum`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/agb`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    ...vehicleEntries,
  ];
}
