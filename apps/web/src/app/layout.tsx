import type { Metadata } from 'next';
import { Fira_Sans } from 'next/font/google';
import './globals.css';
import { CookieConsentProvider } from '@/components/consent/CookieConsentProvider';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hoppdrive.ch';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HoppDrive – Günstige Autovermietung Schweiz | Ab CHF 59/Tag',
    template: '%s | HoppDrive',
  },
  description:
    'HoppDrive – Günstige Kurz- & Langzeitvermietung in der Schweiz. Škoda, VW, Toyota & mehr ab CHF 59/Tag. Je länger Sie mieten, desto günstiger – bis 40% Rabatt. Vollkasko inklusive.',
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
  alternates: {
    canonical: SITE_URL,
  },
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
    // Add your Google Search Console verification code here
    // google: 'your-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: 'HoppDrive',
    url: SITE_URL,
    logo: `${SITE_URL}/logo-header.png`,
    description:
      'Günstige Kurz- & Langzeitvermietung in der Schweiz. Škoda, VW, Toyota & mehr ab CHF 59/Tag.',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CH',
    },
    priceRange: 'CHF 59 – CHF 89 / Tag',
    areaServed: {
      '@type': 'Country',
      name: 'Schweiz',
    },
    sameAs: [],
  };

  return (
    <html lang="de-CH" className={firaSans.className}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <CookieConsentProvider>
          {children}
        </CookieConsentProvider>
      </body>
    </html>
  );
}
