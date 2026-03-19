'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutGrid,
  CarFront,
  CalendarDays,
  MessageSquare,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  FileText,
  ChevronRight,
  ChevronLeft,
  Bell,
  Search,
  MapPin,
  Star,
  HelpCircle,
  Home,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Übersicht', icon: LayoutGrid },
  { href: '/fleet', label: 'Flotte', icon: CarFront },
  { href: '/availability', label: 'Kalender', icon: CalendarDays },
  { href: '/contracts', label: 'Verträge', icon: FileText },
  { href: '/inquiries', label: 'Anfragen', icon: MessageSquare },
  { href: '/locations', label: 'Standorte', icon: MapPin },
  { href: '/testimonials', label: 'Bewertungen', icon: Star },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
  { href: '/homepage', label: 'Homepage', icon: Home },
  { href: '/reports', label: 'Berichte', icon: BarChart2 },
  { href: '/settings', label: 'Website', icon: Globe },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Übersicht',
  '/fleet': 'Flotte',
  '/availability': 'Kalender',
  '/contracts': 'Verträge',
  '/inquiries': 'Anfragen',
  '/locations': 'Standorte',
  '/testimonials': 'Kundenstimmen',
  '/faq': 'FAQ',
  '/homepage': 'Homepage-Sektionen',
  '/reports': 'Berichte',
  '/settings': 'Website-Einstellungen',
  '/profile': 'Profil',
};

/* ------------------------------------------------------------------ */
/*  Search Dropdown                                                   */
/* ------------------------------------------------------------------ */
const CATEGORY_LABELS: Record<string, string> = {
  vehicles: 'Fahrzeuge',
  bookings: 'Buchungen',
  inquiries: 'Anfragen',
  locations: 'Standorte',
  invoices: 'Rechnungen',
};

const CATEGORY_ROUTES: Record<string, string> = {
  vehicles: '/fleet',
  bookings: '/contracts',
  inquiries: '/inquiries',
  locations: '/locations',
  invoices: '/contracts',
};

