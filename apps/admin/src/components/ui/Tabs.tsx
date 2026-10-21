'use client';

/**
 * Segmented tabs (role="tablist" / "tab", aria-selected, roving tabindex,
 * Left/Right/Home/End keys with automatic activation).
 *
 * In-page tabs:
 *   <Tabs aria-label="Anfragen" idPrefix="inq" withPanels value={tab} onChange={setTab}
 *         tabs={[{ id: 'open', label: 'Offen', count: 5 }, { id: 'all', label: 'Alle', count: 20 }]} />
 *   <TabPanel idPrefix="inq" id="open" active={tab === 'open'}>...</TabPanel>
 *
 * Route tabs (e.g. Settings -> Website / Benutzer / Protokoll): give every tab an
 * `href`; it renders a <nav> of links with aria-current="page" instead.
 *   <Tabs aria-label="Einstellungen" value="users" tabs={[{ id: 'site', label: 'Website', href: '/settings' }, ...]} />
 *
 * Tab: { id, label, count?, badge? (e.g. a "Neu" StatusPill), href?, disabled? }
 * Props: value (active tab id), onChange(id), idPrefix, withPanels, aria-label, className.
 */
import Link from 'next/link';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number | string;
  badge?: ReactNode;
  href?: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  'aria-label': string;
  idPrefix?: string;
  /** Set when you render <TabPanel>s with the same idPrefix (adds aria-controls). */
  withPanels?: boolean;
  className?: string;
}

const tabDomId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
const panelDomId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

function TabContent({ tab }: { tab: TabItem }) {
  return (
    <>
      {tab.label}
      {tab.count !== undefined && <small>{tab.count}</small>}
      {tab.badge}
    </>
  );
}

export function Tabs({ tabs, value, onChange, idPrefix, withPanels = false, className, ...rest }: TabsProps) {
  const generated = useId();
  const prefix = idPrefix ?? generated;
  const listRef = useRef<HTMLDivElement>(null);
  const ariaLabel = rest['aria-label'];

  if (tabs.length > 0 && tabs.every((tab) => tab.href)) {
    return (
      <nav aria-label={ariaLabel} className={cn('tabs inline-flex', className)}>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href as string}
            className="tab"
            aria-current={tab.id === value ? 'page' : undefined}
          >
            <TabContent tab={tab} />
          </Link>
        ))}
      </nav>
    );
  }

  const enabled = tabs.filter((tab) => !tab.disabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentId: string) => {
    const index = enabled.findIndex((tab) => tab.id === currentId);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = enabled[next];
    onChange?.(target.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(target.id)}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn('tabs inline-flex', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabDomId(prefix, tab.id)}
            data-tab-id={tab.id}
            aria-selected={selected}
            aria-controls={withPanels ? panelDomId(prefix, tab.id) : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            className="tab"
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
          >
            <TabContent tab={tab} />
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  id: string;
  active: boolean;
  className?: string;
  children: ReactNode;
}

/** Panel for an in-page tab; hidden (not unmounted) when inactive. */
export function TabPanel({ idPrefix, id, active, className, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelDomId(idPrefix, id)}
      aria-labelledby={tabDomId(idPrefix, id)}
      hidden={!active}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
