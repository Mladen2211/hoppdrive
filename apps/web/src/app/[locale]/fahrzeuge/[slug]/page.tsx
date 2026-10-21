import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check, CheckCircle, ChevronLeft, Car, Clock, Heart, Shield, Star, Truck, Zap, type LucideIcon } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  getVehicle,
  getAllVehicles,
  getAllVehiclesOrThrow,
  getCurrency,
  getSetting,
  getPricingTiers,
  type VehicleDetail,
} from '@/lib/server-api';
import { VehicleCard } from '@/components/b2c/VehicleCard';
import { VehicleImageGallery } from '@/components/b2c/VehicleImageGallery';
import { VehicleBuyPanel, VehiclePricingProvider, VehicleStickyCta } from '@/components/b2c/VehicleDetailClient';
import { Badge, Button, Crumbs } from '@/components/ui';
import { Link, permanentRedirect } from '@/i18n/navigation';
import { htmlLang } from '@/i18n/locales';
import { isLocale } from '@/i18n/routing';
import type { Translate } from '@/i18n/types';
import { fmtMoney } from '@/lib/format';
import { sortImagesPrimaryFirst } from '@/lib/images';
import { maxDiscount, priceFor } from '@/lib/pricing';
import { specsList, toCardData } from '@/lib/vehicles';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  SITE_URL,
  CATEGORY_SLUGS,
  buildMetadata,
  assetUrl,
  categoryRent,
  isCategoryType,
  pageUrl,
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
 * The redirects stay inside the visitor's language (/en/vehicles/<slug>, ...).
 */
async function resolveVehicle(slugParam: string, locale: string): Promise<VehicleDetail | null> {
  if (UUID_RE.test(slugParam)) {
    const vehicle = await getVehicle(slugParam, locale);
    if (!vehicle) return null;
    permanentRedirect({ href: { pathname: '/fahrzeuge/[slug]', params: { slug: vehicleSlug(vehicle) } }, locale });
  }

  const hash = slugParam.slice(-8).toLowerCase();
  // The vehicle list is cached for 60s (see server-api.ts) and the fleet is
  // small, so matching by id-prefix here is cheap. Throws (rather than
  // returning []) when the API is down, so an outage can't 404 indexed pages.
  const vehicles = await getAllVehiclesOrThrow(locale);
  const match = vehicles.find((v) => v.id.slice(0, 8).toLowerCase() === hash);
  if (!match) return null;

  const canonicalSlug = vehicleSlug(match);
  if (canonicalSlug !== slugParam) {
    permanentRedirect({ href: { pathname: '/fahrzeuge/[slug]', params: { slug: canonicalSlug } }, locale });
  }

  const vehicle = await getVehicle(match.id, locale);
  if (!vehicle) {
    // At build time, render a 404 that the next revalidation (60s) heals,
    // rather than failing the whole deploy on a transient API error.
    if (process.env.NEXT_PHASE === 'phase-production-build') return null;
    throw new Error(`Vehicle ${match.id} listed but not loadable`);
  }
  return vehicle;
}

// ─── Static Params (ISR: pre-render all vehicle pages) ──────
// Called once per locale of app/[locale]/layout.tsx (all five languages). The slug does not
// depend on the language, and any slug that is not pre-rendered (e.g. a vehicle added after the
// build, or a build while the API was down) renders on demand and is then cached (ISR).
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const vehicles = await getAllVehicles(params.locale);
  return vehicles.map((v) => ({ slug: vehicleSlug(v) }));
}

/** Price text for titles, descriptions and prose: plain spaces, no decimals for whole amounts. `currency` = site currency setting. */
function priceText(vehicle: VehicleDetail, locale: string, currency: string): string {
  return fmtMoney(vehicle.basePricePerDay, { locale, currency, decimals: 'auto', plain: true });
}

