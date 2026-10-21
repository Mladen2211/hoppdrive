'use client';

/**
 * Text input (44 px, 48 px on mobile, 1.5 px #8E9194 border, radius 10).
 * Inside <Field> it is wired automatically. Standalone, pass `aria-label`
 * or your own <label htmlFor>.
 *
 * Props: all native <input> props, plus
 *  - invalid: red border + tint (also set automatically from Field `error`)
 * Forwards its ref to the <input>.
 */
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, id, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const field = useFieldControl({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <input
      ref={ref}
      className={cn('in', className)}
      {...rest}
      id={field.id}
      required={field.required}
      aria-invalid={field['aria-invalid']}
      aria-describedby={field['aria-describedby']}
    />
  );
});
