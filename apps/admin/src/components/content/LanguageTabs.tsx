'use client';

/**
 * Language tabs of the content editors: DE | EN | FR | IT | HR.
 *
 *   const [lang, setLang] = useState<AppLocale>('de');
 *   <LanguageTabs value={lang} onChange={setLang} states={{ en: 'complete', fr: 'partial', it: 'missing', hr: 'missing' }} />
 *   {lang !== 'de' && <LanguageNote />}
 *
 * German is the source language and is required; the other tabs show a small state next to the code:
 * a check (übersetzt), a half dot (teilweise) or a dash (fehlt). The state is never conveyed by colour
 * alone: every badge carries visually hidden text.
 */
import { Check, Minus } from 'lucide-react';
import type { AppLocale } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Tabs, cn } from '@/components/ui';
import { LOCALE_NAMES } from '@/i18n/config';
import { CONTENT_LOCALES, type TranslationState } from '@/lib/translations';

export interface LanguageTabsProps {
  value: AppLocale;
  onChange: (locale: AppLocale) => void;
  /** State per translatable language (de has none). Missing entries show no badge. */
  states?: Partial<Record<AppLocale, TranslationState>>;
  className?: string;
  idPrefix?: string;
}

function StateBadge({ state }: { state: TranslationState }) {
  const t = useTranslations();
  const text = t(`localeTabs.state.${state}`);
  return (
    <span
      className={cn(
        'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full',
        state === 'complete' && 'bg-ok-tint text-ok',
        state === 'partial' && 'bg-warn-tint text-warn',
        state === 'missing' && 'bg-paper text-graphite',
      )}
    >
      {state === 'complete' ? (
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      ) : state === 'partial' ? (
        <span className="h-2 w-2 rounded-full bg-warn" aria-hidden="true" />
      ) : (
        <Minus size={12} strokeWidth={3} aria-hidden="true" />
      )}
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function LanguageTabs({ value, onChange, states, className, idPrefix }: LanguageTabsProps) {
  const t = useTranslations();
  const tabs = CONTENT_LOCALES.map((code) => {
    const state = code === 'de' ? undefined : states?.[code];
    return {
      id: code,
      label: (
        <span title={LOCALE_NAMES[code]}>
          <span aria-hidden="true">{code.toUpperCase()}</span>
          <span className="sr-only">{LOCALE_NAMES[code]}</span>
        </span>
      ),
      badge: state ? <StateBadge state={state} /> : undefined,
    };
  });
  return (
    <Tabs
      aria-label={t('localeTabs.ariaLabel')}
      tabs={tabs}
      value={value}
      onChange={(id) => onChange(id as AppLocale)}
      idPrefix={idPrefix}
      className={cn('self-start', className)}
    />
  );
}

/** One line under the tabs that explains the fallback when a non-German tab is open. */
export function LanguageNote({ locale, className }: { locale: AppLocale; className?: string }) {
  const t = useTranslations();
  if (locale === 'de') return <p className={cn('sm mut', className)}>{t('localeTabs.sourceNote')}</p>;
  return <p className={cn('sm mut', className)}>{t('localeTabs.fallbackNote', { language: LOCALE_NAMES[locale] })}</p>;
}
