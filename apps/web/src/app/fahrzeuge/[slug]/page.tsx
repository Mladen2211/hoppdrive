import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Car, Fuel, Gauge, Users, Zap, Calendar, Shield, Clock, Heart, Star, CheckCircle, Truck } from 'lucide-react';
import { getVehicle, getAllVehicles, getAllVehiclesOrThrow, getSetting, getPricingQuote, type VehicleDetail } from '@/lib/server-api';
import { VehicleImageGallery } from '@/components/b2c/VehicleImageGallery';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  SITE_URL,
  SITE_NAME,
  CATEGORIES,
  buildMetadata,
  assetUrl,
  vehicleSlug,
  translateType,
  translateFuel,
  translateTransmission,
} from '@/lib/seo';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a /fahrzeuge/[slug] param to a vehicle, handling three cases:
 * 1. A full UUID (old/indexed URL) → 308 redirect to the slug URL, so link
 *    equity from old links carries over.
 * 2. A slug whose trailing 8-char hash matches a vehicle, but the slug text
 *    itself is stale (e.g. the model was renamed in the admin) → 308
 *    redirect to the current canonical slug.
 * 3. The canonical slug → return the vehicle.
 * No match at any step → null (caller calls notFound()).
 */
async function resolveVehicle(slugParam: string): Promise<VehicleDetail | null> {
  if (UUID_RE.test(slugParam)) {
    const vehicle = await getVehicle(slugParam);
    if (!vehicle) return null;
    permanentRedirect(`/fahrzeuge/${vehicleSlug(vehicle)}`);
  }

  const hash = slugParam.slice(-8).toLowerCase();
  // The vehicle list is cached for 60s (see server-api.ts) and the fleet is
  // small, so matching by id-prefix here is cheap. Throws (rather than
  // returning []) when the API is down, so an outage can't 404 indexed pages.
  const vehicles = await getAllVehiclesOrThrow();
  const match = vehicles.find((v) => v.id.slice(0, 8).toLowerCase() === hash);
  if (!match) return null;

  const canonicalSlug = vehicleSlug(match);
  if (canonicalSlug !== slugParam) {
    permanentRedirect(`/fahrzeuge/${canonicalSlug}`);
  }

  const vehicle = await getVehicle(match.id);
  if (!vehicle) {
    // At build time, render a 404 that the next revalidation (60s) heals,
    // rather than failing the whole deploy on a transient API error.
    if (process.env.NEXT_PHASE === 'phase-production-build') return null;
    throw new Error(`Vehicle ${match.id} listed but not loadable`);
  }
  return vehicle;
}

// ─── Static Params (ISR: pre-render all vehicle pages) ──────
export async function generateStaticParams() {
  const vehicles = await getAllVehicles();
  return vehicles.map((v) => ({ slug: vehicleSlug(v) }));
}

// ─── SEO: Dynamic Metadata per Vehicle ──────────────────────
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const vehicle = await resolveVehicle(params.slug);
  if (!vehicle) {
    return { title: 'Fahrzeug nicht gefunden' };
  }

  const title = `${vehicle.brand} ${vehicle.model} mieten ab CHF ${vehicle.basePricePerDay}/Tag`;
  const description = `${vehicle.brand} ${vehicle.model} (${vehicle.year}) günstig mieten – ${translateType(vehicle.type)} mit ${vehicle.specs.horsepower} PS, ${vehicle.specs.seats} Sitzen. Ab CHF ${vehicle.basePricePerDay}/Tag, bis 40% Langzeitrabatt. Vollkasko inklusive. Jetzt unverbindlich anfragen bei HoppDrive.`;
  const image = vehicle.thumbnailUrl || vehicle.images[0]?.url || null;

  return buildMetadata({
    title,
    description,
    path: `/fahrzeuge/${vehicleSlug(vehicle)}`,
    image,
    imageAlt: `${vehicle.brand} ${vehicle.model} – HoppDrive Langzeitvermietung`,
  });
}

