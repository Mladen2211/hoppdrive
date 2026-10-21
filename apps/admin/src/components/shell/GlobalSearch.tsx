'use client';

/**
 * Global search (GET /search): desktop = input in the top bar with a results dropdown,
 * tablet / mobile = icon button that opens a full-screen search.
 * Behaviour kept from the old shell: 300 ms debounce, at least 2 characters, results grouped by
 * Fahrzeuge / Buchungen / Anfragen / Standorte / Rechnungen, status pill per result, closes on an
 * outside click, clicking a result clears the query. New: every result deep-links to its detail
 * (`?id=` opens the drawer on the target page).
 */
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IconButton, Spinner, StatusPill, cn, useFocusTrap, useLockBodyScroll } from '@/components/ui';
import type { StatusKind } from '@/components/ui';
import { Portal } from '@/components/ui/Portal';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const CATEGORY_LABELS: Record<string, string> = {
  get vehicles() { return tr('common.fahrzeuge'); },
  get bookings() { return tr('common.buchungen'); },
  get inquiries() { return tr('common.anfragen'); },
  get locations() { return tr('common.standorte'); },
  get invoices() { return tr('common.rechnungen'); },
};

const CATEGORY_STATUS_KIND: Record<string, StatusKind | undefined> = {
  bookings: 'booking',
  inquiries: 'contact',
  invoices: 'invoice',
};

interface SearchItem {
  id: string;
  label: string;
  status?: string;
  vehicle?: string | null;
  email?: string;
  city?: string;
  customer?: string;
}

/** Deep link for a result: the target page opens the matching detail from `?id=`. */
export function searchHref(category: string, item: { id: string }): string {
  switch (category) {
    case 'inquiries':
      return `/inquiries?id=${item.id}`;
    case 'bookings':
      return `/contracts?id=${item.id}`;
    case 'invoices':
      return `/contracts?tab=rechnungen&invoice=${item.id}`;
    case 'vehicles':
      return `/fleet?id=${item.id}`;
    case 'locations':
      return `/locations?id=${item.id}`;
    default:
      return '/';
  }
}

function secondaryText(category: string, item: SearchItem): string | undefined {
  if (category === 'bookings') return item.vehicle ?? undefined;
  if (category === 'inquiries') return item.email;
  if (category === 'locations') return item.city;
  if (category === 'invoices') return item.customer;
  return undefined;
}

