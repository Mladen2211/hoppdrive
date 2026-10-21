'use client';

/**
 * On/off switch (role="switch", aria-checked). The 48 x 28 track sits inside
 * a 44 px-high hit area; label and description are part of the click target.
 *
 *   <Switch checked={active} onChange={setActive} label="Auf der Website anzeigen"
 *           description="Verfügbar für Anfragen" labelPosition="left" />
 *
 * Props:
 *  - checked, onChange(checked: boolean)
 *  - label, description: visible text (give `aria-label` instead if there is none)
 *  - labelPosition: 'right' (default) | 'left' (full-width row, switch at the end)
 *  - disabled, name, id, className
 * Inside <Field> it takes the Field id so `<label for>` works.
 */
import { forwardRef, useId, type ReactNode } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  labelPosition?: 'left' | 'right';
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    onChange,
    label,
    description,
    labelPosition = 'right',
    disabled,
    id,
    name,
    className,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
  },
  ref,
) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;
  const field = useFieldControl({
    id,
    'aria-describedby': [describedBy, description ? descId : undefined].filter(Boolean).join(' ') || undefined,
  });

  const text =
    label !== undefined || description !== undefined ? (
      <span className="flex min-w-0 flex-col text-left">
        {label !== undefined && (
          <span id={labelId} className="font-semibold">
            {label}
          </span>
        )}
        {description !== undefined && (
          <span id={descId} className="hint">
            {description}
          </span>
        )}
      </span>
    ) : null;

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      id={field.id}
      name={name}
      aria-checked={checked}
      aria-label={label === undefined ? ariaLabel : undefined}
      aria-labelledby={label !== undefined ? labelId : undefined}
      aria-describedby={field['aria-describedby']}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-3 rounded-lg disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-[48px]',
        labelPosition === 'left' && 'w-full justify-between',
        className,
      )}
    >
      {labelPosition === 'left' && text}
      <span className="sw" aria-hidden="true" />
      {labelPosition === 'right' && text}
    </button>
  );
});