// ─── JSON-LD Structured Data ────────────────────────────────
function buildJsonLd(vehicle: VehicleDetail): object {
  const slug = vehicleSlug(vehicle);
  const url = `${SITE_URL}/fahrzeuge/${slug}`;

  // Copy before sorting — the previous version sorted `vehicle.images` in
  // place, mutating a value shared with the rest of the page render.
  const sortedImages = [...vehicle.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const images = sortedImages.length > 0
    ? sortedImages.map((img) => assetUrl(img.url)).filter((u): u is string => !!u)
    : [assetUrl(vehicle.thumbnailUrl)].filter((u): u is string => !!u);

  return {
    '@context': 'https://schema.org',
    '@type': ['Product', 'Car'],
    name: `${vehicle.brand} ${vehicle.model}`,
    description: `${vehicle.brand} ${vehicle.model} (${vehicle.year}) günstig mieten in der Schweiz. ${translateType(vehicle.type)} mit ${vehicle.specs.horsepower} PS. Ab CHF ${vehicle.basePricePerDay}/Tag.`,
    brand: {
      '@type': 'Brand',
      name: vehicle.brand,
    },
    model: vehicle.model,
    vehicleModelDate: `${vehicle.year}`,
    fuelType: translateFuel(vehicle.specs.fuelType),
    vehicleTransmission: translateTransmission(vehicle.specs.transmission),
    vehicleSeatingCapacity: vehicle.specs.seats,
    vehicleEngine: {
      '@type': 'EngineSpecification',
      enginePower: {
        '@type': 'QuantitativeValue',
        value: vehicle.specs.horsepower,
        unitText: 'PS',
      },
    },
    image: images,
    url,
    category: translateType(vehicle.type),
    offers: {
      '@type': 'Offer',
      priceCurrency: vehicle.currency,
      price: vehicle.basePricePerDay,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: vehicle.basePricePerDay,
        priceCurrency: vehicle.currency,
        unitCode: 'DAY',
      },
      priceValidUntil: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
      availability: vehicle.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url,
      offeredBy: { '@id': `${SITE_URL}/#organization` },
      seller: { '@id': `${SITE_URL}/#organization` },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Leistung', value: `${vehicle.specs.horsepower} PS` },
      { '@type': 'PropertyValue', name: 'Getriebe', value: translateTransmission(vehicle.specs.transmission) },
      { '@type': 'PropertyValue', name: 'Sitze', value: `${vehicle.specs.seats}` },
      { '@type': 'PropertyValue', name: 'Antrieb', value: translateFuel(vehicle.specs.fuelType) },
      ...(vehicle.specs.range ? [{ '@type': 'PropertyValue', name: 'Reichweite', value: vehicle.specs.range }] : []),
      { '@type': 'PropertyValue', name: 'Baujahr', value: `${vehicle.year}` },
    ],
  };
}

