'use client';

/**
 * Text field of a translation tab. The German text is the placeholder, an empty field says that the
 * German text will be shown on the website ("Fallback"), a filled one shows a check.
 *
 *   <TranslatedField locale="fr" label="Titel" base={german.title} value={blob.title} onChange={...} />
 */
import { Check, CornerDownRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppLocale } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Field, Input, Textarea } from '@/components/ui';
import { isFilled } from '@/lib/translations';

export interface TranslatedFieldProps {
  locale: AppLocale;
  label: ReactNode;
  /** The German text (placeholder + fallback). */
  base: string | null | undefined;
  value: string | null | undefined;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  /** Extra hint text shown before the fallback state (e.g. a character counter). */
  hint?: ReactNode;
}

export function TranslatedField({ locale, label, base, value, onChange, multiline, rows = 3, maxLength, className, disabled, hint }: TranslatedFieldProps) {
  const t = useTranslations();
  const filled = isFilled(value);
  const hasBase = isFilled(base);
  const state = filled ? (
    <span className="inline-flex items-center gap-1 text-ok">
      <Check size={14} aria-hidden="true" />
      {t('localeTabs.translated')}
    </span>
  ) : hasBase ? (
    <span className="inline-flex items-center gap-1">
      <CornerDownRight size={14} aria-hidden="true" />
      {t('localeTabs.fallbackField')}
    </span>
  ) : null;

  const hintNode =
    hint || state ? (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {hint}
        {state}
      </span>
    ) : undefined;

  return (
    <Field label={label} hint={hintNode} className={className}>
      {multiline ? (
        <Textarea
          rows={rows}
          lang={locale}
          value={value ?? ''}
          maxLength={maxLength}
          showCount={false}
          placeholder={base ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input lang={locale} value={value ?? ''} maxLength={maxLength} placeholder={base ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
