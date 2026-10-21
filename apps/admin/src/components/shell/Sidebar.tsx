'use client';

/**
 * Desktop sidebar (264 px, groups Betrieb / Inhalte / System) and the 76 px icon rail
 * (tablet 768-1023 px automatically; on desktop after the collapse toggle, remembered in
 * localStorage['sidebar-collapsed']).
 */
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Avatar, Logo, StatusPill, cn } from '@/components/ui';
import { NAV_GROUPS, fullName, shortName, type NavItem } from './nav-config';
import { useTranslations } from 'next-intl';

interface SidebarProps {
  items: NavItem[];
  pathname: string;
  tab: string | null;
  rail: boolean;
  /** Show the collapse toggle (desktop only). */
  canToggle: boolean;
  collapsed: boolean;
  onToggle: () => void;
  counts: Record<string, number>;
  user: { firstName?: string | null; lastName?: string | null; name?: string | null } | null;
  roleLabel: string;
  onLogout: () => void;
}

export function Sidebar({ items, pathname, tab, rail, canToggle, collapsed, onToggle, counts, user, roleLabel, onLogout }: SidebarProps) {
  const t = useTranslations();
  const name = fullName(user);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-card py-5 transition-[width] duration-300 ease-collapse motion-reduce:transition-none md:flex',
        rail ? 'w-[76px] px-3.5' : 'w-[264px] px-3.5',
      )}
    >
      {canToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t('shell.seitenleisteAusklappen') : t('shell.seitenleisteEinklappen')}
          aria-expanded={!collapsed}
          className="absolute -right-3.5 top-8 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-graphite shadow-sm hover:border-ruby hover:text-ruby-dark"
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" /> : <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />}
        </button>
      )}

      {/* Brand: full logo (car + wordmark) in the sidebar, compact stacked logo in the rail */}
      <Link
        href="/"
        aria-label={t('shell.hoppDriveAdminUebersicht')}
        className={cn('flex flex-none items-center rounded-lg pb-[22px] pt-1 no-underline', rail ? '-mx-2 justify-center' : 'px-2.5')}
      >
        {rail ? (
          <Logo variant="stacked" height={26} alt="" priority />
        ) : (
          <Logo variant="horizontal" height={26} alt="" priority />
        )}
      </Link>

      <nav aria-label={t('shell.hauptnavigation')} className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-1">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.id);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.id} className="flex flex-col gap-1">
              {!rail && <div className="px-3 pb-1.5 pt-3.5 text-[13px] font-semibold text-graphite">{group.label}</div>}
              {groupItems.map((item) => {
                const Icon = item.icon;
                const active = item.isActive(pathname, tab);
                const count = item.badge ? counts[item.badge] || 0 : 0;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-label={rail ? `${item.label}${count > 0 ? t('shell.offen2', { num: count }) : ''}` : undefined}
                    title={rail ? item.label : undefined}
                    className={cn(
                      'relative flex min-h-[44px] items-center gap-3 rounded-10 font-medium no-underline hover:bg-paper hover:text-ink',
                      rail ? 'justify-center px-0' : 'px-3',
                      active ? 'bg-ruby-tint font-bold text-ruby-dark hover:bg-ruby-tint hover:text-ruby-dark' : 'text-graphite',
                    )}
                  >
                    <Icon size={20} aria-hidden="true" className="flex-none" />
                    {!rail && <span className="min-w-0 flex-1 leading-tight">{item.label}</span>}
                    {count > 0 && (
                      <span
                        className={cn(
                          'rounded-full bg-ruby text-center font-bold text-white',
                          rail ? 'absolute right-1.5 top-1 min-w-[18px] px-1 text-[11px] leading-[18px]' : 'ml-auto min-w-[22px] px-2 py-px text-xs',
                        )}
                      >
                        {count > 99 ? '99+' : count}
                        {!rail && <span className="sr-only"> {t('shell.offen')}</span>}
                      </span>
                    )}
                    {!rail && item.isNew && <StatusPill tone="vio" label={t('common.neu')} className="!h-[22px] flex-none !text-xs" />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Signed-in user */}
      <div className={cn('mt-2 flex flex-none border-t border-line-soft pt-3.5', rail ? 'flex-col items-center gap-1' : 'items-center gap-2.5')}>
        <Link
          href="/profile"
          aria-label={t('shell.profilVon', { name })}
          title={rail ? `${name}, ${roleLabel}` : undefined}
          className={cn('flex min-w-0 items-center gap-2.5 rounded-lg no-underline', !rail && 'flex-1')}
        >
          <Avatar name={name} />
          {!rail && (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{shortName(user)}</span>
              <span className="sm mut block truncate">{roleLabel}</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          aria-label={t('shell.abmelden')}
          title={t('shell.abmelden')}
          className="ib"
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
