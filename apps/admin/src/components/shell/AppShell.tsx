'use client';

/**
 * The signed-in admin shell: auth guard + navigation + top bar + content frame.
 *
 *  - public routes (/login, /forgot-password, /reset-password, /accept-invite, /offline): no shell
 *  - while the session loads: spinner; without a token: nothing (useAdminAuth redirects to /login)
 *  - >= 1024 px: 264 px sidebar (collapsible to the 76 px rail, remembered in localStorage)
 *  - 768-1023 px: 76 px icon rail
 *  - < 768 px: no sidebar; 60 px top bar + fixed bottom navigation ("Mehr" sheet)
 *  - routes whose permission area is 'none' for the role render <NoAccess /> instead of the page
 *
 * Conventions for pages (see the report): the page renders into <main> (padding 16 / 24 / 32 px,
 * extra bottom padding on mobile so nothing hides behind the bottom nav); the sticky top bar
 * height is exposed as `--drawer-offset` for <Drawer> inside <DrawerLayout>; the toast stack is
 * lifted above the bottom nav through `--toast-offset`.
 */
import { Plus } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useAppLocale } from '@/i18n/I18nProvider';
import { permissionLevel } from '@hoppdrive/shared';
import { tr } from '@/i18n/active';
import { NoAccess, Spinner, cn, useMediaQuery } from '@/components/ui';
import { useNewBooking } from '@/components/NewBookingModal';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { BottomNav } from './BottomNav';
import { NAV_ITEMS, areaForPath, isPublicRoute, pageTitleFor } from './nav-config';
import { ShellCountsProvider, useShellCounts } from './ShellCounts';
import { Sidebar } from './Sidebar';
import { MobileTopBar, TopBar } from './TopBar';
import { useTranslations } from 'next-intl';

const COLLAPSE_KEY = 'sidebar-collapsed';

function FullPageSpinner() {
  const t = useTranslations();
  return (
    <div className="flex h-dvh items-center justify-center bg-paper">
      <Spinner size={32} label={t('shell.wirdGeladen')} className="text-ruby-fg" />
    </div>
  );
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

function ShellFrame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { locale } = useAppLocale();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab') ?? null;
  const { admin, role, logout } = useAdminAuth();
  const { pendingInquiries, pendingContracts } = useShellCounts();
  const booking = useNewBooking();

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const isMobile = !isTabletUp;

  // Only mounted after the session loaded (client side), so reading localStorage here is safe.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const rail = !isDesktop || collapsed;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* storage full or blocked: the state still works for this session */
      }
      return next;
    });
  }, []);

  // Lift the toasts above the mobile bottom navigation.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--toast-offset', isMobile ? '84px' : '16px');
    return () => {
      root.style.removeProperty('--toast-offset');
    };
  }, [isMobile]);

  const roleLabel = role ? tr(`roles.${role}`) : '';
  const items = NAV_ITEMS.filter((item) => !item.area || permissionLevel(role, item.area) !== 'none');
  const counts: Record<string, number> = { inquiries: pendingInquiries, contracts: pendingContracts };

  const area = areaForPath(pathname, tab);
  const blocked = Boolean(area && role && permissionLevel(role, area) === 'none');

  const activeItem = NAV_ITEMS.find((item) => item.isActive(pathname, tab));
  const showBack = (pathname !== '/' && Boolean(activeItem && !activeItem.primary)) || pathname.startsWith('/profile');
  const title = pageTitleFor(pathname) || activeItem?.label || '';

  const openNewBooking = booking.canCreate ? () => booking.open() : undefined;
  const showFab = isMobile && booking.canCreate && pathname.startsWith('/availability');

  return (
    <div
      className="min-h-dvh bg-paper font-sans text-[15px] leading-normal text-ink antialiased"
      style={{ '--drawer-offset': 'calc(68px + env(safe-area-inset-top))' } as CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only z-[80] rounded-lg bg-card px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('shell.zumInhaltSpringen')}
      </a>

      <Sidebar
        items={items}
        pathname={pathname}
        tab={tab}
        rail={rail}
        canToggle={isDesktop}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        counts={counts}
        user={admin}
        roleLabel={roleLabel}
        onLogout={logout}
      />

      <div
        className={cn(
          'flex min-h-dvh min-w-0 flex-col transition-[padding] duration-300 ease-collapse motion-reduce:transition-none',
          rail ? 'md:pl-[76px]' : 'md:pl-[264px]',
        )}
      >
        {isMobile ? (
          <MobileTopBar title={title} isOverview={pathname === '/'} showBack={showBack} />
        ) : (
          <TopBar isDesktop={isDesktop} onNewBooking={openNewBooking} />
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 outline-none max-md:pb-[calc(96px+env(safe-area-inset-bottom))] md:p-6 lg:p-8"
        >
          {!role ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner size={28} label={t('shell.berechtigungenWerdenGeladen')} className="text-ruby-fg" />
            </div>
          ) : blocked ? (
            <div className="panel mx-auto flex min-h-[60vh] max-w-[720px] flex-col justify-center">
              <NoAccess roleName={tr(`roles.${role}`)} />
            </div>
          ) : (
            // A language change remounts the page, so memoised labels and fetched texts are rebuilt in the new language.
            <Fragment key={locale}>{children}</Fragment>
          )}
        </main>
      </div>

      {isMobile && (
        <BottomNav
          items={items}
          pathname={pathname}
          tab={tab}
          counts={counts}
          user={admin}
          roleLabel={roleLabel}
          onLogout={logout}
          onNewBooking={openNewBooking}
        />
      )}

      {showFab && (
        <button
          type="button"
          onClick={() => booking.open()}
          aria-label={t('common.neueBuchung')}
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-ruby text-white shadow-[0_8px_20px_rgba(166,14,14,.35)] hover:bg-ruby-hover"
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, token } = useAdminAuth();

  // Login, password reset, invite and offline pages render on their own.
  if (isPublicRoute(pathname)) return <>{children}</>;
  if (loading) return <FullPageSpinner />;
  if (!token) return null; // useAdminAuth redirects to /login

  return (
    <ShellCountsProvider>
      <Suspense fallback={<FullPageSpinner />}>
        <ShellFrame>{children}</ShellFrame>
      </Suspense>
    </ShellCountsProvider>
  );
}
