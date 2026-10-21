import type { Metadata, Viewport } from 'next';
import { Fira_Sans, Fira_Sans_Condensed } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import '../globals.css';
import { CookieConsentProvider } from '@/components/consent/CookieConsentProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MaintenanceGate } from '@/components/layout/MaintenanceGate';
import { JsonLd } from '@/components/seo/JsonLd';
import { CurrencyProvider } from '@/i18n/CurrencyProvider';
import { htmlLang, ogLocale } from '@/i18n/locales';
import { pickClientMessages } from '@/i18n/messages';
import { localizedPath } from '@/i18n/paths';
import { LOCALES, isLocale } from '@/i18n/routing';
import { fmtMoney } from '@/lib/format';
import {
  getAllVehicles,
  getCompany,
  getCurrency,
  getMaintenanceMode,
  getPrimaryLocation,
  getSetting,
} from '@/lib/server-api';
import { SITE_URL, SITE_NAME, absoluteUrl, assetUrl, pageUrl } from '@/lib/seo';
import { resolveContactInfo } from '@/lib/site';

// `latin-ext` covers Š, ž, ü etc. (Škoda, Zürcher). 800 is used by the B2C display headline.
const firaSans = Fira_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
});

// Numbers and prices: Fira Sans Condensed (`font-cond` in Tailwind).
const firaCond = Fira_Sans_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-cond',
});

// The B2C site is not a PWA; the viewport only sets the browser UI colour.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
};

// One statically generated page tree per language (the pages add their own params on top).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const [t, vehicles, currency] = await Promise.all([
    getTranslations({ locale, namespace: 'meta' }),
    getAllVehicles(locale),
    getCurrency(),
  ]);

  // "ab CHF X" is the live minimum of the listed fleet in the site currency; without vehicles the
  // texts do not mention a price at all.
  const price =
    vehicles.length > 0
      ? fmtMoney(Math.min(...vehicles.map((v) => v.basePricePerDay)), { locale, currency, decimals: 'auto', plain: true })
      : null;
  const priced = (key: string, noPriceKey: string) => (price ? t(key, { price }) : t(noPriceKey));

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: priced('homeTitle', 'homeTitleNoPrice'),
      template: '%s | HoppDrive',
    },
    description: priced('homeDescription', 'homeDescriptionNoPrice'),
    keywords: t.raw('keywords') as string[],
    authors: [{ name: 'HoppDrive' }],
    creator: 'HoppDrive',
    publisher: 'HoppDrive',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    manifest: '/site.webmanifest',
    openGraph: {
      title: priced('ogTitle', 'ogTitleNoPrice'),
      description: t('ogDescription'),
      type: 'website',
      locale: ogLocale(locale),
      url: absoluteUrl(localizedPath(locale, '/')),
      siteName: 'HoppDrive',
      images: [
        {
          url: `${SITE_URL}/og-default.jpg`,
          width: 1200,
          height: 630,
          alt: t('ogImageAlt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: priced('ogTitle', 'ogTitleNoPrice'),
      description: priced('twitterDescription', 'twitterDescriptionNoPrice'),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
    },
  };
}

interface LocationSetting {
  address?: string;
  lat?: number;
  lng?: number;
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(locale)) notFound();
  // Enables static rendering for this locale (next-intl reads it instead of the request headers).
  setRequestLocale(locale);

  const [location, vehicles, currency, company, publicLocation, maintenance, messages, tCommon, tJson] = await Promise.all([
    getSetting<LocationSetting>('location', locale),
    getAllVehicles(locale),
    getCurrency(),
    getCompany(locale),
    getPrimaryLocation(),
    getMaintenanceMode(locale),
    getMessages(),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'jsonld' }),
  ]);
  const contact = resolveContactInfo({ company, location: publicLocation, locationSetting: location });
  // Free text from the admin, one entry per line ("Mo–Fr 08:00–18:00").
  const openingHours = (contact.hours ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const prices = vehicles.map((v) => v.basePricePerDay);
  const money = (value: number) => fmtMoney(value, { locale, currency, decimals: 'auto', plain: true });
  const priceRange = prices.length > 0
    ? tJson('priceRange', { min: money(Math.min(...prices)), max: money(Math.max(...prices)) })
    : undefined;

  // A single @graph so the organization and website nodes can reference
  // each other by @id instead of being re-declared (and risking drift) on
  // every page that needs to point back at them.
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AutoRental',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: assetUrl('/logos/logo-stacked.png'),
        image: assetUrl('/logos/logo-stacked.png'),
        email: 'info@hoppdrive.ch',
        // Only emitted when the admin maintains them (Einstellungen → Firma / Standorte).
        ...(contact.phone ? { telephone: contact.phone } : {}),
        ...(openingHours.length > 0 ? { openingHours: openingHours.length === 1 ? openingHours[0] : openingHours } : {}),
        description: tJson('organizationDescription'),
        address: {
          '@type': 'PostalAddress',
          ...(location?.address ? { streetAddress: location.address } : {}),
          addressCountry: 'CH',
        },
        ...(location?.lat && location?.lng ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: location.lat,
            longitude: location.lng,
          },
        } : {}),
        ...(priceRange ? { priceRange } : {}),
        areaServed: 'CH',
        sameAs: [],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: pageUrl(locale, '/'),
        name: SITE_NAME,
        inLanguage: htmlLang(locale),
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html lang={htmlLang(locale)} className={`${firaSans.variable} ${firaCond.variable} ${firaSans.className}`}>
      <head>
        <JsonLd data={siteJsonLd} />
      </head>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider locale={locale} messages={pickClientMessages(messages)} timeZone="Europe/Zurich">
          <CurrencyProvider currency={currency}>
            <ErrorBoundary
              fallback={
                <div className="py-16 text-center text-neutral-500">
                  <p className="text-sm">{tCommon('errorBoundary')}</p>
                </div>
              }
            >
              <CookieConsentProvider>
                <MaintenanceGate
                  enabled={maintenance?.enabled === true}
                  message={maintenance?.message}
                  email={contact.email}
                >
                  {children}
                </MaintenanceGate>
              </CookieConsentProvider>
            </ErrorBoundary>
          </CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
