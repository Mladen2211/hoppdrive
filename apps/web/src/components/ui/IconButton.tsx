'use client';

/**
 * Icon-only button, 48 x 48 px, 2 px line border (navbar menu toggle, sheet
 * close, gallery arrows). `aria-label` is REQUIRED.
 *
 * Props:
 *  - aria-label: accessible name (also the native tooltip)
 *  - children: the icon (lucide, size 20-24)
 *  - all native <button> props
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, children, title, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} title={title ?? rest['aria-label']} className={cn('ico-btn', className)} {...rest}>
      {children}
    </button>
  );
});
