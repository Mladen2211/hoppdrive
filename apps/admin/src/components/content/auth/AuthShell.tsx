'use client';

/**
 * Frame of the signed-out pages (login, forgot / reset password, accept invite):
 * centred card on the paper background with the stacked logo, heading, subtitle and an
 * optional footnote pinned to the bottom of the card (Auth board, panels 1 and 2).
 *
 *   <AuthShell title="Anmelden" subtitle="Zugang zum Verwaltungsbereich" footnote="...">
 *     <form>...</form>
 *   </AuthShell>
 */
import type { ReactNode } from 'react';
import { Logo, cn } from '@/components/ui';
import { useTranslations } from 'next-intl';

export interface AuthShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  /** Wider card for the customer-facing sign page. */
  width?: 'sm' | 'md';
  className?: string;
}

export function AuthShell({ title, subtitle, footnote, children, width = 'sm', className }: AuthShellProps) {
  const t = useTranslations();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4 font-sans text-[15px] text-ink max-sm:items-start max-sm:p-3">
      <div
        className={cn(
          'flex w-full flex-col gap-[18px] rounded-2xl border border-line bg-card p-9 shadow-[0_1px_2px_rgba(44,46,48,.04)] max-sm:p-5',
          width === 'sm' ? 'max-w-[460px]' : 'max-w-[600px]',
          className,
        )}
      >
        <Logo variant="stacked" height={84} alt="HoppDrive" priority className="self-start max-sm:!h-[71px]" />
        <div>
          <h1 className="h1 text-[26px]">{title}</h1>
          {subtitle && <p className="mut mt-1">{subtitle}</p>}
        </div>
        {children}
        {footnote && <p className="sm mut mt-2">{footnote}</p>}
      </div>
    </main>
  );
}
