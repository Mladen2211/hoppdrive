'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/components/ui';
import { LOCALE_META } from '@/i18n/locales';
import { usePathname } from '@/i18n/navigation';
import { localizedPath } from '@/i18n/paths';
import { LOCALES, routing, type AppPathname, type Locale } from '@/i18n/routing';

/**
 * Language switcher. Every entry is a real link to the SAME page in the other language: the
 * localised pathname (incl. dynamic params such as a vehicle slug) comes from the routing table
 * (`localizedPath`, German without a prefix), and clicking one also stores the choice in the
 * NEXT_LOCALE cookie (the one next-intl's middleware reads), so the browser language detection
 * no longer overrides it.
 *
 *  - variant "menu":   compact button with the current code (navbar, desktop) opening a list
 *  - variant "list":   all languages as chips (mobile menu)
 *  - variant "inline": plain text links (footer)
 */
export type LanguageSwitcherVariant = 'menu' | 'list' | 'inline';

interface LanguageSwitcherProps {
  variant?: LanguageSwitcherVariant;
  className?: string;
  /** Called after a language was picked (e.g. to close the mobile menu). */
  onNavigate?: () => void;
}

const DYNAMIC_PARAMS = ['slug', 'kategorie'] as const;
const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Returns a function that maps a locale to the URL of the current page in that locale. */
function useCurrentPageHref(): (locale: Locale) => string {
  const pathname = usePathname() as string;
  const routeParams = useParams<Record<string, string | string[]>>();

  // A path that is not part of the routing table (the 404 page) falls back to the home page.
  const known = !!pathname && pathname in routing.pathnames;
  const params: Record<string, string> = {};
  if (known) {
    for (const name of DYNAMIC_PARAMS) {
      const value = routeParams?.[name];
      if (typeof value === 'string') params[name] = value;
    }
  }
  return (locale) => localizedPath(locale, known ? (pathname as AppPathname) : '/', params);
}

/** Remembers the visitor's choice (same cookie, attributes and lifetime as next-intl's middleware sets). */
function rememberLocale(locale: Locale) {
  try {
    document.cookie = LOCALE_COOKIE + '=' + locale + '; path=/; max-age=31536000; samesite=lax';
  } catch {
    // cookies blocked: the URL itself still carries the language
  }
}

interface LocaleLinkProps {
  locale: Locale;
  href: string;
  active: boolean;
  className: string;
  onPick: () => void;
  children: ReactNode;
}

/** A plain link to the page in another language (no forced `/de` prefix for German). */
function LocaleLink({ locale, href, active, className, onPick, children }: LocaleLinkProps) {
  return (
    <Link
      href={href}
      lang={locale}
      hrefLang={locale}
      aria-current={active ? 'true' : undefined}
      className={className}
      prefetch={false}
      onClick={() => {
        rememberLocale(locale);
        onPick();
      }}
    >
      {children}
    </Link>
  );
}

export function LanguageSwitcher({ variant = 'menu', className, onNavigate }: LanguageSwitcherProps) {
  const t = useTranslations('language');
  const current = useLocale() as Locale;
  const hrefFor = useCurrentPageHref();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // Menu variant: close on Escape (focus returns to the button) and on a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open]);

  const pick = () => {
    setOpen(false);
    onNavigate?.();
  };

  if (variant === 'inline') {
    return (
      <ul className={cn('m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0', className)} aria-label={t('label')}>
        {LOCALES.map((loc) => {
          const active = loc === current;
          return (
            <li key={loc}>
              <LocaleLink
                locale={loc}
                href={hrefFor(loc)}
                active={active}
                onPick={pick}
                className={cn(
                  'inline-flex min-h-9 items-center text-[15px] no-underline hover:text-ruby max-md:min-h-11',
                  active ? 'font-semibold text-ink' : 'text-graphite',
                )}
              >
                {LOCALE_META[loc].nativeName}
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    );
  }

  if (variant === 'list') {
    return (
      <ul className={cn('m-0 flex list-none flex-wrap gap-2 p-0', className)} aria-label={t('label')}>
        {LOCALES.map((loc) => {
          const active = loc === current;
          return (
            <li key={loc}>
              <LocaleLink
                locale={loc}
                href={hrefFor(loc)}
                active={active}
                onPick={pick}
                className={cn('chip no-underline', active && '!border-ink !bg-ink !text-white')}
              >
                {LOCALE_META[loc].nativeName}
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('switchLabel')}. ${t('current', { name: LOCALE_META[current].nativeName })}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-10 border border-line bg-white px-3 text-[15px] font-semibold text-ink hover:border-ink"
      >
        <Globe size={18} strokeWidth={2.2} aria-hidden="true" />
        <span aria-hidden="true">{LOCALE_META[current].code}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.4}
          aria-hidden="true"
          className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-180')}
        />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute right-0 top-full z-50 m-0 mt-2 min-w-[190px] list-none overflow-hidden rounded-14 border border-line bg-white p-1 shadow-sheet"
      >
        {LOCALES.map((loc) => {
          const active = loc === current;
          return (
            <li key={loc}>
              <LocaleLink
                locale={loc}
                href={hrefFor(loc)}
                active={active}
                onPick={pick}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-3 rounded-10 px-3 text-[15px] no-underline hover:bg-paper',
                  active ? 'font-semibold text-ink' : 'text-graphite',
                )}
              >
                <span>
                  <span className="num mr-2 inline-block w-6 text-[13px] text-cool">{LOCALE_META[loc].code}</span>
                  {LOCALE_META[loc].nativeName}
                </span>
                {active && <Check size={18} strokeWidth={2.4} className="text-ruby" aria-hidden="true" />}
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
