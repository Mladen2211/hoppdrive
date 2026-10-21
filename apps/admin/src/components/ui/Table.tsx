'use client';

/**
 * Data table helpers + the responsive "table on desktop, cards on mobile" pattern.
 *
 * Desktop/tablet (>= 768 px): a real <table> in a horizontally scrollable wrapper.
 *   <Table aria-label="Anfragen">
 *     <THead><Tr><Th>Kunde</Th><Th>Fahrzeug</Th><Th align="right">Preis</Th><Th /></Tr></THead>
 *     <TBody>
 *       <Tr selected={id === selectedId} onClick={() => open(id)}>
 *         <Td><Cell2 primary="Laura Meier" secondary="laura@beispiel.ch" /></Td>
 *         <Td>Škoda Superb Combi</Td>
 *         <Td align="right" className="num">CHF 995.40</Td>
 *         <Td><div className="acts"><IconButton .../></div></Td>
 *       </Tr>
 *     </TBody>
 *   </Table>
 *
 * Mobile (< 768 px): the same rows as <MobileCard>s. Use <ResponsiveList> to
 * render both and let CSS pick one (the hidden one is display:none, so it is
 * not read by screen readers):
 *   <ResponsiveList table={<Table>...</Table>} cards={rows.map((r) => <MobileCard key={r.id} .../>)} />
 *
 * Keyboard access for clickable rows: <Tr onClick> is a mouse convenience only.
 * Put a real <button>/<Link> in a cell (usually the name) so keyboard and
 * screen-reader users can open the row too.
 */
import Link from 'next/link';
import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cn } from './cn';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Class for the scroll wrapper. */
  wrapperClassName?: string;
}

export function Table({ className, wrapperClassName, children, ...rest }: TableProps) {
  return (
    // `relative` contains the absolutely-positioned sr-only header cells so they
    // can't widen the page beyond the viewport.
    <div className={cn('relative overflow-x-auto', wrapperClassName)}>
      <table className={cn('tbl', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...rest}>{children}</thead>;
}

export function TBody({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest}>{children}</tbody>;
}

type Align = 'left' | 'right' | 'center';
const ALIGN_CLASS: Record<Align, string> = { left: '', right: 'text-right', center: 'text-center' };

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export function Th({ align = 'left', className, scope = 'col', children, ...rest }: ThProps) {
  return (
    <th scope={scope} className={cn(ALIGN_CLASS[align], className)} {...rest}>
      {children}
    </th>
  );
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Highlights the row (ruby tint), e.g. the one open in the Drawer. */
  selected?: boolean;
}

export function Tr({ selected = false, onClick, className, children, ...rest }: TrProps) {
  return (
    <tr
      className={cn(selected && 'sel', onClick && 'cursor-pointer', className)}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export function Td({ align = 'left', className, children, ...rest }: TdProps) {
  return (
    <td className={cn(ALIGN_CLASS[align], className)} {...rest}>
      {children}
    </td>
  );
}

/** Two-line cell: bold primary text, grey secondary line (name + e-mail, vehicle + category). */
export function Cell2({ primary, secondary, className }: { primary: ReactNode; secondary?: ReactNode; className?: string }) {
  return (
    <div className={cn('cell-2', className)}>
      <b className="font-semibold">{primary}</b>
      {secondary !== undefined && secondary !== null && secondary !== false && <span>{secondary}</span>}
    </div>
  );
}

export interface MobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Usually a <StatusPill>, top right. */
  status?: ReactNode;
  /** Opens the row. Renders the title as a button (keyboard + 48 px target). */
  onOpen?: () => void;
  /** Or: renders the title as a link. */
  href?: string;
  /** Extra lines: dates, price, <ProgressSteps compact>... */
  children?: ReactNode;
  /** Bottom row of buttons (full width on mobile). */
  actions?: ReactNode;
  className?: string;
}

/** Card version of a table row for < 768 px. */
export function MobileCard({ title, subtitle, status, onOpen, href, children, actions, className }: MobileCardProps) {
  const titleClass = 'min-h-[24px] text-left font-semibold text-ink no-underline';
  const heading = href ? (
    <Link href={href} className={titleClass}>
      {title}
    </Link>
  ) : onOpen ? (
    <button type="button" onClick={onOpen} className={titleClass}>
      {title}
    </button>
  ) : (
    <b className="font-semibold">{title}</b>
  );

  return (
    <div className={cn('m-card', className)}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col">
          {heading}
          {subtitle && <span className="sm mut">{subtitle}</span>}
        </div>
        {status && <div className="flex-none">{status}</div>}
      </div>
      {children}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export interface ResponsiveListProps {
  /** The <Table> for >= 768 px. */
  table: ReactNode;
  /** The <MobileCard>s for < 768 px. */
  cards: ReactNode;
  className?: string;
}

export function ResponsiveList({ table, cards, className }: ResponsiveListProps) {
  return (
    <div className={className}>
      <div className="hidden md:block">{table}</div>
      <div className="flex flex-col gap-3 md:hidden">{cards}</div>
    </div>
  );
}
