'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Car,
  CalendarDays,
  MessageSquare,
  BarChart3,
  LogOut,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';

const navItems = [
  { href: '/', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/fleet', label: 'Flottenmanager', icon: Car },
  { href: '/availability', label: 'Verfügbarkeit', icon: CalendarDays },
  { href: '/inquiries', label: 'Anfragen', icon: MessageSquare },
  { href: '/reports', label: 'Berichte', icon: BarChart3 },
];

function AdminSidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-neutral-900 z-40 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white"
          aria-label="Menü öffnen"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Image src="/logo-header.png" alt="HoppDrive" width={100} height={28} className="h-7 w-auto ml-3" />
      </div>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-neutral-900 text-white z-50 transition-all duration-200 flex flex-col ${
          collapsed ? 'w-16' : 'w-60'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Logo area */}
        <div className="h-14 flex items-center px-4 border-b border-neutral-800 shrink-0">
          {!collapsed && (
            <Image src="/logo-header.png" alt="HoppDrive" width={100} height={28} className="h-7 w-auto" />
          )}
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              setMobileOpen(false);
            }}
            className={`ml-auto text-neutral-400 hover:text-white hidden lg:block ${
              collapsed ? 'mx-auto' : ''
            }`}
            aria-label={collapsed ? 'Seitenleiste erweitern' : 'Seitenleiste einklappen'}
          >
            <ChevronLeft
              className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div className="border-t border-neutral-800 p-3 shrink-0">
          {!collapsed && admin && (
            <p className="text-xs text-neutral-500 mb-2 truncate">{admin.email}</p>
          )}
          <button
            onClick={logout}
            className={`flex items-center gap-2 text-neutral-400 hover:text-red-400 text-sm transition-colors w-full ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Abmelden' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Abmelden</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

const PUBLIC_ROUTES = ['/login', '/reset-password'];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, token } = useAdminAuth();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Public routes (login, reset) render without sidebar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // While checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  // Not authenticated (redirect happens in provider)
  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <AdminSidebar />
      <main className="lg:pl-60 pt-14 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
