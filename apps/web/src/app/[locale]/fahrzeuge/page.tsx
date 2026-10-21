import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CategoryChips } from '@/components/b2c/CategoryChips';
import { FleetBrowser } from '@/components/b2c/FleetBrowser';
import { JsonLd } from '@/components/seo/JsonLd';
import { Crumbs } from '@/components/ui';
import { isLocale } from '@/i18n/routing';
import { getAllVehicles, getCurrency, getPricingTiers } from '@/lib/server-api';
import { buildMetadata, pageUrl, vehicleSlug } from '@/lib/seo';
import { toCardData } from '@/lib/vehicles';

export const revalidate = 3600;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'fleetPage' });
  return buildMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    pathname: '/fahrzeuge',
  });
}

export default async function FahrzeugeIndexPage({ params: { locale } }: { params: { locale: string } }) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, vehicles, tiers, currency] = await Promise.all([
    getTranslations({ locale, namespace: 'fleetPage' }),
    getAllVehicles(locale),
    getPricingTiers(),
    getCurrency(),
  ]);

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: vehicles.map((v, idx) => ({
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
      { '@type': 'ListItem', position: 1, name: t('crumbHome'), item: pageUrl(locale, '/') },
      { '@type': 'ListItem', position: 2, name: t('crumbFleet'), item: pageUrl(locale, '/fahrzeuge') },
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
            <Crumbs items={[{ label: t('crumbHome'), href: '/' }, { label: t('crumbFleet') }]} />
            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 max-md:mt-2.5">
              <div className="flex max-w-[860px] flex-col gap-3 max-md:gap-2">
                <h1 className="disp !text-[44px] max-md:!text-[32px]">{t('title')}</h1>
                <p className="lead max-w-[60ch]">{t('lead')}</p>
              </div>
              <CategoryChips vehicles={vehicles} current="all" className="max-lg:hidden" />
            </div>
          </div>
        </section>

        <section className="pb-[88px] pt-8 max-md:pb-10 max-md:pt-5">
          <div className="wrap">
            <FleetBrowser
              vehicles={vehicles.map((v) => toCardData(v, currency))}
              tiers={tiers}
              chips={<CategoryChips vehicles={vehicles} current="all" scroll />}
            />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
