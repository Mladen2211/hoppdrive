'use client';

/**
 * Native <select> with the design-system chevron (44 px, 48 px on mobile).
 * Native on purpose: best mobile pickers and full keyboard support.
 *
 * Props: all native <select> props (children = <option>s), plus
 *  - invalid: red border + tint (also set automatically from Field `error`)
 * Forwards its ref to the <select>.
 */
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, id, required, 'aria-describedby': describedBy, children, ...rest },
  ref,
) {
  const field = useFieldControl({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <select
      ref={ref}
      className={cn('in', className)}
      {...rest}
      id={field.id}
      required={field.required}
      aria-invalid={field['aria-invalid']}
      aria-describedby={field['aria-describedby']}
    >
      {children}
    </select>
  );
});
