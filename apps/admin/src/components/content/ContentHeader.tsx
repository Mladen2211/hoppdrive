'use client';

/**
 * Shared header of the three content routes /testimonials, /faq and /locations
 * ("Bewertungen, FAQ und Standorte", Content-Lists board): title + segmented tab links with counts.
 * Below 768 px the mobile top bar already shows the title, so only the tabs remain.
 */
import { PageHeader, Tabs } from '@/components/ui';
import { useContentCounts, type ContentKey } from './useContentCounts';
import { useTranslations } from 'next-intl';

export interface ContentHeaderProps {
  active: ContentKey;
  /** Live count of the list shown on this page (keeps its tab badge exact). */
  ownCount: number | null;
}

export function ContentHeader({ active, ownCount }: ContentHeaderProps) {
  const t = useTranslations();
  const counts = useContentCounts({ key: active, count: ownCount });
  const tabs = [
    { id: 'testimonials', label: t('common.bewertungen'), count: counts.testimonials ?? undefined, href: '/testimonials' },
    { id: 'faq', label: 'FAQ', count: counts.faq ?? undefined, href: '/faq' },
    { id: 'locations', label: t('common.standorte'), count: counts.locations ?? undefined, href: '/locations' },
  ];

  return (
    <>
      <div className="max-md:hidden">
        <PageHeader
          title={t('content.bewertungenFAQUndStandorte')}
          subtitle={t('content.inhalteDieAufDer')}
          tabs={<Tabs aria-label={t('content.bereich')} tabs={tabs} value={active} />}
          tabsInline
        />
      </div>
      <div className="md:hidden">
        <h1 className="sr-only">{t('content.bewertungenFAQUndStandorte')}</h1>
        <Tabs aria-label={t('content.bereich')} tabs={tabs} value={active} className="w-full [&>a]:flex-1 [&>a]:justify-center" />
      </div>
    </>
  );
}
