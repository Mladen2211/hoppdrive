'use client';

import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/components/ui';
import { LOCALE_NAMES, isLocale } from '@/i18n/config';

/**
 * Language of a customer (inquiry / booking): the code in a small tag plus the language name,
 * e.g. "FR Français". Renders nothing for an unknown or missing language.
 */
export function LocaleBadge({ locale, className, showName = true }: { locale: string | null | undefined; className?: string; showName?: boolean }) {
  const t = useTranslations();
  if (!isLocale(locale)) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={t('common.customerLanguage', { language: LOCALE_NAMES[locale] })}>
      <Languages size={14} aria-hidden="true" className="flex-none text-graphite" />
      <span className="inline-flex h-[22px] items-center rounded-md bg-paper px-1.5 text-xs font-bold tracking-wide text-ink" aria-hidden="true">
        {locale.toUpperCase()}
      </span>
      <span className={cn('sm', !showName && 'sr-only')} lang={locale}>
        {LOCALE_NAMES[locale]}
      </span>
    </span>
  );
}
