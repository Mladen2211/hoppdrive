import type { Metadata } from 'next';
import { Fira_Sans } from 'next/font/google';
import './globals.css';
import { CookieConsentProvider } from '@/components/consent/CookieConsentProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hoppdrive.ch';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HoppDrive – Günstige Autovermietung Schweiz | Mietwagen Ab CHF 59/Tag',
    template: '%s | HoppDrive – Autovermietung Schweiz',
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

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Was kostet die Miete bei HoppDrive?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Unsere Mietwagen starten ab CHF 59 pro Tag. Bei längerer Mietdauer profitieren Sie von automatischen Rabatten: 20% ab 8 Tagen und bis zu 40% ab 31 Tagen.',
        },
      },
      {
        '@type': 'Question',
        name: 'Ist eine Versicherung inklusive?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ja, bei jeder Anmietung ist eine Vollkasko-Versicherung inklusive. Es gibt keine versteckten Zusatzkosten für den Versicherungsschutz.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie lange kann ich ein Fahrzeug mieten?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie können unsere Fahrzeuge ab 1 Tag bis zu mehreren Monaten mieten. Je länger die Mietdauer, desto günstiger der Tagespreis.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche Dokumente brauche ich?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie benötigen einen gültigen Führerschein und einen Identitätsausweis (Pass oder ID). Bei der Übergabe wird ein Mietvertrag vor Ort unterschrieben.',
        },
      },
    ],
  };

  return (
    <html lang="de-CH" className={firaSans.className}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
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
