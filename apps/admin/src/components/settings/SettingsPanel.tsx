/**
 * Panel with heading, optional subtitle and header actions: the frame every settings section uses.
 * Same markup as the panels of the Website tab.
 */
import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

export function SettingsPanel({
  id,
  title,
  subtitle,
  actions,
  children,
  bodyClassName,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-h">
        <div className="min-w-0 max-w-[640px]">
          <h2 className="h2" id={id}>
            {title}
          </h2>
          {subtitle && <p className="sm mut mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      <div className={cn('flex flex-col gap-4 p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
