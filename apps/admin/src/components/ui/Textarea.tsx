'use client';

/**
 * Multi-line input (min height 96 px, vertical resize) with an optional
 * character counter: when `maxLength` is set it shows "28 von 60 Zeichen"
 * below the field (turn off with `showCount={false}`).
 *
 * Props: all native <textarea> props, plus
 *  - invalid: red border + tint (also set automatically from Field `error`)
 *  - showCount: counter visibility (default true when maxLength is set)
 * Works controlled (`value`) and uncontrolled (`defaultValue`).
 */
import { forwardRef, useId, useState, type ChangeEvent, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';
import { useTranslations } from 'next-intl';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    invalid,
    showCount,
    className,
    id,
    required,
    maxLength,
    value,
    defaultValue,
    onChange,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const t = useTranslations();
  const counterId = useId();
  const [uncontrolledLength, setUncontrolledLength] = useState(() => String(defaultValue ?? '').length);
  const counting = maxLength !== undefined && showCount !== false;
  const length = value !== undefined ? String(value).length : uncontrolledLength;
  const field = useFieldControl({
    id,
    invalid,
    required,
    'aria-describedby': [describedBy, counting ? counterId : undefined].filter(Boolean).join(' ') || undefined,
  });

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) setUncontrolledLength(event.target.value.length);
    onChange?.(event);
  };

  const textarea = (
    <textarea
      ref={ref}
      className={cn('in', className)}
      maxLength={maxLength}
      {...rest}
      {...(value !== undefined ? { value } : { defaultValue })}
      onChange={handleChange}
      id={field.id}
      required={field.required}
      aria-invalid={field['aria-invalid']}
      aria-describedby={field['aria-describedby']}
    />
  );

  if (!counting) return textarea;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {textarea}
      <span id={counterId} className="hint">{t('ui.vonZeichen', { length, maxLength })}</span>
    </div>
  );
});
