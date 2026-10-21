'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { AdminLocale, AdminRole, AdminTheme } from '@hoppdrive/shared';
import { api } from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  mustResetPassword: boolean;
  /** Missing only for sessions stored before roles existed; filled in from /auth/profile on start. */
  role?: AdminRole;
  /** UI language preference. Missing only for sessions stored before preferences existed. */
  locale?: AdminLocale;
  /** Theme preference ('light' | 'dark' | 'system'). Missing only for older stored sessions. */
  theme?: AdminTheme;
}

interface AdminAuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  /** Role of the signed-in admin (null while loading / signed out). Drives usePermission. */
  role: AdminRole | null;
  loading: boolean;
  login: (accessToken: string, adminUser: AdminUser) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  /**
   * Merges fields into the admin held in context AND sessionStorage.
   * Use it whenever the server changed something about the signed-in admin that the
   * auth guard looks at, e.g. updateAdmin({ mustResetPassword: false }).
   */
  updateAdmin: (partial: Partial<AdminUser>) => void;
  /**
   * Call after POST /auth/reset-password (forced reset) succeeded and BEFORE navigating away.
   * Without it the context keeps mustResetPassword=true and the guard bounces the user
   * straight back to /reset-password. Shorthand for updateAdmin({ mustResetPassword: false }).
   */
  markPasswordReset: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  admin: null,
  token: null,
  role: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshAuth: async () => {},
  updateAdmin: () => {},
  markPasswordReset: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

/** Routes that never require a session (login, reset / invite links, offline fallback). */
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/accept-invite', '/offline'];

function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_ROUTES.includes(path);
}

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode): the in-memory state still works */
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('admin');
  } catch {
    /* ignore */
  }
}

/** Keeps only the fields the app needs (the profile response also carries the large signature). */
function pickAdmin(source: any): AdminUser {
  return {
    id: source.id,
    email: source.email,
    name: source.name,
    firstName: source.firstName ?? null,
    lastName: source.lastName ?? null,
    phone: source.phone ?? null,
    mustResetPassword: !!source.mustResetPassword,
    role: source.role,
    locale: source.locale ?? 'de',
    theme: source.theme ?? 'system',
  };
}

/**
 * PWA / new-tab recovery: sessionStorage is empty after the installed app is closed, but the
 * httpOnly refresh cookie (7 days, rolling) still identifies the session. Shared between
 * concurrent callers (React StrictMode runs effects twice in development).
 */
let restorePromise: Promise<{ token: string; admin: AdminUser } | null> | null = null;

function restoreSessionFromCookie(): Promise<{ token: string; admin: AdminUser } | null> {
  if (!restorePromise) {
    restorePromise = (async () => {
      try {
        const result = await api.refreshToken();
        writeStorage('accessToken', result.accessToken); // the request interceptor reads it from here
        const source = result.admin ?? (await api.getProfile());
        const admin = pickAdmin(source);
        writeStorage('admin', JSON.stringify(admin));
        return { token: result.accessToken as string, admin };
      } catch {
        clearSession();
        return null;
      }
    })().finally(() => {
      restorePromise = null;
    });
  }
  return restorePromise;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const adminRef = useRef<AdminUser | null>(null);
  const initialPathname = useRef(pathname);

  const applyAdmin = useCallback((next: AdminUser | null) => {
    adminRef.current = next;
    setAdmin(next);
  }, []);

  const login = useCallback((accessToken: string, adminUser: AdminUser) => {
    // login() is also used to re-store a profile after an edit; callers that build the object by
    // hand may omit the role. Keep the known role for the same admin instead of wiping it.
    const previous = adminRef.current;
    const next =
      !adminUser.role && previous && previous.id === adminUser.id && previous.role
        ? { ...adminUser, role: previous.role }
        : adminUser;
    writeStorage('accessToken', accessToken);
    writeStorage('admin', JSON.stringify(next));
    setToken(accessToken);
    applyAdmin(next);
  }, [applyAdmin]);

  const logout = useCallback(() => {
    clearSession();
    applyAdmin(null);
    setToken(null);
    api.logout().catch(() => {});
    router.push('/login');
  }, [router, applyAdmin]);

  const updateAdmin = useCallback((partial: Partial<AdminUser>) => {
    const current = adminRef.current;
    if (!current) return;
    const next = { ...current, ...partial };
    writeStorage('admin', JSON.stringify(next));
    applyAdmin(next);
  }, [applyAdmin]);

  const markPasswordReset = useCallback(() => {
    updateAdmin({ mustResetPassword: false });
  }, [updateAdmin]);

  const refreshAuth = useCallback(async () => {
    try {
      const result = await api.refreshToken();
      writeStorage('accessToken', result.accessToken);
      if (result.admin) {
        const next = pickAdmin(result.admin);
        writeStorage('admin', JSON.stringify(next));
        applyAdmin(next);
      }
      setToken(result.accessToken);
    } catch {
      logout();
    }
  }, [logout, applyAdmin]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const storedToken = readStorage('accessToken');
      const storedAdmin = readStorage('admin');

      if (storedToken && storedAdmin) {
        try {
          const parsed: AdminUser = JSON.parse(storedAdmin);
          setToken(storedToken);
          applyAdmin(parsed);

          // Session saved before roles / preferences existed: fetch them once.
          if (!parsed.role || !parsed.locale || !parsed.theme) {
            api
              .getProfile()
              .then((profile) => {
                if (!cancelled) {
                  updateAdmin({
                    role: profile.role,
                    locale: profile.locale ?? 'de',
                    theme: profile.theme ?? 'system',
                  });
                }
              })
              .catch(() => {});
          }
        } catch {
          // Corrupted value – clear it and force re-login
          clearSession();
        }
        if (!cancelled) setLoading(false);
        return;
      }

      // No session in this tab. On a protected route, try the refresh cookie before giving up
      // (installed PWA: sessionStorage is empty after every launch).
      if (!isPublicRoute(initialPathname.current)) {
        const restored = await restoreSessionFromCookie();
        if (cancelled) return;
        if (restored) {
          setToken(restored.token);
          applyAdmin(restored.admin);
        }
      }
      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect unauthenticated users (except on public routes)
  useEffect(() => {
    if (loading) return;

    if (!token && !isPublicRoute(pathname)) {
      router.push('/login');
    }

    if (token && admin?.mustResetPassword && pathname !== '/reset-password') {
      router.push('/reset-password');
    }
  }, [loading, token, admin, pathname, router]);

  // Auto-refresh token every 13 minutes (tokens expire at 15 min)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(refreshAuth, 13 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, refreshAuth]);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        role: admin?.role ?? null,
        loading,
        login,
        logout,
        refreshAuth,
        updateAdmin,
        markPasswordReset,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}
