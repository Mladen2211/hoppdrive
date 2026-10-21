import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

/**
 * Centered empty/error state (design board "Leer und Fehler"): round icon
 * badge, title, short text and the way out (buttons).
 *
 *   <EmptyState icon={<SearchX size={34} />} title="Keine Fahrzeuge in dieser Kategorie"
 *               text="Versuchen Sie einen anderen Filter oder sehen Sie die ganze Flotte."
 *               actions={<Button onClick={reset}>Filter zurücksetzen</Button>} />
 */
interface EmptyStateProps {
  icon?: ReactNode;
  /** Big number instead of an icon, e.g. "404". */
  figure?: string;
  title: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  /** Heading level of the title (default h2). */
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function EmptyState({ icon, figure, title, text, actions, as: Heading = 'h2', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3.5 px-5 py-10 text-center', className)}>
      {figure ? (
        <b className="num text-[64px] font-bold leading-none text-ruby">{figure}</b>
      ) : icon ? (
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-paper text-graphite"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <Heading className="h3">{title}</Heading>
      {text && <p className="mut max-w-[34ch]">{text}</p>}
      {actions && <div className="flex flex-wrap justify-center gap-2.5">{actions}</div>}
    </div>
  );
}
