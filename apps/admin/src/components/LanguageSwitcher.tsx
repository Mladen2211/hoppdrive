'use client';

import { Languages } from 'lucide-react';
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/components/ui';
import { LOCALES, LOCALE_NAMES, isLocale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/I18nProvider';

/**
 * Compact language picker (native language names). Used on pages without the account settings,
 * e.g. the public contract signing page that is shown to the renter. `persist` defaults to false:
 * the choice only changes the page, not the signed-in admin's own language.
 */
export function LanguageSwitcher({ persist = false, className }: { persist?: boolean; className?: string }) {
  const t = useTranslations();
  const { locale, setLocale } = useAppLocale();
  const id = useId();
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <label htmlFor={id} className="sr-only">
        {t('common.language')}
      </label>
      <Languages size={18} aria-hidden="true" className="pointer-events-none absolute left-3 text-graphite" />
      <select
        id={id}
        value={locale}
        onChange={(e) => {
          if (isLocale(e.target.value)) void setLocale(e.target.value, { persist });
        }}
        className="in !h-10 !w-auto cursor-pointer !pl-9 text-sm font-semibold"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
