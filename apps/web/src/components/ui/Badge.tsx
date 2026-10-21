/**
 * Badge: small status label on cards (26 px pill). Text always says the status;
 * `dot` adds a coloured dot for extra scanability.
 *
 *   <Badge tone="ok">Verfügbar</Badge>        green   (available now)
 *   <Badge tone="warn">Reserviert</Badge>     amber   (reserved)
 *   <Badge tone="off">Foto folgt</Badge>      grey    (neutral / unavailable)
 *   <Badge tone="ruby">Neu</Badge>            ruby fill, white text
 *   <Badge tone="ink">Beliebt</Badge>         anthracite fill, white text
 *
 * Props: tone ('ok' | 'warn' | 'off' | 'ruby' | 'ink', default 'off'), dot, className.
 */
import type { ReactNode } from 'react';
import { cn } from './cn';

const TONE_CLASS = {
  ok: 'b-ok',
  warn: 'b-warn',
  off: 'b-off',
  ruby: 'b-ruby',
  ink: 'b-ink',
} as const;

export type BadgeTone = keyof typeof TONE_CLASS;

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'off', dot = false, className, children }: BadgeProps) {
  return (
    <span className={cn('badge', TONE_CLASS[tone], className)}>
      {dot && <span className="h-2 w-2 flex-none rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
