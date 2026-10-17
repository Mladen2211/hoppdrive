import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { VehicleGrid } from '@/components/b2c/VehicleGrid';
import { JsonLd } from '@/components/seo/JsonLd';
import { getAllVehicles } from '@/lib/server-api';
import { buildMetadata, SITE_URL, CATEGORIES, vehicleSlug } from '@/lib/seo';
import type { VehicleType } from '@hoppdrive/shared';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Mietwagen in der Schweiz – unsere Flotte',
    description:
      'Alle Mietfahrzeuge von HoppDrive auf einen Blick: Limousinen, SUVs, Kombis, Vans und Elektroautos. Günstige Tagespreise, automatischer Langzeitrabatt, Vollkasko inklusive.',
    path: '/fahrzeuge',
  });
}

export default async function FahrzeugeIndexPage() {
  const vehicles = await getAllVehicles();

  const activeCategories = (Object.keys(CATEGORIES) as VehicleType[]).filter((type) =>
    vehicles.some((v) => v.type === type)
  );

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: vehicles.map((v, idx) => ({
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
              <span className="text-neutral-900 font-medium">Fahrzeuge</span>
            </nav>

            <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-4">
              Mietwagen in der Schweiz – unsere Flotte
            </h1>
            <p className="text-neutral-500 max-w-2xl text-lg">
              Von der sparsamen Limousine bis zum geräumigen Van: Stöbern Sie durch unsere gesamte Flotte und
              finden Sie das passende Fahrzeug für Ihre nächste Reise. Alle Preise inklusive Vollkasko, mit
              automatischem Rabatt bei längerer Mietdauer.
            </p>

            {activeCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {activeCategories.map((type) => (
                  <Link
                    key={type}
                    href={`/mieten/${CATEGORIES[type].slug}`}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-white border border-neutral-200 text-neutral-700 hover:border-brand-600 hover:text-brand-600 transition-colors"
                  >
                    {CATEGORIES[type].label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <VehicleGrid vehicles={vehicles} />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