// ─── SEO: Dynamic Metadata per Vehicle ──────────────────────
export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const { locale } = params;
  if (!isLocale(locale)) return {};
  setRequestLocale(locale);
  const [t, tLabels, currency] = await Promise.all([
    getTranslations({ locale, namespace: 'vehiclePage' }),
    getTranslations({ locale, namespace: 'labels' }),
    getCurrency(),
  ]);

  const vehicle = await resolveVehicle(params.slug, locale);
  if (!vehicle) {
    return { title: t('notFoundTitle') };
  }

  const name = `${vehicle.brand} ${vehicle.model}`;
  const price = priceText(vehicle, locale, currency);
  const title = t('metaTitle', { name, price });
  const description = t('metaDescription', {
    name,
    year: vehicle.year,
    type: translateType(vehicle.type, tLabels),
    hp: vehicle.specs.horsepower,
    seats: vehicle.specs.seats,
    price,
  });
  // Open Graph: the main image first (thumbnailUrl is the primary one).
  const image = vehicle.thumbnailUrl || sortImagesPrimaryFirst(vehicle.images)[0]?.url || null;

  return buildMetadata({
    locale,
    title,
    description,
    pathname: '/fahrzeuge/[slug]',
    params: { slug: vehicleSlug(vehicle) },
    image,
    imageAlt: t('imageAlt', { name }),
  });
}

// ─── JSON-LD Structured Data ────────────────────────────────
function buildJsonLd(vehicle: VehicleDetail, locale: string, currency: string, t: Translate, tLabels: Translate): object {
  const slug = vehicleSlug(vehicle);
  const url = pageUrl(locale, '/fahrzeuge/[slug]', { slug });
  const name = `${vehicle.brand} ${vehicle.model}`;

  // Main image first, then the admin's order (sortImagesPrimaryFirst copies, it never mutates the shared array).
  const sortedImages = sortImagesPrimaryFirst(vehicle.images);
  const images = sortedImages.length > 0
    ? sortedImages.map((img) => assetUrl(img.url)).filter((u): u is string => !!u)
    : [assetUrl(vehicle.thumbnailUrl)].filter((u): u is string => !!u);

  return {
    '@context': 'https://schema.org',
    '@type': ['Product', 'Car'],
    name,
    description: t('jsonldDescription', {
      name,
      year: vehicle.year,
      type: translateType(vehicle.type, tLabels),
      hp: vehicle.specs.horsepower,
      price: priceText(vehicle, locale, currency),
    }),
    inLanguage: htmlLang(locale),
    brand: {
      '@type': 'Brand',
      name: vehicle.brand,
    },
    model: vehicle.model,
    vehicleModelDate: `${vehicle.year}`,
    fuelType: translateFuel(vehicle.specs.fuelType, tLabels),
    vehicleTransmission: translateTransmission(vehicle.specs.transmission, tLabels),
    vehicleSeatingCapacity: vehicle.specs.seats,
    vehicleEngine: {
      '@type': 'EngineSpecification',
      enginePower: {
        '@type': 'QuantitativeValue',
        value: vehicle.specs.horsepower,
        unitText: t('unitHp'),
      },
    },
    image: images,
    url,
    category: translateType(vehicle.type, tLabels),
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      price: vehicle.basePricePerDay,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: vehicle.basePricePerDay,
        priceCurrency: currency,
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
      { '@type': 'PropertyValue', name: t('propPower'), value: tLabels('spec.hp', { hp: vehicle.specs.horsepower }) },
      { '@type': 'PropertyValue', name: t('propTransmission'), value: translateTransmission(vehicle.specs.transmission, tLabels) },
      { '@type': 'PropertyValue', name: t('propSeats'), value: `${vehicle.specs.seats}` },
      { '@type': 'PropertyValue', name: t('propDrive'), value: translateFuel(vehicle.specs.fuelType, tLabels) },
      ...(vehicle.specs.range ? [{ '@type': 'PropertyValue', name: t('propRange'), value: vehicle.specs.range }] : []),
      { '@type': 'PropertyValue', name: t('propYear'), value: `${vehicle.year}` },
    ],
  };
}

