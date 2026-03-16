import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Car, Fuel, Gauge, Users, Zap, Calendar, Shield, Clock, Heart, Star, CheckCircle, Truck } from 'lucide-react';
import { getVehicle, getAllVehicles, getSetting, type VehicleDetail } from '@/lib/server-api';
import { VehicleImageGallery } from '@/components/b2c/VehicleImageGallery';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// ─── Static Params (ISR: pre-render all vehicle pages) ──────
export async function generateStaticParams() {
  const vehicles = await getAllVehicles();
  return vehicles.map((v) => ({ id: v.id }));
}

// ─── SEO: Dynamic Metadata per Vehicle ──────────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hoppdrive.ch';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const vehicle = await getVehicle(params.id);
  if (!vehicle) {
    return { title: 'Fahrzeug nicht gefunden – HoppDrive' };
  }

  const title = `${vehicle.brand} ${vehicle.model} günstig mieten ab CHF ${vehicle.basePricePerDay}/Tag – HoppDrive Schweiz`;
  const description = `${vehicle.brand} ${vehicle.model} (${vehicle.year}) günstig mieten – ${translateType(vehicle.type)} mit ${vehicle.specs.horsepower} PS, ${vehicle.specs.seats} Sitzen. Ab CHF ${vehicle.basePricePerDay}/Tag, bis 40% Langzeitrabatt. Vollkasko inklusive. Jetzt unverbindlich anfragen bei HoppDrive.`;
  const url = `${SITE_URL}/fahrzeuge/${vehicle.id}`;
  const imageUrl = vehicle.thumbnailUrl || `${SITE_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'HoppDrive',
      locale: 'de_CH',
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${vehicle.brand} ${vehicle.model} – HoppDrive Langzeitvermietung`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${vehicle.brand} ${vehicle.model} mieten | HoppDrive`,
      description,
      images: [imageUrl],
    },
    robots: { index: true, follow: true },
  };
}

// ─── JSON-LD Structured Data ────────────────────────────────
function buildJsonLd(vehicle: VehicleDetail): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${vehicle.brand} ${vehicle.model}`,
    description: `${vehicle.brand} ${vehicle.model} (${vehicle.year}) günstig mieten in der Schweiz. ${translateType(vehicle.type)} mit ${vehicle.specs.horsepower} PS. Ab CHF ${vehicle.basePricePerDay}/Tag.`,
    brand: {
      '@type': 'Brand',
      name: vehicle.brand,
    },
    image: vehicle.images.length > 0
      ? vehicle.images.sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url)
      : vehicle.thumbnailUrl
        ? [vehicle.thumbnailUrl]
        : [],
    url: `${SITE_URL}/fahrzeuge/${vehicle.id}`,
    category: translateType(vehicle.type),
    offers: {
      '@type': 'Offer',
      priceCurrency: vehicle.currency,
      price: vehicle.basePricePerDay,
      priceValidUntil: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
      availability: vehicle.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/fahrzeuge/${vehicle.id}`,
      seller: {
        '@type': 'Organization',
        name: 'HoppDrive',
        url: SITE_URL,
      },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Leistung', value: `${vehicle.specs.horsepower} PS` },
      { '@type': 'PropertyValue', name: 'Getriebe', value: vehicle.specs.transmission === 'automatic' ? 'Automatik' : 'Schaltgetriebe' },
      { '@type': 'PropertyValue', name: 'Sitze', value: `${vehicle.specs.seats}` },
      { '@type': 'PropertyValue', name: 'Antrieb', value: translateFuel(vehicle.specs.fuelType) },
      ...(vehicle.specs.range ? [{ '@type': 'PropertyValue', name: 'Reichweite', value: vehicle.specs.range }] : []),
      { '@type': 'PropertyValue', name: 'Baujahr', value: `${vehicle.year}` },
    ],
  };
}

// ─── Page Component (Server Component) ──────────────────────
export default async function VehicleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vehicle = await getVehicle(params.id);
  if (!vehicle) notFound();

  const featuresConfig = await getSetting('features');

  const displayName = `${vehicle.brand} ${vehicle.model}`;
  const specs = buildSpecsList(vehicle);
  const jsonLd = buildJsonLd(vehicle);

  return (
    <>
      {/* JSON-LD for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="bg-neutral-50 border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-neutral-500">
              <Link href="/" className="hover:text-brand-600 transition-colors">
                Startseite
              </Link>
              <span>/</span>
              <Link href="/#fleet" className="hover:text-brand-600 transition-colors">
                Flotte
              </Link>
              <span>/</span>
              <span className="text-neutral-900 font-medium">{displayName}</span>
            </nav>
          </div>
        </div>

        {/* Hero section */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Image Gallery */}
              <div>
                <VehicleImageGallery
                  images={vehicle.images}
                  thumbnailUrl={vehicle.thumbnailUrl}
                  alt={displayName}
                />
              </div>

              {/* Details */}
              <div className="flex flex-col">
                <div className="mb-2">
                  <span className="inline-block text-xs font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 px-3 py-1 rounded-full">
                    {translateType(vehicle.type)}
                  </span>
                  {!vehicle.isAvailable && (
                    <span className="inline-block ml-2 text-xs font-semibold text-amber-700 uppercase tracking-wider bg-amber-50 px-3 py-1 rounded-full">
                      Derzeit reserviert
                    </span>
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2">
                  {displayName}
                </h1>
                <p className="text-neutral-500 mb-6">Jahrgang {vehicle.year}</p>

                {/* Price badge */}
                <div className="bg-neutral-900 text-white rounded-2xl p-6 mb-8">
                  <div className="text-sm text-neutral-400 mb-1">Langzeitmiete ab</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{vehicle.currency} {vehicle.basePricePerDay}</span>
                    <span className="text-neutral-400 text-lg">/ Tag</span>
                  </div>
                  <p className="text-neutral-500 text-sm mt-2">
                    Preis sinkt automatisch bei längerer Mietdauer (bis 40% Rabatt)
                  </p>
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                      <div className="text-brand-600">{spec.icon}</div>
                      <div>
                        <div className="text-xs text-neutral-500">{spec.label}</div>
                        <div className="text-sm font-semibold text-neutral-900">{spec.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-auto space-y-3">
                  <a
                    href={`/#contact-form`}
                    className="block w-full text-center py-4 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
                  >
                    Unverbindlich anfragen
                  </a>
                  <Link
                    href="/#fleet"
                    className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück zur Flotte
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features / Trust Signals */}
        <FeaturesBar config={featuresConfig} />
      </main>

      <Footer />
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  clock: Clock,
  car: Car,
  zap: Zap,
  heart: Heart,
  star: Star,
  'check-circle': CheckCircle,
  truck: Truck,
};

