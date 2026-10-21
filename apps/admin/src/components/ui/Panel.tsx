/**
 * Panel: white card (radius 16, 1 px line border) with an optional header.
 *
 *   <Panel>
 *     <PanelHeader title="Fahrzeuge" actions={<ChipGroup .../>} />
 *     <PanelBody>...</PanelBody>       // or put a <Table> directly in the Panel
 *   </Panel>
 *
 * Panel props: as ('section' default | 'div' | 'article'), className, + native div props.
 * PanelHeader props: title, subtitle?, actions? (right side, wraps on mobile), headingLevel (2 | 3).
 * PanelBody: padded content area (20 px).
 */
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export function Panel({ as: Tag = 'section', className, children, ...rest }: PanelProps) {
  return (
    <Tag className={cn('panel', className)} {...rest}>
      {children}
    </Tag>
  );
}

export interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

export function PanelHeader({ title, subtitle, actions, headingLevel = 2, className }: PanelHeaderProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('panel-h', className)}>
      <div className="min-w-0">
        <Heading className="h2">{title}</Heading>
        {subtitle && <p className="sm mut mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel-b', className)} {...rest}>
      {children}
    </div>
  );
}
