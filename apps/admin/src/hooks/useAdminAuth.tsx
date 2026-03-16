'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  mustResetPassword: boolean;
}

interface AdminAuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (accessToken: string, adminUser: AdminUser) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  admin: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshAuth: async () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

const PUBLIC_ROUTES = ['/login', '/reset-password'];

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((accessToken: string, adminUser: AdminUser) => {
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('admin', JSON.stringify(adminUser));
    setToken(accessToken);
    setAdmin(adminUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('admin');
    setAdmin(null);
    setToken(null);
    api.logout().catch(() => {});
    router.push('/login');
  }, [router]);

  const refreshAuth = useCallback(async () => {
    try {
      const result = await api.refreshToken();
      sessionStorage.setItem('accessToken', result.accessToken);
      if (result.admin) {
        sessionStorage.setItem('admin', JSON.stringify(result.admin));
        setAdmin(result.admin);
      }
      setToken(result.accessToken);
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('accessToken');
    const storedAdmin = sessionStorage.getItem('admin');

    if (storedToken && storedAdmin) {
      setToken(storedToken);
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch {
        // Corrupted value – clear it and force re-login
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('admin');
      }
    }
    setLoading(false);
  }, []);

  // Redirect unauthenticated users (except on public routes)
  useEffect(() => {
    if (loading) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!token && !isPublicRoute) {
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
    <AdminAuthContext.Provider value={{ admin, token, loading, login, logout, refreshAuth }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
