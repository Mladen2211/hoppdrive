'use client';

/**
 * Password input with the "Anzeigen" / "Verbergen" text toggle from the Auth board.
 *
 *   <PasswordField label="Neues Passwort" value={pw} onChange={setPw} autoComplete="new-password" />
 *
 * Wired through <Field> (label, hint, error, aria). The toggle is a real button with aria-pressed
 * and a 44 px (48 px on mobile) target inside the input's right edge.
 */
import { useState, type ReactNode } from 'react';
import { Field, Input, cn } from '@/components/ui';
import { useTranslations } from 'next-intl';

export interface PasswordFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  /** Show the asterisk next to the label (default: same as `required`). The login form hides it. */
  markRequired?: boolean;
  name?: string;
  autoComplete?: 'current-password' | 'new-password';
  autoFocus?: boolean;
  placeholder?: string;
  /** Accessible name of the toggle target ("Neues Passwort" -> "Neues Passwort anzeigen"). */
  toggleLabel?: string;
  className?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  invalid,
  required,
  markRequired,
  name,
  autoComplete,
  autoFocus,
  placeholder,
  toggleLabel,
  className,
}: PasswordFieldProps) {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);
  const what = toggleLabel ?? (typeof label === 'string' ? label : t('common.passwort'));

  return (
    <Field label={label} hint={hint} error={error} required={markRequired ?? required} className={className}>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          invalid={invalid}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="none"
          className="pr-[104px]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={`${what} ${visible ? 'verbergen' : 'anzeigen'}`}
          className={cn(
            'absolute right-1 top-1/2 inline-flex h-10 -translate-y-1/2 items-center rounded-lg px-3 text-sm font-semibold text-ruby-dark hover:bg-ruby-tint max-md:h-11',
          )}
        >
          {visible ? t('content.verbergen') : t('content.anzeigen')}
        </button>
      </div>
    </Field>
  );
}
