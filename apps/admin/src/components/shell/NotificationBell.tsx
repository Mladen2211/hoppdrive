'use client';

/**
 * Notification bell with the unread counter and the notification panel.
 * Logic kept from the old shell: GET /notifications on mount and every 30 s, polling stops after
 * 5 consecutive failures (any success resets the streak), "Alle gelesen" and click-to-read update
 * optimistically, the badge caps at "99+". New: a clicked notification opens its target
 * (inquiry / contract), the panel closes on Escape and returns focus to the bell.
 */
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IconButton, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtRelative } from '@/lib/format';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

interface NotificationItem {
  id: string;
  type?: string;
  title: string;
  body?: string;
  refId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

const POLL_MS = 30_000;
const MAX_FAILURES = 5;

function targetFor(n: NotificationItem): string | null {
  if (!n.refId) return null;
  if (n.type === 'NEW_INQUIRY') return `/inquiries?id=${n.refId}`;
  if (n.type === 'BOOKING_CREATED' || n.type === 'CONTRACT_EXPIRING') return `/contracts?id=${n.refId}`;
  return null;
}

export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const failCountRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications((data.items ?? []) as NotificationItem[]);
      setUnreadCount(data.unreadCount ?? 0);
      failCountRef.current = 0; // a success resets the failure streak
    } catch {
      failCountRef.current += 1;
    }
  }, []);

  // Fetch on mount, then every 30 s; stop polling after 5 consecutive failures.
  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      if (failCountRef.current < MAX_FAILURES) void fetchNotifications();
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  // Close on an outside click.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch (err) {
      toast.error(tr('shell.benachrichtigungenKonntenNicht'), errorText(err));
    }
  }

  async function handleOpenNotification(n: NotificationItem) {
    const target = targetFor(n);
    if (!n.readAt) {
      try {
        await api.markNotificationRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        toast.error(tr('shell.benachrichtigungKonnteNichtAkt'), errorText(err));
      }
    }
    if (target) {
      setOpen(false);
      router.push(target);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  const label = unreadCount > 0 ? t('shell.benachrichtigungenUngelesen', { unreadCount }) : t('shell.benachrichtigungen');

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <IconButton
        ref={buttonRef}
        variant="outline"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
        badge={unreadCount > 99 ? '99+' : unreadCount}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} aria-hidden="true" />
      </IconButton>

      {open && (
        <div
          id="notification-panel"
          role="dialog"
          aria-label={t('shell.benachrichtigungen')}
          className="fixed inset-x-3 top-[64px] z-50 animate-pop overflow-hidden rounded-2xl border border-line bg-card shadow-modal md:absolute md:inset-x-auto md:right-0 md:top-[calc(100%+8px)] md:w-[380px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <h2 className="h3">{t('shell.benachrichtigungen')}</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="min-h-[44px] px-1 text-sm font-semibold text-ruby-dark underline max-md:min-h-[48px]"
              >
                {t('shell.alleGelesen')}
              </button>
            )}
          </div>
          <div className="max-h-[min(420px,calc(100dvh-160px))] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-graphite">{t('shell.keineBenachrichtigungen')}</div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-line-soft last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void handleOpenNotification(n)}
                      className={cn(
                        'flex min-h-[56px] w-full items-start gap-3 px-4 py-3 text-left hover:bg-paper focus-visible:bg-paper max-md:min-h-[64px]',
                        !n.readAt && 'bg-ruby-tint/40',
                      )}
                    >
                      <span
                        className={cn('mt-[7px] h-2.5 w-2.5 flex-none rounded-full', n.readAt ? 'border-2 border-line' : 'bg-ruby')}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{n.readAt ? t('shell.gelesen') : t('shell.ungelesen')}</span>
                        <span className={cn('block truncate', n.readAt ? 'font-medium' : 'font-bold')}>{n.title}</span>
                        {n.body && <span className="sm mut line-clamp-2 block">{n.body}</span>}
                        <span className="sm mut mt-0.5 block">{fmtRelative(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
