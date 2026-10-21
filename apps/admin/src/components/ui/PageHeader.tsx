/**
 * PageHeader: page title (h1, 28 px), subtitle, actions on the right (wrap
 * below the title on narrow screens) and an optional tabs slot.
 *
 *   <PageHeader title="Flotte" subtitle="12 Fahrzeuge, 11 auf der Website sichtbar"
 *               actions={<Button iconLeft={<Plus size={18} />}>Fahrzeug hinzufügen</Button>} />
 *   <PageHeader title="Einstellungen" subtitle="Website, Benutzer und Rollen, Aktivitätsprotokoll"
 *               tabs={<Tabs ... />} tabsInline />
 *
 * Props: title, subtitle?, actions?, tabs?, tabsInline (tabs sit in the title row, right-aligned,
 *   instead of below), className.
 */
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  tabsInline?: boolean;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, tabs, tabsInline = false, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="pg-h">
        <div className="min-w-0">
          <h1 className="h1">{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {(tabsInline && tabs) || actions ? (
          <div className="flex flex-wrap items-center gap-2.5 max-md:w-full">
            {tabsInline && tabs}
            {actions}
          </div>
        ) : null}
      </div>
      {!tabsInline && tabs}
    </header>
  );
}
