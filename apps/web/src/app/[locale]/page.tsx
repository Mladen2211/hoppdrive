import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/b2c/HeroSection';
import { WhyHoppDrive } from '@/components/b2c/WhyHoppDrive';
import { HowItWorks } from '@/components/b2c/HowItWorks';
import { FleetSection } from '@/components/b2c/FleetSection';
import { PricingSection } from '@/components/b2c/PricingSection';
import { SocialProof } from '@/components/b2c/SocialProof';
import { FaqSection } from '@/components/b2c/FaqSection';
import { ContactForm } from '@/components/b2c/ContactForm';
import { MapSection } from '@/components/b2c/MapSection';
import { SelectedVehicleProvider } from '@/components/b2c/SelectedVehicleContext';
import { JsonLd } from '@/components/seo/JsonLd';
import { isLocale } from '@/i18n/routing';
import { fmtMoney } from '@/lib/format';
import { buildMetadata, vehicleSlug } from '@/lib/seo';
import { maxDiscount } from '@/lib/pricing';
import { resolveContactInfo, type LocationSetting } from '@/lib/site';
import { minPrice as cheapest, silhouetteFor, toCardData, toVehicleOption, vehicleName } from '@/lib/vehicles';
import {
  getAllVehicles,
  getCompany,
  getCurrency,
  getFaqItems,
  getHomepageSections,
  getPricingTiers,
  getPrimaryLocation,
  getSetting,
  getTestimonials,
} from '@/lib/server-api';

// Fallback order if the CMS hasn't defined any sections yet.
const DEFAULT_SECTION_ORDER = [
  'hero', 'why_hoppdrive', 'fleet', 'how_it_works', 'pricing',
  'social_proof', 'faq', 'contact', 'map',
];

interface SeoSetting {
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
}

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  setRequestLocale(locale);
  const [seo, vehicles, currency, t] = await Promise.all([
    getSetting<SeoSetting>('seo', locale),
    getAllVehicles(locale),
    getCurrency(),
    getTranslations({ locale, namespace: 'meta' }),
  ]);

  // "ab CHF X" always reflects the live fleet's cheapest vehicle (in the site currency) rather than
  // a hard-coded number that drifts from reality as prices change. Without vehicles: no price text.
  const price =
    vehicles.length > 0
      ? fmtMoney(Math.min(...vehicles.map((v) => v.basePricePerDay)), { locale, currency, decimals: 'auto', plain: true })
      : null;

  const title = seo?.metaTitle || (price ? t('homeTitle', { price }) : t('homeTitleNoPrice'));
  const description =
    seo?.metaDescription || (price ? t('homeDescription', { price }) : t('homeDescriptionNoPrice'));

  return buildMetadata({
    locale,
    title,
    description,
    pathname: '/',
    image: seo?.ogImageUrl,
    absoluteTitle: true,
  });
}

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [vehicles, currency, pricingConfig, sections, testimonials, faqItems, locationConfig, tiers, company, publicLocation] =
    await Promise.all([
      getAllVehicles(locale),
      getCurrency(),
      getSetting('pricing', locale),
      getHomepageSections(locale),
      getTestimonials(locale),
      getFaqItems(locale),
      getSetting<LocationSetting>('location', locale),
      getPricingTiers(),
      getCompany(locale),
      getPrimaryLocation(),
    ]);

  const sectionMap: Record<string, Record<string, any>> = {};
  for (const s of sections) {
    sectionMap[s.sectionKey] = s.content;
  }

  const activeSections = sections.length > 0
    ? sections.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.sectionKey)
    : DEFAULT_SECTION_ORDER;

  // Slim data for the client components (no image lists, timestamps, ...).
  const cards = vehicles.map((v) => toCardData(v, currency));
  const options = cards.map(toVehicleOption);
  const minPrice = cheapest(cards);
  // Hero carousel: one slide per listed vehicle (its main image, or the silhouette until a photo is uploaded).
  const heroSlides = cards.map((v) => ({
    id: v.id,
    name: vehicleName(v),
    slug: vehicleSlug(v),
    imageUrl: v.thumbnailUrl || null,
    silhouette: silhouetteFor(v.type),
    price: v.basePricePerDay,
  }));
  const contact = resolveContactInfo({ company, location: publicLocation, locationSetting: locationConfig });

  function renderSection(key: string) {
    const content = sectionMap[key] || {};
    switch (key) {
      case 'hero':
        return (
          <HeroSection
            key={key}
            content={content}
            minPrice={minPrice}
            maxDiscount={maxDiscount(tiers)}
            showQuickBar={cards.length > 0}
            slides={heroSlides}
            currency={currency}
          />
        );
      case 'why_hoppdrive':
        return <WhyHoppDrive key={key} content={content} minPrice={minPrice} currency={currency} />;
      case 'fleet':
        return <FleetSection key={key} vehicles={cards} content={content} />;
      case 'how_it_works':
        return <HowItWorks key={key} content={content} />;
      case 'pricing':
        return <PricingSection key={key} config={pricingConfig} content={content} />;
      case 'social_proof':
        return <SocialProof key={key} content={content} testimonials={testimonials} />;
      case 'faq':
        return (
          <FaqSection key={key} content={content} items={faqItems} minPrice={minPrice} tiers={tiers} currency={currency} />
        );
      case 'contact':
        return <ContactForm key={key} content={content} contactEmail={contact.email} />;
      case 'map':
        return <MapSection key={key} content={content} locationConfig={locationConfig} contact={contact} />;
      default:
        return null;
    }
  }

  // FAQ structured data built from the same live data rendered in the accordion above —
  // one source of truth, so schema and visible content can no longer drift.
  const faqJsonLd = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null;

  // NOTE: the previous AggregateRating/Review markup on a self-declared
  // "HoppDrive" Product was removed — Google's guidelines don't allow a
  // business marking up its own on-site testimonials as third-party review
  // rich-result data, and doing so risks a manual action. The testimonials
  // stay visible in the SocialProof section; only the schema was dropped.

  return (
    <>
      {faqJsonLd && <JsonLd data={faqJsonLd} />}

      <Navbar />
      <main className="flex-1">
        <SelectedVehicleProvider vehicles={options} tiers={tiers}>
          {activeSections.map(renderSection)}
        </SelectedVehicleProvider>
      </main>
      <Footer />
    </>
  );
}
