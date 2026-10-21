'use client';

/**
 * Checkbox with its label (22 px box, ruby accent, 44 px row, 48 px on mobile).
 * The whole row is the click target.
 *
 * Props: all native <input type="checkbox"> props, plus
 *  - label: visible label (ReactNode)
 *  - invalid: marks the box aria-invalid (also set from Field `error`)
 * Forwards its ref to the <input>.
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  invalid?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, invalid, className, id, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const field = useFieldControl({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <label className={cn('chk', className)}>
      <input
        ref={ref}
        type="checkbox"
        {...rest}
        id={field.id}
        required={field.required}
        aria-invalid={field['aria-invalid']}
        aria-describedby={field['aria-describedby']}
      />
      {label !== undefined && <span>{label}</span>}
    </label>
  );
});
