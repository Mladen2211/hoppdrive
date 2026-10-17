import type { Metadata } from 'next';
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
import { buildMetadata } from '@/lib/seo';
import {
  getAllVehicles,
  getSetting,
  getHomepageSections,
  getTestimonials,
  getFaqItems,
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

export async function generateMetadata(): Promise<Metadata> {
  const [seo, vehicles] = await Promise.all([
    getSetting<SeoSetting>('seo'),
    getAllVehicles(),
  ]);

  // "ab CHF X" always reflects the live fleet's cheapest vehicle rather than
  // a hard-coded number that drifts from reality as prices change.
  const minPrice = vehicles.length > 0 ? Math.min(...vehicles.map((v) => v.basePricePerDay)) : 59;

  const title = seo?.metaTitle
    || `HoppDrive – Günstige Autovermietung Schweiz | Mietwagen ab CHF ${minPrice}/Tag`;
  const description = seo?.metaDescription
    || `HoppDrive – Günstige Kurz- & Langzeitvermietung in der Schweiz. Škoda, VW, Toyota & mehr ab CHF ${minPrice}/Tag. Bis 40% Langzeitrabatt. Vollkasko inklusive. Jetzt unverbindlich anfragen!`;

  return buildMetadata({
    title,
    description,
    path: '/',
    image: seo?.ogImageUrl,
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const [vehicles, pricingConfig, sections, testimonials, faqItems, locationConfig] = await Promise.all([
    getAllVehicles(),
    getSetting('pricing'),
    getHomepageSections(),
    getTestimonials(),
    getFaqItems(),
    getSetting('location'),
  ]);

  const sectionMap: Record<string, Record<string, any>> = {};
  for (const s of sections) {
    sectionMap[s.sectionKey] = s.content;
  }

  const activeSections = sections.length > 0
    ? sections.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.sectionKey)
    : DEFAULT_SECTION_ORDER;

  const vehicleNames = vehicles.map((v) => `${v.brand} ${v.model}`);

  function renderSection(key: string) {
    const content = sectionMap[key] || {};
    switch (key) {
      case 'hero':
        return <HeroSection key={key} content={content} />;
      case 'why_hoppdrive':
        return <WhyHoppDrive key={key} content={content} />;
      case 'fleet':
        return <FleetSection key={key} vehicles={vehicles} content={content} />;
      case 'how_it_works':
        return <HowItWorks key={key} content={content} />;
      case 'pricing':
        return <PricingSection key={key} config={pricingConfig} content={content} />;
      case 'social_proof':
        return <SocialProof key={key} content={content} testimonials={testimonials} />;
      case 'faq':
        return <FaqSection key={key} content={content} items={faqItems} />;
      case 'contact':
        return <ContactForm key={key} vehicleNames={vehicleNames} content={content} />;
      case 'map':
        return <MapSection key={key} content={content} locationConfig={locationConfig} />;
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
        <SelectedVehicleProvider>
          {activeSections.map(renderSection)}
        </SelectedVehicleProvider>
      </main>
      <Footer />
    </>
  );
}
