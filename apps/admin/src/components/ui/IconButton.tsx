'use client';

/**
 * Icon-only button. `aria-label` is REQUIRED (there is no visible text).
 *
 * Props:
 *  - aria-label: accessible name (also used as the native tooltip)
 *  - variant: 'ghost' (quiet, for tables and drawers; default) | 'outline' (bordered, top bar)
 *  - badge: number/string shown as a ruby dot-counter (e.g. unread notifications)
 *  - children: the icon (lucide, size 20)
 * Size: 40 px on desktop (44 px hit area), 48 px on mobile.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  variant?: 'ghost' | 'outline';
  badge?: number | string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', badge, className, children, title, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={title ?? rest['aria-label']}
      className={cn(variant === 'outline' ? 'icon-btn' : 'ib', className)}
      {...rest}
    >
      {children}
      {badge !== undefined && badge !== 0 && badge !== '' && (
        <span className="dot" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
});
