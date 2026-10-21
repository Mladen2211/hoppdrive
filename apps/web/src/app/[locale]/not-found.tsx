import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/b2c/EmptyState';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui';

// A 404 keeps the site's default <title>; it must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <>
      <Navbar />
      <main className="flex flex-1 items-center justify-center py-16 max-md:py-10">
        <EmptyState
          as="h1"
          figure="404"
          title={t('heading')}
          text={t('text')}
          actions={
            <>
              <Button href="/fahrzeuge">{t('allVehicles')}</Button>
              <Button href="/" variant="ghost">
                {t('home')}
              </Button>
            </>
          }
        />
      </main>
      <Footer />
    </>
  );
}