function SearchDropdown() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({}); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await api.globalSearch(q);
      setResults(data);
      setOpen(true);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasResults = Object.values(results).some((arr) => arr?.length > 0);

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (hasResults) setOpen(true); }}
        placeholder="Suche..."
        className="pl-9 pr-4 py-2 bg-slate-100/50 border border-transparent rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-400 w-64 transition-all placeholder:text-slate-400 shadow-sm"
      />
      {open && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-slate-400">Suche…</div>
          )}
          {!loading && !hasResults && query.length >= 2 && (
            <div className="px-4 py-3 text-sm text-slate-400">Keine Ergebnisse für &quot;{query}&quot;</div>
          )}
          {!loading && Object.entries(results).map(([category, items]) => {
            if (!items?.length) return null;
            return (
              <div key={category}>
                <div className="px-4 py-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase bg-slate-50">
                  {CATEGORY_LABELS[category] || category}
                </div>
                {items.map((item: any) => (
                  <Link
                    key={item.id}
                    href={CATEGORY_ROUTES[category] || '/'}
                    onClick={() => { setOpen(false); setQuery(''); }}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-red-50/50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-900 truncate">{item.label}</span>
                    {item.status && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                        {item.status}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notification Bell                                                 */
/* ------------------------------------------------------------------ */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* ignore */ }
  }, []);

  // Fetch on mount + every 30s
  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30000);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkAllRead() {
    await api.markAllNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  async function handleMarkRead(id: string) {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100/50 rounded-lg transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white shadow-sm px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Benachrichtigungen</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Alle gelesen
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                Keine Benachrichtigungen
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.readAt) handleMarkRead(n.id); }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.readAt ? 'bg-red-50/30' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString('de-CH')} – {new Date(n.createdAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */
function AdminSidebar({
  isExpanded,
  setIsExpanded,
  isMobileOpen,
  setIsMobileOpen,
}: {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();

  return (
    <aside
      className={`
        fixed md:relative inset-y-0 left-0 z-50
        bg-white/90 backdrop-blur-2xl border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        transition-all duration-[400ms] ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isExpanded ? 'w-72' : 'w-[84px]'}
      `}
    >
      {/* Circular collapse toggle — desktop only */}
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          localStorage.setItem('sidebar-collapsed', String(isExpanded));
        }}
        className="hidden md:flex absolute -right-3.5 top-8 w-7 h-7 bg-white border border-slate-200 shadow-sm rounded-full items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-200 transition-all z-50 hover:scale-105"
      >
        {isExpanded ? <ChevronLeft size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />}
      </button>

      {/* Mobile close */}
      <button
        onClick={() => setIsMobileOpen(false)}
        className="md:hidden absolute right-4 top-5 text-slate-400 hover:text-slate-700"
      >
        <X size={20} />
      </button>

      {/* Logo area */}
      <div className={`h-[72px] flex items-center shrink-0 transition-all duration-300 ${isExpanded ? 'px-6' : 'px-0 justify-center'}`}>
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <Image src="/logo-header.png" alt="HoppDrive" width={120} height={32} className="h-7 w-auto" />
          ) : (
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] shrink-0">
              <CarFront size={20} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-4 space-y-1.5">
        <div className={`px-2 mb-4 text-[11px] font-bold tracking-widest text-slate-400 uppercase transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 mb-0 overflow-hidden'}`}>
          Hauptmenü
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              title={!isExpanded ? item.label : undefined}
              className={`relative flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group overflow-hidden ${
                active ? 'text-red-700 font-medium' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {/* Active background + accent bar */}
              {active && (
                <>
                  <div className="absolute inset-0 bg-red-50 opacity-80 rounded-xl" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-red-600 rounded-r-full" />
                </>
              )}

              {/* Hover background */}
              {!active && (
                <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl -z-10" />
              )}

              <div className={`flex items-center z-10 ${isExpanded ? '' : 'mx-auto'}`}>
                <Icon
                  className={`w-5 h-5 shrink-0 transition-all duration-300 ${
                    active
                      ? 'text-red-600 drop-shadow-sm'
                      : 'text-slate-400 group-hover:text-slate-600 group-hover:scale-110'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`transition-all duration-300 whitespace-nowrap ${
                    isExpanded
                      ? 'ml-3 w-auto opacity-100 translate-x-0'
                      : 'ml-0 w-0 opacity-0 -translate-x-4 hidden'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User area */}
      <div className="p-4 shrink-0">
        <div
          className={`flex items-center border border-slate-200/60 shadow-sm transition-all duration-300 overflow-hidden ${
            isExpanded
              ? 'p-3 bg-white rounded-2xl justify-between'
              : 'p-2 bg-transparent border-transparent justify-center'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/profile" title={!isExpanded ? (admin?.firstName || admin?.name || 'Profil') : undefined}>
              <div className={`w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 ring-2 ring-white transition-all ${!isExpanded && 'hover:ring-red-100 cursor-pointer'}`}>
                {(admin?.firstName?.[0] || admin?.name?.[0] || 'A').toUpperCase()}
              </div>
            </Link>
            <div className={`flex flex-col truncate transition-all duration-300 ${isExpanded ? 'w-[100px] opacity-100' : 'w-0 opacity-0 hidden'}`}>
              <span className="text-sm font-semibold text-slate-900 truncate">
                {admin?.firstName && admin?.lastName
                  ? `${admin.firstName} ${admin.lastName}`
                  : admin?.name || 'Admin'}
              </span>
              <span className="text-[11px] text-slate-500 truncate">{admin?.email || 'HoppDrive'}</span>
            </div>
          </div>

          {isExpanded && (
            <button
              onClick={logout}
              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
              title="Abmelden"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Inner layout (auth guard + shell)                                 */
/* ------------------------------------------------------------------ */
const PUBLIC_ROUTES = ['/login', '/reset-password'];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, token } = useAdminAuth();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Restore saved collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setIsExpanded(false);
  }, []);

  // Close mobile sidebar on desktop resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Public routes (login, reset) ---
  if (isPublicRoute) return <>{children}</>;

  // --- Loading auth ---
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  // --- Not authenticated ---
  if (!token) return null;

  const pageTitle = PAGE_TITLES[pathname] || '';

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] font-sans text-slate-900 overflow-hidden selection:bg-red-100 selection:text-red-900">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AdminSidebar
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Glassmorphism header */}
        <header className="h-[72px] bg-white/70 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30 sticky top-0 supports-[backdrop-filter]:bg-white/40">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden text-slate-500 hover:text-slate-900 p-2 -ml-2 rounded-lg hover:bg-slate-100/50 transition-colors"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="items-center text-sm text-slate-500 hidden sm:flex">
              <span className="hover:text-slate-800 cursor-pointer transition-colors">HoppDrive</span>
              <ChevronRight size={14} className="mx-1.5 text-slate-300" />
              <span className="text-slate-900 font-medium bg-slate-100 px-2 py-1 rounded-md">{pageTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <SearchDropdown />

            <div className="h-5 w-px bg-slate-200 mx-2 hidden sm:block" />

            <NotificationBell />

            <Link href="/settings" className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100/50 rounded-lg transition-all" title="Website-Einstellungen">
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        {/* Scrollable page content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto pb-12">{children}</div>
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
