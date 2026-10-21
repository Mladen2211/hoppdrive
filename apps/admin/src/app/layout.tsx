import type { Metadata, Viewport } from 'next';
import { Fira_Sans, Fira_Sans_Condensed } from 'next/font/google';
import { Providers } from '@/components/shell/Providers';
import { HTML_LANG } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { getServerLocale, getServerTranslator } from '@/i18n/server';
import { THEME_COLORS, themeInitScript } from '@/lib/theme';
import './globals.css';

// `latin-ext` covers Š, ž, ü etc. (Škoda, Zürcher).
const firaSans = Fira_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
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

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    applicationName: 'HoppDrive Admin',
    robots: { index: false, follow: false },
    // The web app manifest (app/manifest.ts) is linked automatically.
    appleWebApp: {
      capable: true,
      title: 'HoppDrive',
      statusBarStyle: 'default',
    },
    formatDetection: { telephone: false },
    other: { 'mobile-web-app-capable': 'yes' },
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
  };
}

export const viewport: Viewport = {
  // Light value; the theme script / ThemeProvider switch it to THEME_COLORS.dark in dark mode.
  themeColor: THEME_COLORS.light,
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getServerLocale();
  const messages = locale === 'de' ? undefined : await loadMessages(locale);
  return (
    // data-theme is set by the inline script below before first paint, hence suppressHydrationWarning.
    <html
      lang={HTML_LANG[locale]}
      data-theme="light"
      suppressHydrationWarning
      className={`${firaSans.variable} ${firaCond.variable} ${firaSans.className}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
