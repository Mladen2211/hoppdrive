'use client';

/**
 * On/off switch (role="switch", aria-checked): 52 x 30 track in a 48 px-high
 * hit area. Label and description are part of the click target.
 *
 *   <Switch checked={stats} onChange={setStats} labelPosition="left"
 *           label="Statistik" description="Hilft uns zu verstehen, welche Seiten genutzt werden." />
 *   <Switch checked disabled label="Notwendig" description="Für Anmeldung und Formulare. Immer aktiv." />
 *
 * Props: checked, onChange(checked), label, description, labelPosition ('right' default |
 *   'left' = full-width row with the switch at the end), disabled, name, id, className,
 *   aria-label (when there is no visible label).
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
        'inline-flex min-h-[48px] items-center gap-3 rounded-lg disabled:cursor-not-allowed disabled:opacity-60',
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