const DEFAULT_FEATURES = [
  { icon: 'shield', title: 'Vollkasko inklusive', description: 'Premium-Versicherungsschutz ohne Zusatzkosten' },
  { icon: 'clock', title: 'Flexible Laufzeiten', description: 'Ab 1 Tag – bis zu 40% Rabatt bei Langzeitmiete' },
  { icon: 'car', title: 'Bestens gewartet', description: 'Jedes Fahrzeug wird vor der Übergabe geprüft' },
];

function FeaturesBar({ config }: { config?: { visible?: boolean; items?: { icon: string; title: string; description: string }[] } | null }) {
  if (config && config.visible === false) return null;
  const items = config?.items?.length ? config.items : DEFAULT_FEATURES;

  return (
    <section className="bg-neutral-50 border-y border-neutral-200 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 sm:grid-cols-${Math.min(items.length, 4)} gap-8 text-center`}>
          {items.map((item, idx) => {
            const Icon = ICON_MAP[item.icon] || Shield;
            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="bg-brand-50 p-3 rounded-xl mb-3">
                  <Icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-neutral-500">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function buildSpecsList(vehicle: VehicleDetail) {
  const specs = vehicle.specs;
  const items: { label: string; value: string; icon: React.ReactNode }[] = [];

  items.push({
    label: 'Leistung',
    value: `${specs.horsepower} PS`,
    icon: <Gauge className="w-5 h-5" />,
  });

  items.push({
    label: 'Getriebe',
    value: specs.transmission === 'automatic' ? 'Automatik' : 'Schaltgetriebe',
    icon: <Car className="w-5 h-5" />,
  });

  items.push({
    label: 'Sitze',
    value: `${specs.seats} Plätze`,
    icon: <Users className="w-5 h-5" />,
  });

  items.push({
    label: 'Antrieb',
    value: translateFuel(specs.fuelType),
    icon: specs.fuelType === 'electric' ? <Zap className="w-5 h-5" /> : <Fuel className="w-5 h-5" />,
  });

  if (specs.range) {
    items.push({
      label: 'Reichweite',
      value: specs.range,
      icon: <Zap className="w-5 h-5" />,
    });
  }

  items.push({
    label: 'Baujahr',
    value: `${vehicle.year}`,
    icon: <Calendar className="w-5 h-5" />,
  });

  return items;
}

function translateType(type: string): string {
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

function translateFuel(fuel: string): string {
  const labels: Record<string, string> = {
    petrol: 'Benzin',
    diesel: 'Diesel',
    electric: 'Elektrisch',
    hybrid: 'Hybrid',
  };
  return labels[fuel] || fuel;
}