// ─── Breadcrumb Structured Data ──────────────────────────────
function buildBreadcrumbJsonLd(vehicle: VehicleDetail, locale: string, t: Translate, tCategory: Translate): object {
  const type = isCategoryType(vehicle.type) ? vehicle.type : null;
  const items = [
    { '@type': 'ListItem', position: 1, name: t('crumbHome'), item: pageUrl(locale, '/') },
    { '@type': 'ListItem', position: 2, name: t('crumbFleet'), item: pageUrl(locale, '/fahrzeuge') },
  ];
  let position = 3;
  if (type) {
    items.push({
      '@type': 'ListItem',
      position,
      name: categoryRent(type, tCategory),
      item: pageUrl(locale, '/mieten/[kategorie]', { kategorie: CATEGORY_SLUGS[type] }),
    });
    position += 1;
  }
  items.push({
    '@type': 'ListItem',
    position,
    name: `${vehicle.brand} ${vehicle.model}`,
    item: pageUrl(locale, '/fahrzeuge/[slug]', { slug: vehicleSlug(vehicle) }),
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
  params: { locale: string; slug: string };
}) {
  const { locale } = params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [t, tLabels, tCategory, tCard] = await Promise.all([
    getTranslations({ locale, namespace: 'vehiclePage' }),
    getTranslations({ locale, namespace: 'labels' }),
    getTranslations({ locale, namespace: 'category' }),
    getTranslations({ locale, namespace: 'vehicleCard' }),
  ]);

  const vehicle = await resolveVehicle(params.slug, locale);
  if (!vehicle) notFound();

  const [featuresConfig, tiers, allVehicles, currency] = await Promise.all([
    getSetting('features', locale),
    getPricingTiers(),
    getAllVehicles(locale),
    getCurrency(),
  ]);

  const displayName = `${vehicle.brand} ${vehicle.model}`;
  const categoryType = isCategoryType(vehicle.type) ? vehicle.type : null;
  const available = vehicle.availableNow ?? vehicle.isAvailable;
  const specs = buildSpecsList(vehicle, t, tLabels);
  const jsonLd = buildJsonLd(vehicle, locale, currency, t, tLabels);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(vehicle, locale, t, tCategory);

  // Price examples (1 / 7 / 30 days) computed with the day tiers, the same maths as the API.
  const priceExamples = [1, 7, 30]
    .map((days) => ({ days, result: priceFor(vehicle.basePricePerDay, days, tiers) }))
    .filter((entry): entry is { days: number; result: NonNullable<typeof entry.result> } => entry.result !== null);

  // Similar vehicles: same type first, then the rest of the fleet.
  const others = allVehicles.filter((v) => v.id !== vehicle.id);
  const similar = [...others.filter((v) => v.type === vehicle.type), ...others.filter((v) => v.type !== vehicle.type)]
    .slice(0, 4)
    .map((v) => toCardData(v, currency));

  const features: { icon: string; title: string; description: string }[] | null =
    featuresConfig && featuresConfig.visible === false
      ? null
      : featuresConfig?.items?.length
        ? featuresConfig.items
        : defaultFeatures(t);

  const discount = maxDiscount(tiers);

  return (
    <VehiclePricingProvider vehicleId={vehicle.id} basePricePerDay={vehicle.basePricePerDay} tiers={tiers}>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <Navbar />

      <main className="flex-1">
        {/* Breadcrumb (small screens: just the way back) */}
        <section className="pt-7 max-md:pt-3.5">
          <div className="wrap">
            <Crumbs
              className="max-md:hidden"
              items={[
                { label: t('crumbHome'), href: '/' },
                { label: t('crumbFleet'), href: '/fahrzeuge' },
                ...(categoryType
                  ? [{ label: categoryRent(categoryType, tCategory), href: `/mieten/${CATEGORY_SLUGS[categoryType]}` }]
                  : []),
                { label: displayName },
              ]}
            />
            <Link
              href="/fahrzeuge"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-graphite no-underline hover:text-ruby md:hidden"
            >
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />
              {t('backToFleet')}
            </Link>
          </div>
        </section>

        {/* Gallery + price card */}
        <section className="pb-[72px] pt-6 max-md:pb-9 max-md:pt-1">
          <div className="wrap">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-12 max-lg:grid-cols-1 max-lg:gap-5">
              <VehicleImageGallery
                images={vehicle.images}
                thumbnailUrl={vehicle.thumbnailUrl}
                alt={displayName}
                vehicle={vehicle}
                badge={<Badge tone={available ? 'ok' : 'off'}>{available ? tCard('available') : tCard('reserved')}</Badge>}
              />
              <VehicleBuyPanel
                name={displayName}
                meta={`${translateType(vehicle.type, tLabels)} · ${vehicle.year}`}
                specLine={specsList(vehicle.specs, tLabels)}
                available={available}
              />
            </div>
          </div>
        </section>

        {/* Technische Daten + Im Preis enthalten */}
        <section className="bg-white py-[72px] max-md:bg-transparent max-md:pb-9 max-md:pt-0">
          <div className="wrap">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-12 max-lg:grid-cols-1 max-lg:gap-9">
              <div className="min-w-0">
                <h2 className="h2 mb-7 max-md:mb-3 max-md:!text-[22px]">{t('specsTitle')}</h2>
                <dl className="m-0 grid grid-cols-3 border-t border-line max-md:grid-cols-2">
                  {specs.map((spec) => (
                    <div key={spec.label} className="border-b border-line py-5 max-md:py-3.5">
                      <dt className="text-sm text-graphite">{spec.label}</dt>
                      <dd className="num m-0 mt-1 text-2xl font-semibold max-md:text-[22px]">{spec.value}</dd>
                    </div>
                  ))}
                </dl>

                {vehicle.description && vehicle.description.trim() && (
                  <div className="mt-8">
                    <h3 className="h3 mb-2">{t('aboutTitle')}</h3>
                    <p className="max-w-[68ch] whitespace-pre-line leading-relaxed text-graphite">
                      {vehicle.description.trim()}
                    </p>
                  </div>
                )}

                {/* Citable prose + price examples — gives AI engines and featured snippets an
                    extractable passage instead of just a specs grid. */}
                <p className="mt-8 max-w-[68ch] leading-relaxed text-graphite">
                  {t('prose', {
                    name: displayName,
                    year: vehicle.year,
                    kind: categoryType ? t(`kind.${categoryType}`) : translateType(vehicle.type, tLabels),
                    hp: vehicle.specs.horsepower,
                    transmission:
                      vehicle.specs.transmission === 'automatic'
                        ? t('transmissionLongAutomatic')
                        : t('transmissionLongManual'),
                    seats: vehicle.specs.seats,
                    fuelSentence: fuelSentence(vehicle.specs.fuelType, vehicle.specs.range, t, tLabels),
                    price: priceText(vehicle, locale, currency),
                    discount: discount > 0 ? t('proseDiscount', { percent: discount }) : '',
                  })}
                </p>
              </div>

              <div className="min-w-0">
                {features && (
                  <>
                    <h2 className="h2 mb-7 max-md:mb-3 max-md:!text-[22px]">{t('includedTitle')}</h2>
                    <ul className="m-0 flex list-none flex-col gap-4 p-0 max-md:gap-3.5">
                      {features.map((item, idx) => {
                        const Icon = ICON_MAP[item.icon] || Check;
                        return (
                          <li key={`${item.title}-${idx}`} className="flex items-start gap-3">
                            <span className="flex-none text-ruby">
                              <Icon size={24} strokeWidth={2.4} aria-hidden="true" />
                            </span>
                            <span>
                              <b>{item.title}</b>
                              <br />
                              <span className="text-graphite">{item.description}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {priceExamples.length > 0 && (
                  <div className={features ? 'mt-9 rounded-18 border border-line p-5' : 'rounded-18 border border-line p-5'}>
                    <h2 className="mb-3 text-sm font-semibold">{t('examplesTitle')}</h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-graphite">
                          <th scope="col" className="py-1 font-medium">{t('exampleDuration')}</th>
                          <th scope="col" className="py-1 font-medium">{t('exampleTotal')}</th>
                          <th scope="col" className="py-1 font-medium">{t('exampleDiscount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceExamples.map(({ days, result }) => (
                          <tr key={days} className="border-t border-line">
                            <td className="py-2">{t('exampleDays', { days })}</td>
                            <td className="num py-2 font-semibold">
                              {fmtMoney(result.total, { locale, currency })}
                            </td>
                            <td className="py-2 text-graphite">{result.discountPercent > 0 ? `-${result.discountPercent}%` : '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Ähnliche Fahrzeuge */}
        {similar.length > 0 && (
          <section className="py-[72px] max-md:bg-white max-md:py-9">
            <div className="wrap">
              <div className="mb-7 flex items-end justify-between gap-4 max-md:mb-4">
                <h2 className="h2 max-md:!text-2xl">{t('similarTitle')}</h2>
                <Button href="/fahrzeuge" variant="ghost" className="max-md:hidden">
                  {t('similarAll')}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-lg:gap-5 max-md:-mr-5 max-md:flex max-md:gap-3.5 max-md:overflow-x-auto max-md:pb-2 max-md:pr-5">
                {similar.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} tiers={tiers} variant="compact" className="max-md:flex-[0_0_76%]" />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
      <VehicleStickyCta />
    </VehiclePricingProvider>
  );
}

// ─── Helpers ────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  shield: Shield,
  clock: Clock,
  car: Car,
  zap: Zap,
  heart: Heart,
  star: Star,
  'check-circle': CheckCircle,
  truck: Truck,
};

// Shown when the admin has not maintained the `features` setting (board copy).
function defaultFeatures(t: Translate) {
  return [
    { icon: 'check', title: t('defaultFeatures.coverTitle'), description: t('defaultFeatures.coverText') },
    { icon: 'check', title: t('defaultFeatures.maintenanceTitle'), description: t('defaultFeatures.maintenanceText') },
    { icon: 'check', title: t('defaultFeatures.extendTitle'), description: t('defaultFeatures.extendText') },
  ];
}

function buildSpecsList(vehicle: VehicleDetail, t: Translate, tLabels: Translate) {
  const specs = vehicle.specs;
  const items: { label: string; value: string }[] = [
    { label: t('specPower'), value: tLabels('spec.hp', { hp: specs.horsepower }) },
    { label: t('specTransmission'), value: translateTransmission(specs.transmission, tLabels) },
    { label: t('specSeats'), value: `${specs.seats}` },
    { label: t('specDrive'), value: translateFuel(specs.fuelType, tLabels) },
  ];
  if (specs.range) items.push({ label: t('specRange'), value: specs.range });
  items.push({ label: t('specYear'), value: `${vehicle.year}` });
  items.push({ label: t('specCategory'), value: translateType(vehicle.type, tLabels) });
  return items;
}

function fuelSentence(fuel: string, range: string | undefined, t: Translate, tLabels: Translate): string {
  switch (fuel) {
    case 'electric':
      return range ? t('fuelElectricRange', { range }) : t('fuelElectric');
    case 'hybrid':
      return t('fuelHybrid');
    case 'petrol':
      return t('fuelPetrol');
    case 'diesel':
      return t('fuelDiesel');
    default:
      return t('fuelOther', { fuel: translateFuel(fuel, tLabels) });
  }
}
