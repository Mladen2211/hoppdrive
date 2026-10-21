'use client';

/**
 * Field: label + control + hint + error with the aria wiring done for you.
 *
 *   <Field label="Preis pro Tag" hint="In CHF" error={errors.price} required>
 *     <Input type="number" value={price} onChange={...} />
 *   </Field>
 *
 * Input, Select, Textarea, Checkbox and Switch read the Field context, so they
 * automatically get `id` (matches the <label for>), `aria-describedby`
 * (hint + error), `aria-invalid` and `required`. Do NOT pass `id` to a control
 * inside a Field; pass `htmlFor` to the Field instead if you need a fixed id.
 *
 * For custom controls use the render-prop form:
 *   <Field label="Zeitraum">{(p) => <MyPicker {...p} />}</Field>
 *
 * Props: label, hint, error (truthy => invalid), required (asterisk + native
 * `required`), htmlFor, className.
 */
import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from './cn';

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

/** Used by the form primitives; merges Field context with the control's own props. */
export function useFieldControl(own: {
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  required?: boolean;
}): { id: string | undefined; 'aria-describedby': string | undefined; 'aria-invalid': true | undefined; required: boolean | undefined } {
  const ctx = useContext(FieldContext);
  const describedBy = [own['aria-describedby'], ctx?.describedBy].filter(Boolean).join(' ') || undefined;
  return {
    id: ctx?.id ?? own.id,
    'aria-describedby': describedBy,
    'aria-invalid': (own.invalid ?? ctx?.invalid) ? true : undefined,
    required: own.required ?? (ctx?.required ? true : undefined),
  };
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode | ((props: FieldControlProps) => ReactNode);
}

export function Field({ label, hint, error, required = false, htmlFor, className, children }: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const invalid = Boolean(error);

  const control =
    typeof children === 'function'
      ? children({
          id,
          'aria-describedby': describedBy,
          'aria-invalid': invalid ? true : undefined,
          required: required || undefined,
        })
      : children;

  return (
    <div className={cn('fld', className)}>
      {label && (
        <label htmlFor={id} className="lbl">
          {label}
          {required && (
            <span className="text-err" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      <FieldContext.Provider value={{ id, describedBy, invalid, required }}>{control}</FieldContext.Provider>
      {hint && (
        <span id={hintId} className="hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="errm" aria-live="polite">
          {error}
        </span>
      )}
    </div>
  );
}
