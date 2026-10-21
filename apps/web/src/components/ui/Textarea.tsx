'use client';

/**
 * Multi-line input (min height 120 px, vertical resize, 16 px text).
 *
 * Props: all native <textarea> props, plus
 *  - invalid: red border + tint (also set automatically from Field `error`)
 *  - valid: green border (optional)
 * Forwards its ref to the <textarea>.
 */
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { useFieldControl } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  valid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, valid, className, id, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const field = useFieldControl({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <textarea
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
