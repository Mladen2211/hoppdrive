import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { getServerTranslator } from '@/i18n/server';
import { RetryButton } from './RetryButton';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return {
    title: t('offline.metaTitle'),
    robots: { index: false, follow: false },
  };
}

/**
 * Fallback page of the service worker when a navigation fails (no connection). Public: no shell,
 * no data, no API calls. It is precached by public/sw.js together with its static assets (in the
 * language of the language cookie at install time).
 */
export default async function OfflinePage() {
  const { t } = await getServerTranslator();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-paper px-4 py-12 pb-[max(48px,env(safe-area-inset-bottom))] text-center font-sans text-ink">
      <Logo variant="horizontal" height={32} priority />
      <div className="flex max-w-[360px] flex-col items-center gap-3">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-20 bg-card text-graphite" aria-hidden="true">
          <WifiOff size={32} />
        </span>
        <h1 className="h2">{t('offline.title')}</h1>
        <p className="mut">{t('offline.text')}</p>
        <RetryButton />
      </div>
    </main>
  );
}
