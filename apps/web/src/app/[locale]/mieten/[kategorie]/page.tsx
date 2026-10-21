import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CategoryChips } from '@/components/b2c/CategoryChips';
import { FleetBrowser } from '@/components/b2c/FleetBrowser';
import { JsonLd } from '@/components/seo/JsonLd';
import { Crumbs } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { fmtMoney } from '@/lib/format';
import { getAllVehicles, getAllVehiclesOrThrow, getCurrency, getPricingTiers } from '@/lib/server-api';
import {
  buildMetadata,
  CATEGORY_SLUGS,
  CATEGORY_TYPES,
  categoryIntro,
  categoryRent,
  findCategoryType,
  pageUrl,
  vehicleSlug,
} from '@/lib/seo';
import { toCardData } from '@/lib/vehicles';

// Categories are prerendered from the fleet at build time (once per language, the slug is the
// same in all of them). Unknown slugs and categories without vehicles 404 at request time (no
// thin pages); this stays dynamic so a category gaining its first vehicle — or a build that ran
// while the API was down — doesn't leave the page 404 until the next deploy.

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const vehicles = await getAllVehicles(params.locale);
  const activeTypes = new Set(vehicles.map((v) => v.type));
  return CATEGORY_TYPES.filter((type) => activeTypes.has(type)).map((type) => ({ kategorie: CATEGORY_SLUGS[type] }));
}

export async function generateMetadata({ params }: { params: { locale: string; kategorie: string } }): Promise<Metadata> {
  const { locale } = params;
  if (!isLocale(locale)) return {};
  setRequestLocale(locale);
  const type = findCategoryType(params.kategorie);
  if (!type) return {};

  const [t, tCategory, vehicles, currency] = await Promise.all([
    getTranslations({ locale, namespace: 'categoryPage' }),
    getTranslations({ locale, namespace: 'category' }),
    getAllVehicles(locale),
    getCurrency(),
  ]);
  const categoryVehicles = vehicles.filter((v) => v.type === type);
  const minPrice = categoryVehicles.length > 0 ? Math.min(...categoryVehicles.map((v) => v.basePricePerDay)) : null;
  const category = categoryRent(type, tCategory);
  const price = minPrice !== null ? fmtMoney(minPrice, { locale, currency, decimals: 'auto', plain: true }) : null;

  return buildMetadata({
    locale,
    title: price ? t('titleWithPrice', { category, price }) : t('title', { category }),
    description: price ? t('descriptionWithPrice', { category, price }) : t('description', { category }),
    pathname: '/mieten/[kategorie]',
    params: { kategorie: CATEGORY_SLUGS[type] },
  });
}

export default async function CategoryPage({ params }: { params: { locale: string; kategorie: string } }) {
  const { locale } = params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const type = findCategoryType(params.kategorie);
  if (!type) notFound();

  const [t, tCategory, tIntro, tFleet, vehicles, tiers, currency] = await Promise.all([
    getTranslations({ locale, namespace: 'categoryPage' }),
    getTranslations({ locale, namespace: 'category' }),
    getTranslations({ locale, namespace: 'categoryIntro' }),
    getTranslations({ locale, namespace: 'fleetPage' }),
    getAllVehiclesOrThrow(locale),
    getPricingTiers(),
    getCurrency(),
  ]);
  const categoryVehicles = vehicles.filter((v) => v.type === type);
  if (categoryVehicles.length === 0) notFound();

  const slug = CATEGORY_SLUGS[type];
  const category = categoryRent(type, tCategory);
  const minPrice = Math.min(...categoryVehicles.map((v) => v.basePricePerDay));

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: categoryVehicles.map((v, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: pageUrl(locale, '/fahrzeuge/[slug]', { slug: vehicleSlug(v) }),
      name: `${v.brand} ${v.model}`,
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tFleet('crumbHome'), item: pageUrl(locale, '/') },
      { '@type': 'ListItem', position: 2, name: tFleet('crumbFleet'), item: pageUrl(locale, '/fahrzeuge') },
      {
        '@type': 'ListItem',
        position: 3,
        name: category,
        item: pageUrl(locale, '/mieten/[kategorie]', { kategorie: slug }),
      },
    ],
  };

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <Navbar />

      <main className="flex-1">
        <section className="pb-2 pt-8 max-md:pt-5">
          <div className="wrap">
            <Crumbs
              items={[
                { label: tFleet('crumbHome'), href: '/' },
                { label: tFleet('crumbFleet'), href: '/fahrzeuge' },
                { label: category },
              ]}
            />
            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 max-md:mt-2.5">
              <div className="flex max-w-[860px] flex-col gap-3 max-md:gap-2">
                <h1 className="disp !text-[44px] max-md:!text-[32px]">{t('title', { category })}</h1>
                <p className="lead max-w-[60ch]">{categoryIntro(type, tIntro)}</p>
                <p className="font-semibold">
                  {t.rich('priceLine', {
                    price: fmtMoney(minPrice, { locale, currency, decimals: 'auto' }),
                    num: (chunks) => <span className="num">{chunks}</span>,
                  })}
                </p>
                <Link
                  href="/fahrzeuge"
                  className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-ruby-dark no-underline hover:underline"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  {t('back')}
                </Link>
              </div>
              <CategoryChips vehicles={vehicles} current={type} className="max-lg:hidden" />
            </div>
          </div>
        </section>

        <section className="pb-[88px] pt-8 max-md:pb-10 max-md:pt-5">
          <div className="wrap">
            <FleetBrowser
              vehicles={categoryVehicles.map((v) => toCardData(v, currency))}
              tiers={tiers}
              chips={<CategoryChips vehicles={vehicles} current={type} scroll />}
            />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
