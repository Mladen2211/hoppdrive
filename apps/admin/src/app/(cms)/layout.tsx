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
  Globe,
  FileSignature,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';

const navItems = [
  { href: '/', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/fleet', label: 'Flotte', icon: Car },
  { href: '/availability', label: 'Kalender', icon: CalendarDays },
  { href: '/contracts', label: 'Verträge', icon: FileSignature },
  { href: '/inquiries', label: 'Anfragen', icon: MessageSquare },
  { href: '/reports', label: 'Berichte', icon: BarChart3 },
  { href: '/settings', label: 'Website', icon: Globe },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Übersicht',
  '/fleet': 'Flotte',
  '/availability': 'Kalender',
  '/contracts': 'Verträge',
  '/inquiries': 'Anfragen',
  '/reports': 'Berichte',
  '/settings': 'Website-Einstellungen',
  '/profile': 'Profil',
};

function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // On mobile the sidebar always shows full content regardless of collapsed state
  const compact = collapsed && !mobileOpen;

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        title={compact ? label : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
          compact ? 'justify-center !px-2' : ''
        } ${
          active
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
        }`}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!compact && <span>{label}</span>}
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

      {/* Sidebar — sits behind main content for depth effect */}
      <aside
        className={`fixed top-0 left-0 h-full bg-neutral-100/80 transition-all duration-200 flex flex-col ${
          compact ? 'w-[72px]' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0 z-50 !bg-white shadow-xl !w-64' : '-translate-x-full z-[5]'
        } lg:translate-x-0 lg:z-[5]`}
      >
        {/* Logo area */}
        <div className={`h-14 flex items-center shrink-0 ${
          compact ? 'justify-center px-2' : 'justify-between px-4'
        }`}>
          {!compact && (
            <Image src="/logo-header.png" alt="HoppDrive" width={100} height={28} className="h-6 w-auto" />
          )}
          {/* Collapse / expand toggle — desktop only */}
          <button
            onClick={onToggle}
            className="hidden lg:flex p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
            aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
            title={collapsed ? 'Ausklappen' : 'Einklappen'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-[18px] h-[18px]" />
              : <PanelLeftClose className="w-[18px] h-[18px]" />}
          </button>
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            aria-label="Menü schliessen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className={`flex-1 py-2 space-y-0.5 overflow-y-auto ${compact ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className={`border-t border-neutral-200/60 py-2 space-y-0.5 ${compact ? 'px-2' : 'px-3'}`}>
          <button
            onClick={logout}
            title={compact ? 'Abmelden' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-all w-full ${
              compact ? 'justify-center !px-2' : ''
            }`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!compact && <span>Abmelden</span>}
          </button>
        </div>

        {/* User info */}
        {admin && (
          <div className={`border-t border-neutral-200/60 py-3 shrink-0 ${
            compact ? 'px-2 flex justify-center' : 'px-4'
          }`}>
            {compact ? (
              <Link href="/profile" title={admin.firstName || admin.name || 'Profil'}>
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                  {(admin.firstName?.[0] || admin.name?.[0] || 'A').toUpperCase()}
                </div>
              </Link>
            ) : (
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
            )}
          </div>
        )}
      </aside>
    </>
  );
}

/** Top navbar inside main content area */
function AdminTopbar() {
  const pathname = usePathname();
  const { admin } = useAdminAuth();

  const pageTitle = PAGE_TITLES[pathname] || '';

  return (
    <header className="h-14 border-b border-neutral-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 lg:px-8 shrink-0 sticky top-0 z-20">
      <h1 className="text-base font-semibold text-neutral-800 hidden lg:block">{pageTitle}</h1>
      <div className="lg:hidden" />

      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className={`p-2 rounded-lg transition-colors ${
            pathname === '/settings'
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
          }`}
          title="Website-Einstellungen"
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>

        <Link
          href="/profile"
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${
            pathname === '/profile'
              ? 'bg-neutral-100'
              : 'hover:bg-neutral-100'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {(admin?.firstName?.[0] || admin?.name?.[0] || 'A').toUpperCase()}
          </div>
          <span className="text-sm font-medium text-neutral-700 hidden sm:block">
            {admin?.firstName || admin?.name || 'Admin'}
          </span>
        </Link>
      </div>
    </header>
  );
}

const PUBLIC_ROUTES = ['/login', '/reset-password'];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, token } = useAdminAuth();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

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
    <div className="min-h-screen bg-neutral-200/60">
      <AdminSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      {/* Main content floats above sidebar for depth */}
      <main className={`${collapsed ? 'lg:pl-14' : 'lg:pl-56'} pt-14 lg:pt-0 min-h-screen relative z-10 transition-[padding] duration-200`}>
        <div className="min-h-screen bg-white lg:rounded-l-[20px] lg:shadow-[−12px_0_40px_rgba(0,0,0,0.08),−2px_0_8px_rgba(0,0,0,0.04)] flex flex-col"
          style={{ boxShadow: '-12px 0 40px rgba(0,0,0,0.08), -2px 0 8px rgba(0,0,0,0.04)' }}
        >
          <AdminTopbar />
          <div className="flex-1 p-6 lg:p-8">{children}</div>
        </div>
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
