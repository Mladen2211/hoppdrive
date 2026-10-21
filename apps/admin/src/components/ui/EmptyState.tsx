/**
 * Empty / "nothing here" state: icon in a tinted square, title, short text and
 * the next best actions (centered).
 *
 *   <EmptyState icon={<MessageSquare size={32} />} title="Keine neuen Anfragen"
 *     text="Sobald jemand das Formular auf der Website absendet, erscheint die Anfrage hier."
 *     actions={<><Button>Buchung manuell anlegen</Button><Button variant="ghost">Alle Anfragen ansehen</Button></>} />
 *
 * Props: icon (lucide node, size 32), tone ('info' default | 'neutral' | 'ok' | 'warn' | 'err'),
 *   title, text (or children), actions, headingLevel (2 default | 3), compact (less padding), className.
 */
import type { ReactNode } from 'react';
import { cn } from './cn';

const TONE_CLASS = {
  info: 'bg-info-tint text-info',
  neutral: 'bg-paper text-graphite',
  ok: 'bg-ok-tint text-ok',
  warn: 'bg-warn-tint text-warn',
  err: 'bg-err-tint text-err',
} as const;

export interface EmptyStateProps {
  icon?: ReactNode;
  tone?: keyof typeof TONE_CLASS;
  title: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  tone = 'info',
  title,
  text,
  children,
  actions,
  headingLevel = 2,
  compact = false,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-2 text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      {icon && (
        <span
          className={cn('flex h-[72px] w-[72px] items-center justify-center rounded-20', TONE_CLASS[tone])}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <Heading className="h2">{title}</Heading>
      {(text || children) && <div className="mut max-w-[340px]">{text ?? children}</div>}
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
