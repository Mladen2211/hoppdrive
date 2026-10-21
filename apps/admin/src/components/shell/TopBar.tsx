'use client';

/**
 * Top bars. Tablet / desktop (>= 768 px): 68 px bar with the search (input on desktop, icon button on
 * tablet), the "Neue Buchung" action and the notification bell. Mobile (< 768 px): 60 px bar with the
 * wordmark (Übersicht) or the page title (with a back arrow for pages under "Mehr").
 * Both respect the iOS safe-area inset at the top (installed PWA).
 */
import { ChevronLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Logo } from '@/components/ui';
import { DesktopSearch, SearchOverlayButton } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { useTranslations } from 'next-intl';

export function TopBar({
  isDesktop,
  onNewBooking,
}: {
  isDesktop: boolean;
  /** Undefined when the role may not create bookings (the button is hidden). */
  onNewBooking?: () => void;
}) {
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-30 flex h-[calc(68px+env(safe-area-inset-top))] flex-none items-center gap-3 border-b border-line bg-card px-6 pt-[env(safe-area-inset-top)] lg:gap-4 lg:px-8">
      {isDesktop ? <DesktopSearch /> : <SearchOverlayButton />}
      <div className="ml-auto flex items-center gap-3">
        {onNewBooking && (
          <Button onClick={onNewBooking} iconLeft={<Plus size={20} aria-hidden="true" />}>
            {t('common.neueBuchung')}
          </Button>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}

export function MobileTopBar({ title, isOverview, showBack }: { title: string; isOverview: boolean; showBack: boolean }) {
  const t = useTranslations();
  const router = useRouter();

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  }

  return (
    <header className="sticky top-0 z-30 flex h-[calc(60px+env(safe-area-inset-top))] flex-none items-center gap-2.5 border-b border-line bg-card px-4 pt-[env(safe-area-inset-top)]">
      {isOverview ? (
        <Link href="/" aria-label={t('shell.hoppDriveAdminUebersicht')} className="flex items-center rounded-lg">
          <Logo variant="horizontal" height={24} alt="" priority />
        </Link>
      ) : (
        <>
          {showBack && (
            <button type="button" onClick={goBack} aria-label={t('common.zurueck')} className="ib -ml-2 !h-12 !w-12">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          <span className="h2 min-w-0 truncate">{title}</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        <SearchOverlayButton />
        <NotificationBell />
      </div>
    </header>
  );
}
