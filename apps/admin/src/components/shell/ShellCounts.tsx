'use client';

/**
 * Open-work counts for the navigation badges: Anfragen (new inquiries) and Verträge (unsigned
 * contracts). They come from GET /dashboard, which every role may read. Refreshed on mount, every
 * 60 s (stops after 5 consecutive failures, like the notification bell), when the tab becomes
 * visible again and on demand: pages call `refresh()` after they change something, e.g.
 *
 *   const { refresh } = useShellCounts();
 *   await api.approveInquiry(...);
 *   refresh();
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

interface ShellCountsValue {
  pendingInquiries: number;
  pendingContracts: number;
  refresh: () => void;
}

const ShellCountsContext = createContext<ShellCountsValue>({
  pendingInquiries: 0,
  pendingContracts: 0,
  refresh: () => undefined,
});

export function useShellCounts(): ShellCountsValue {
  return useContext(ShellCountsContext);
}

const POLL_MS = 60_000;
const MAX_FAILURES = 5;

export function ShellCountsProvider({ children }: { children: ReactNode }) {
  const { token } = useAdminAuth();
  const [counts, setCounts] = useState({ pendingInquiries: 0, pendingContracts: 0 });
  const failuresRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const stats = await api.getDashboardStats();
      if (!mountedRef.current) return;
      failuresRef.current = 0;
      setCounts({
        pendingInquiries: Number(stats?.pendingInquiries) || 0,
        pendingContracts: Number(stats?.pendingContracts) || 0,
      });
    } catch {
      failuresRef.current += 1;
    }
  }, []);

  const refresh = useCallback(() => {
    failuresRef.current = 0;
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void load();
    const interval = window.setInterval(() => {
      if (failuresRef.current < MAX_FAILURES && document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && failuresRef.current < MAX_FAILURES) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, load]);

  const value = useMemo<ShellCountsValue>(() => ({ ...counts, refresh }), [counts, refresh]);
  return <ShellCountsContext.Provider value={value}>{children}</ShellCountsContext.Provider>;
}
