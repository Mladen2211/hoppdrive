import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UnsubscribeFlow } from '@/components/b2c/UnsubscribeFlow';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo';

/**
 * Unsubscribe page of the marketing mails. The public URL is localised (/abmelden, /en/unsubscribe,
 * /fr/desabonnement, /it/annulla-iscrizione, /hr/odjava; see src/i18n/routing.ts) and the mails link to
 * it as `<url>?token=<unsubscribeToken>`. The token is read in the browser (UnsubscribeFlow), so the
 * page itself stays static; texts: messages/<locale>.json -> `unsubscribe`.
 */
export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'unsubscribe' });
  return {
    ...buildMetadata({
      locale,
      title: t('metaTitle'),
      description: t('metaDescription'),
      pathname: '/abmelden',
    }),
    // A page behind a personal token link has no business in search results.
    robots: { index: false, follow: false },
  };
}

export default async function UnsubscribePage({ params: { locale } }: { params: { locale: string } }) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <Navbar />
      <main className="flex flex-1 items-center py-16 max-md:py-10">
        <div className="wrap w-full">
          <UnsubscribeFlow />
        </div>
      </main>
      <Footer />
    </>
  );
}
