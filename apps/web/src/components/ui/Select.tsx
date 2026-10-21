'use client';

/**
 * Native <select> with the design-system chevron (52 px). Native on purpose:
 * best mobile pickers and full keyboard support.
 *
 * Props: all native <select> props (children = <option>s), plus
 *  - invalid: red border + tint (also set automatically from Field `error`)
 *  - valid: green border (confirmed value, optional)
 * Forwards its ref to the <select>.
 */
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  valid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, valid, className, id, required, 'aria-describedby': describedBy, children, ...rest },
  ref,
) {
  const field = useFieldControl({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <select
      ref={ref}
      className={cn('in', valid && !field['aria-invalid'] && 'in-ok', className)}
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
