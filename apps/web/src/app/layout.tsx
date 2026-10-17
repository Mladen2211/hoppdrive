import type { Metadata } from 'next';
import { Fira_Sans } from 'next/font/google';
import './globals.css';
import { CookieConsentProvider } from '@/components/consent/CookieConsentProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { JsonLd } from '@/components/seo/JsonLd';
import { getSetting, getAllVehicles } from '@/lib/server-api';
import { SITE_URL, SITE_NAME, assetUrl } from '@/lib/seo';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HoppDrive – Günstige Autovermietung Schweiz | Mietwagen Ab CHF 59/Tag',
    template: '%s | HoppDrive',
  },
  description:
    'HoppDrive – Günstige Kurz- & Langzeitvermietung in der Schweiz. Škoda, VW, Toyota & mehr ab CHF 59/Tag. Bis 40% Langzeitrabatt. Vollkasko inklusive. Jetzt unverbindlich anfragen!',
  keywords: [
    'Autovermietung Schweiz',
    'günstige Mietwagen',
    'Langzeitmiete Auto Schweiz',
    'Kurzzeitmiete Auto',
    'Auto mieten günstig',
    'Škoda mieten Schweiz',
    'VW mieten Schweiz',
    'Mietwagen ab 59 CHF',
    'Autovermietung Langzeit Rabatt',
    'HoppDrive',
    'Kombi mieten',
    'SUV mieten günstig',
    'Familienauto mieten Schweiz',
    'car rental Switzerland',
    'cheap car rental Switzerland',
    'long term car rental',
    'Mietauto Schweiz',
    'Automiete Zürich',
    'Mietwagen Langzeit günstig',
    'Auto Langzeitmiete Vollkasko',
  ],
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
    title: 'HoppDrive – Günstige Autovermietung Schweiz | Ab CHF 59/Tag',
    description:
      'Günstige Kurz- & Langzeit-Autovermietung in der Schweiz. Škoda Superb, Octavia, VW Passat & mehr. Dynamische Preisgestaltung mit bis zu 40% Rabatt bei Langzeitmiete. Vollkasko inklusive.',
    type: 'website',
    locale: 'de_CH',
    url: SITE_URL,
    siteName: 'HoppDrive',
    images: [
      {
        url: `${SITE_URL}/og-default.jpg`,
        width: 1200,
        height: 630,
        alt: 'HoppDrive – Günstige Autovermietung Schweiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HoppDrive – Günstige Autovermietung Schweiz | Ab CHF 59/Tag',
    description:
      'Škoda, VW, Toyota & mehr ab CHF 59/Tag. Bis 40% Langzeitrabatt. Vollkasko inklusive.',
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

interface LocationSetting {
  address?: string;
  lat?: number;
  lng?: number;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location, vehicles] = await Promise.all([
    getSetting<LocationSetting>('location'),
    getAllVehicles(),
  ]);

  const prices = vehicles.map((v) => v.basePricePerDay);
  const priceRange = prices.length > 0
    ? `CHF ${Math.min(...prices)} – CHF ${Math.max(...prices)} / Tag`
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
        logo: assetUrl('/logo-header.png'),
        image: assetUrl('/logo-header.png'),
        email: 'info@hoppdrive.ch',
        description:
          'Günstige Kurz- & Langzeitvermietung in der Schweiz. Škoda, VW, Toyota & mehr, inklusive Vollkasko.',
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
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: 'de-CH',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html lang="de-CH" className={firaSans.className}>
      <head>
        <JsonLd data={siteJsonLd} />
      </head>
      <body className="min-h-screen flex flex-col">
        <ErrorBoundary>
          <CookieConsentProvider>
            {children}
          </CookieConsentProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
