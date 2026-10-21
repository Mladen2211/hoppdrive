'use client';

/**
 * Mobile navigation (< 768 px): fixed bottom bar with Übersicht, Anfragen, Verträge, Kalender and
 * "Mehr" (a bottom sheet with the remaining pages, the profile and logout). 56 px targets, safe-area
 * padding for the iOS home indicator. "Mehr" is the current item while a page from the sheet is open.
 */
import { Ellipsis, LogOut, Plus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Drawer, cn } from '@/components/ui';
import { NAV_GROUPS, fullName, type NavItem } from './nav-config';
import { useTranslations } from 'next-intl';

interface BottomNavProps {
  items: NavItem[];
  pathname: string;
  tab: string | null;
  counts: Record<string, number>;
  user: { firstName?: string | null; lastName?: string | null; name?: string | null } | null;
  roleLabel: string;
  onLogout: () => void;
  /** Present when the role may create bookings: adds "Neue Buchung" to the sheet. */
  onNewBooking?: () => void;
}

export function BottomNav({ items, pathname, tab, counts, user, roleLabel, onLogout, onNewBooking }: BottomNavProps) {
  const t = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = items.filter((item) => item.primary);
  const more = items.filter((item) => !item.primary);
  const moreActive = more.some((item) => item.isActive(pathname, tab)) || pathname.startsWith('/profile');
  const name = fullName(user);

  const itemClass =
    'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold no-underline';

  return (
    <>
      <nav
        aria-label={t('shell.hauptnavigation')}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname, tab);
          const count = item.badge ? counts[item.badge] || 0 : 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(itemClass, active ? 'text-ruby-dark' : 'text-graphite')}
            >
              <Icon size={22} aria-hidden="true" />
              {item.label}
              {count > 0 && (
                <span className="absolute left-[calc(50%+6px)] top-0.5 min-w-[18px] rounded-full bg-ruby px-1.5 text-center text-[11px] font-bold text-white">
                  {count > 99 ? '99+' : count}
                  <span className="sr-only"> {t('shell.offen')}</span>
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive ? 'page' : undefined}
          className={cn(itemClass, moreActive ? 'text-ruby-dark' : 'text-graphite')}
        >
          <Ellipsis size={22} aria-hidden="true" />
          {t('shell.mehr')}
        </button>
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title={t('shell.mehr')} mode="sheet">
        <div className="-mx-1 flex flex-col gap-1">
          {onNewBooking && (
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onNewBooking();
              }}
              className="btn btn-p btn-b mb-2"
            >
              <Plus size={20} aria-hidden="true" />
              {t('common.neueBuchung')}
            </button>
          )}
          {NAV_GROUPS.map((group) => {
            const groupItems = more.filter((item) => item.group === group.id);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.id} className="flex flex-col gap-1">
                <div className="px-3 pb-1 pt-2 text-[13px] font-semibold text-graphite">{group.label}</div>
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(pathname, tab);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[52px] items-center gap-3 rounded-10 px-3 font-medium no-underline',
                        active ? 'bg-ruby-tint font-bold text-ruby-dark' : 'text-ink hover:bg-paper',
                      )}
                    >
                      <Icon size={22} aria-hidden="true" className="flex-none" />
                      <span className="flex-1">{item.label}</span>
                      {item.isNew && <span className="st s-vio !h-[22px] !text-xs">{t('common.neu')}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <div className="mt-2 flex flex-col gap-1 border-t border-line-soft pt-3">
            <Link
              href="/profile"
              onClick={() => setMoreOpen(false)}
              aria-current={pathname.startsWith('/profile') ? 'page' : undefined}
              className="flex min-h-[56px] items-center gap-3 rounded-10 px-3 no-underline hover:bg-paper"
            >
              <Avatar name={name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{name}</span>
                <span className="sm mut block">{t('shell.profil', { roleLabel })}</span>
              </span>
              <UserRound size={20} aria-hidden="true" className="text-graphite" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onLogout();
              }}
              className="flex min-h-[52px] items-center gap-3 rounded-10 px-3 text-left font-medium text-ink hover:bg-paper"
            >
              <LogOut size={22} aria-hidden="true" className="flex-none" />
              {t('shell.abmelden')}
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
