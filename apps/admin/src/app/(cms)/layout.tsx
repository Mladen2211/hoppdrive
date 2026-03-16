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
  Settings,
  LogOut,
  User,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';

const navItems = [
  { href: '/', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/fleet', label: 'Flotte', icon: Car },
  { href: '/availability', label: 'Kalender', icon: CalendarDays },
  { href: '/inquiries', label: 'Anfragen', icon: MessageSquare },
  { href: '/reports', label: 'Berichte', icon: BarChart3 },
];

const bottomItems = [
  { href: '/settings', label: 'Website', icon: Settings },
  { href: '/profile', label: 'Profil', icon: User },
];

function AdminSidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
          active
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
        }`}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-neutral-200 z-40 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-neutral-700"
          aria-label="Menü öffnen"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Image src="/logo-header.png" alt="HoppDrive" width={100} height={28} className="h-7 w-auto ml-3" />
      </div>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-neutral-200 z-50 transition-transform duration-200 flex flex-col w-52 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo area */}
        <div className="h-14 flex items-center justify-between px-4 shrink-0">
          <Image src="/logo-header.png" alt="HoppDrive" width={100} height={28} className="h-6 w-auto" />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-neutral-100 px-3 py-2 space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-all w-full"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span>Abmelden</span>
          </button>
        </div>

        {/* User info */}
        {admin && (
          <div className="border-t border-neutral-100 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
                {(admin.firstName?.[0] || admin.name?.[0] || 'A').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {admin.firstName && admin.lastName
                    ? `${admin.firstName} ${admin.lastName}`
                    : admin.name || 'Admin'}
                </p>
                <p className="text-[11px] text-neutral-400 truncate">{admin.email}</p>
              </div>
            </div>
          </div>
        )}
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
    <div className="min-h-screen bg-neutral-50">
      <AdminSidebar />
      <main className="lg:pl-52 pt-14 lg:pt-0">
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