function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, SearchItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    requestRef.current += 1;
    const requestId = requestRef.current;
    if (q.length < 2) {
      setResults({});
      setLoading(false);
      setSearched(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.globalSearch(q);
        if (requestRef.current !== requestId) return; // a newer query is already running
        setResults(data ?? {});
        setSearched(true);
      } catch {
        /* ignore: the old results stay */
      }
      if (requestRef.current === requestId) setLoading(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const reset = useCallback(() => {
    setQuery('');
    setResults({});
    setSearched(false);
  }, []);

  const hasResults = Object.values(results).some((arr) => arr?.length > 0);
  return { query, setQuery, results, loading, searched, hasResults, reset };
}

function ResultList({
  results,
  query,
  loading,
  searched,
  hasResults,
  onNavigate,
  listRef,
}: {
  results: Record<string, SearchItem[]>;
  query: string;
  loading: boolean;
  searched: boolean;
  hasResults: boolean;
  onNavigate: () => void;
  listRef?: React.RefObject<HTMLDivElement>;
}) {
  const t = useTranslations();
  const tooShort = query.trim().length < 2;
  return (
    <div ref={listRef} role="region" aria-label={t('shell.suchergebnisse')} aria-live="polite">
      {loading && !hasResults && (
        <div className="flex items-center gap-2.5 px-4 py-3.5 text-graphite">
          <Spinner size={16} /> {t('shell.suche')}
        </div>
      )}
      {!loading && !tooShort && searched && !hasResults && (
        <div className="px-4 py-3.5 text-graphite">{t('shell.keineErgebnisseFuer', { trim: query.trim() })}</div>
      )}
      {tooShort && !loading && <div className="px-4 py-3.5 text-graphite">{t('shell.mindestens2ZeichenEingeben')}</div>}
      {!tooShort &&
        Object.entries(results).map(([category, items]) => {
          if (!items?.length) return null;
          const statusKind = CATEGORY_STATUS_KIND[category];
          return (
            <div key={category}>
              <div className="px-4 pb-1 pt-3 text-[13px] font-semibold text-graphite">{CATEGORY_LABELS[category] || category}</div>
              <ul>
                {items.map((item) => {
                  const secondary = secondaryText(category, item);
                  return (
                    <li key={item.id}>
                      <Link
                        href={searchHref(category, item)}
                        onClick={onNavigate}
                        data-search-result
                        className="flex min-h-[48px] items-center justify-between gap-3 border-b border-line-soft px-4 py-2 no-underline last:border-b-0 hover:bg-paper focus-visible:bg-paper"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{item.label}</span>
                          {secondary && <span className="sm mut block truncate">{secondary}</span>}
                        </span>
                        {statusKind && item.status && <StatusPill kind={statusKind} status={item.status} className="flex-none" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
    </div>
  );
}

const SEARCH_BOX =
  'flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-10 border-[1.5px] border-line bg-paper px-3.5 text-graphite focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-focus max-md:h-12';
const SEARCH_INPUT = 'min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-ink outline-none placeholder:text-graphite max-md:text-base [&::-webkit-search-cancel-button]:hidden';

/** Desktop (>= 1024 px): input with dropdown. */
export function DesktopSearch({ className }: { className?: string }) {
  const t = useTranslations();
  const { query, setQuery, results, loading, searched, hasResults, reset } = useGlobalSearch();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const showPanel = open && query.trim().length >= 2;

  function focusResult(delta: 1 | -1) {
    const links = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-search-result]') ?? []);
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (index === -1) links[delta === 1 ? 0 : links.length - 1].focus();
    else if (delta === -1 && index === 0) inputRef.current?.focus();
    else links[Math.min(links.length - 1, Math.max(0, index + delta))].focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (open) {
        event.stopPropagation();
        setOpen(false);
        inputRef.current?.focus();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      focusResult(1);
    } else if (event.key === 'ArrowUp' && showPanel) {
      event.preventDefault();
      focusResult(-1);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative min-w-0 max-w-[460px] flex-1', className)} onKeyDown={onKeyDown}>
      <label className={SEARCH_BOX}>
        <Search size={20} aria-hidden="true" className="flex-none" />
        <span className="sr-only">{t('shell.suche2')}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('shell.nameEMailFahrzeug')}
          autoComplete="off"
          className={SEARCH_INPUT}
        />
      </label>
      {showPanel && (
        <div
          id="global-search-results"
          className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[420px] w-[min(520px,calc(100vw-48px))] animate-pop overflow-y-auto rounded-2xl border border-line bg-card shadow-modal"
        >
          <ResultList
            results={results}
            query={query}
            loading={loading}
            searched={searched}
            hasResults={hasResults}
            listRef={listRef}
            onNavigate={() => {
              setOpen(false);
              reset();
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Tablet / mobile: icon button + full-screen search. */
export function SearchOverlayButton({ className }: { className?: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        ref={triggerRef}
        variant="outline"
        aria-label={t('shell.sucheOeffnen')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Search size={20} aria-hidden="true" />
      </IconButton>
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const { query, setQuery, results, loading, searched, hasResults, reset } = useGlobalSearch();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, { onEscape: onClose });
  useLockBodyScroll(true);

  function close() {
    reset();
    onClose();
  }

  return (
    <Portal>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.suche2')}
        className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-card"
      >
        <div className="flex flex-none items-center gap-2 border-b border-line px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] md:px-6">
          <label className={SEARCH_BOX}>
            <Search size={20} aria-hidden="true" className="flex-none" />
            <span className="sr-only">{t('shell.suche2')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('shell.nameEMailFahrzeug')}
              autoComplete="off"
              autoFocus
              data-autofocus
              className={SEARCH_INPUT}
            />
          </label>
          <IconButton aria-label={t('shell.sucheSchliessen')} onClick={close}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
          <ResultList
            results={results}
            query={query}
            loading={loading}
            searched={searched}
            hasResults={hasResults}
            listRef={listRef}
            onNavigate={close}
          />
        </div>
      </div>
    </Portal>
  );
}