// ─── Breadcrumb Structured Data ──────────────────────────────
function buildBreadcrumbJsonLd(vehicle: VehicleDetail): object {
  const category = CATEGORIES[vehicle.type as keyof typeof CATEGORIES];
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Startseite', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Fahrzeuge', item: `${SITE_URL}/fahrzeuge` },
  ];
  let position = 3;
  if (category) {
    items.push({ '@type': 'ListItem', position, name: `${category.label} mieten`, item: `${SITE_URL}/mieten/${category.slug}` });
    position += 1;
  }
  items.push({
    '@type': 'ListItem',
    position,
    name: `${vehicle.brand} ${vehicle.model}`,
    item: `${SITE_URL}/fahrzeuge/${vehicleSlug(vehicle)}`,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

// ─── Page Component (Server Component) ──────────────────────
export default async function VehicleDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const vehicle = await resolveVehicle(params.slug);
  if (!vehicle) notFound();

  const [featuresConfig, quote1, quote7, quote30] = await Promise.all([
    getSetting('features'),
    getPricingQuote(vehicle.id, 1),
    getPricingQuote(vehicle.id, 7),
    getPricingQuote(vehicle.id, 30),
  ]);

  const displayName = `${vehicle.brand} ${vehicle.model}`;
  const category = CATEGORIES[vehicle.type as keyof typeof CATEGORIES];
  const specs = buildSpecsList(vehicle);
  const jsonLd = buildJsonLd(vehicle);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(vehicle);
  const priceQuotes = (
    [
      quote1 ? { days: 1, ...quote1 } : null,
      quote7 ? { days: 7, ...quote7 } : null,
      quote30 ? { days: 30, ...quote30 } : null,
    ] as const
  ).filter((q): q is NonNullable<typeof q> => q !== null);

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

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
              <Link href="/fahrzeuge" className="hover:text-brand-600 transition-colors">
                Fahrzeuge
              </Link>
              {category && (
                <>
                  <span>/</span>
                  <Link href={`/mieten/${category.slug}`} className="hover:text-brand-600 transition-colors">
                    {category.label} mieten
                  </Link>
                </>
              )}
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
                    href="/fahrzeuge"
                    className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück zur Flotte
                  </Link>
                </div>
              </div>
            </div>

            {/* Citable prose + price-example table — gives AI engines and
                featured snippets an extractable passage instead of just a
                specs grid, and fixes the page's otherwise-thin content. */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <p className="text-neutral-600 leading-relaxed">
                Der {vehicle.brand} {vehicle.model} ({vehicle.year}) ist {categoryArticle(vehicle.type)}{' '}
                {translateType(vehicle.type)} mit {vehicle.specs.horsepower} PS,{' '}
                {vehicle.specs.transmission === 'automatic' ? 'Automatikgetriebe' : 'Schaltgetriebe'} und {vehicle.specs.seats} Sitzen.{' '}
                {fuelSentence(vehicle.specs.fuelType, vehicle.specs.range)}{' '}
                Mietpreis ab CHF {vehicle.basePricePerDay} pro Tag, bei längerer Mietdauer sinkt der Tagespreis
                automatisch um bis zu 40% – Vollkasko-Versicherung und Pannenhilfe sind immer inklusive.
              </p>

              {priceQuotes.length > 0 && (
                <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5">
                  <h2 className="text-sm font-semibold text-neutral-900 mb-3">Preisbeispiele</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="font-medium py-1">Mietdauer</th>
                        <th className="font-medium py-1">Gesamtpreis</th>
                        <th className="font-medium py-1">Rabatt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceQuotes.map((q) => (
                        <tr key={q.days} className="border-t border-neutral-200">
                          <td className="py-2 text-neutral-700">{q.days} Tag{q.days > 1 ? 'e' : ''}</td>
                          <td className="py-2 font-semibold text-neutral-900">{q.currency} {q.totalPrice}</td>
                          <td className="py-2 text-neutral-500">{q.discountPercent > 0 ? `-${q.discountPercent}%` : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
    value: translateTransmission(specs.transmission),
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

// "ein SUV" vs "eine Limousine" — German articles don't follow a fixed
// grammatical gender rule across these category nouns, so it's a lookup
// rather than a heuristic. Only "Limousine" (die) is feminine; the rest
// (der/das nouns) take "ein".
function categoryArticle(type: string): string {
  return type === 'sedan' ? 'eine' : 'ein';
}

function fuelSentence(fuel: string, range?: string): string {
  switch (fuel) {
    case 'electric':
      return range ? `Er fährt rein elektrisch mit einer Reichweite von ${range}.` : 'Er fährt rein elektrisch.';
    case 'hybrid':
      return 'Er verfügt über einen sparsamen Hybridantrieb.';
    default:
      return `Er fährt mit ${translateFuel(fuel)}.`;
  }
}
