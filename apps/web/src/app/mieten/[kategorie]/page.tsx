import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { VehicleGrid } from '@/components/b2c/VehicleGrid';
import { JsonLd } from '@/components/seo/JsonLd';
import { getAllVehicles, getAllVehiclesOrThrow } from '@/lib/server-api';
import { buildMetadata, SITE_URL, CATEGORIES, vehicleSlug } from '@/lib/seo';
import type { VehicleType } from '@hoppdrive/shared';

// Categories are prerendered from the fleet at build time. Unknown slugs and
// categories without vehicles 404 at request time (no thin pages); this stays
// dynamic so a category gaining its first vehicle — or a build that ran while
// the API was down — doesn't leave the page 404 until the next deploy.

function findCategoryType(slug: string): VehicleType | undefined {
  return (Object.keys(CATEGORIES) as VehicleType[]).find((type) => CATEGORIES[type].slug === slug);
}

export async function generateStaticParams() {
  const vehicles = await getAllVehicles();
  const activeTypes = new Set(vehicles.map((v) => v.type));
  return (Object.keys(CATEGORIES) as VehicleType[])
    .filter((type) => activeTypes.has(type))
    .map((type) => ({ kategorie: CATEGORIES[type].slug }));
}

export async function generateMetadata({ params }: { params: { kategorie: string } }): Promise<Metadata> {
  const type = findCategoryType(params.kategorie);
  if (!type) return {};

  const category = CATEGORIES[type];
  const vehicles = await getAllVehicles();
  const categoryVehicles = vehicles.filter((v) => v.type === type);
  const minPrice = categoryVehicles.length > 0 ? Math.min(...categoryVehicles.map((v) => v.basePricePerDay)) : null;

  return buildMetadata({
    title: `${category.label} mieten in der Schweiz${minPrice ? ` ab CHF ${minPrice}/Tag` : ''}`,
    description: `${category.label} mieten in der Schweiz bei HoppDrive${minPrice ? ` ab CHF ${minPrice} pro Tag` : ''}. Flexible Kurz- und Langzeitmiete, bis 40% Langzeitrabatt, Vollkasko inklusive.`,
    path: `/mieten/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: { params: { kategorie: string } }) {
  const type = findCategoryType(params.kategorie);
  if (!type) notFound();

  const category = CATEGORIES[type];
  const vehicles = await getAllVehiclesOrThrow();
  const categoryVehicles = vehicles.filter((v) => v.type === type);
  if (categoryVehicles.length === 0) notFound();

  const minPrice = Math.min(...categoryVehicles.map((v) => v.basePricePerDay));

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: categoryVehicles.map((v, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${SITE_URL}/fahrzeuge/${vehicleSlug(v)}`,
      name: `${v.brand} ${v.model}`,
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Fahrzeuge', item: `${SITE_URL}/fahrzeuge` },
      { '@type': 'ListItem', position: 3, name: `${category.label} mieten`, item: `${SITE_URL}/mieten/${category.slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <Navbar />

      <main className="flex-1">
        <section className="bg-neutral-50 border-b border-neutral-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
              <Link href="/" className="hover:text-brand-600 transition-colors">
                Startseite
              </Link>
              <span>/</span>
              <Link href="/fahrzeuge" className="hover:text-brand-600 transition-colors">
                Fahrzeuge
              </Link>
              <span>/</span>
              <span className="text-neutral-900 font-medium">{category.label} mieten</span>
            </nav>

            <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-4">
              {category.label} mieten in der Schweiz
            </h1>
            <p className="text-neutral-500 max-w-2xl text-lg">{category.intro}</p>
            <p className="text-neutral-900 font-semibold mt-3">
              Ab CHF {minPrice} pro Tag, inklusive Vollkasko und automatischem Langzeitrabatt.
            </p>

            <Link
              href="/fahrzeuge"
              className="inline-block mt-6 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              ← Alle Fahrzeuge ansehen
            </Link>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <VehicleGrid vehicles={categoryVehicles} />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
