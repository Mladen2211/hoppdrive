/**
 * Tiny class-name joiner for the UI primitives.
 * `cn('btn', isPrimary && 'btn-p', className)` -> 'btn btn-p custom'
 * Falsy values are dropped; there is no Tailwind-conflict merging, so put
 * overriding utilities in the caller's `className` (utilities win over the
 * component classes from globals.css).
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
