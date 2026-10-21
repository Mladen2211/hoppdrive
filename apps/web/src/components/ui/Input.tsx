'use client';

/**
 * Text input (52 px, 1.5 px #8E9194 border, radius 10, 16 px text so iOS
 * does not zoom). Works for text, email, tel, date, number...
 * Inside <Field> it is wired automatically; standalone pass `aria-label`.
 *
 * Props: all native <input> props, plus
 *  - invalid: red border + tint (also set automatically from Field `error`)
 *  - valid: green border (confirmed value, optional)
 * Forwards its ref to the <input>.
 */
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  valid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, valid, className, id, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const field = useFieldControl({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <input
      ref={ref}
      className={cn('in', valid && !field['aria-invalid'] && 'in-ok', className)}
      {...rest}
      id={field.id}
      required={field.required}
      aria-invalid={field['aria-invalid']}
      aria-describedby={field['aria-describedby']}
    />
  );
});
