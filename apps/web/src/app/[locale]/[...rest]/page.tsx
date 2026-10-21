import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/routing';

/**
 * Catch-all for every URL that is not a known page. It exists so that unknown paths render the
 * localised app/[locale]/not-found.tsx inside the normal layout (a plain app/not-found.tsx
 * would have no locale). The status is 404.
 */
export default function CatchAllPage({ params: { locale } }: { params: { locale: string } }) {
  if (isLocale(locale)) setRequestLocale(locale);
  notFound();
}
