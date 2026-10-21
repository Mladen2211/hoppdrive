/**
 * Navigation model of the admin shell (sidebar, tablet rail, mobile bottom nav + "Mehr" sheet).
 * One list drives all three, so labels, icons, permissions and counts never drift apart.
 */
import {
  BarChart2,
  Calendar,
  CarFront,
  CircleHelp,
  FileText,
  Gavel,
  Globe,
  Home,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageSquare,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionArea } from '@hoppdrive/shared';
import { tr } from '@/i18n/active';

export type NavGroupId = 'betrieb' | 'inhalte' | 'system';
export type NavBadge = 'inquiries' | 'contracts';

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Permission area; the item is hidden when the role has no access ('none'). Missing = always visible. */
  area?: PermissionArea;
  /** Which open-work count (Anfragen offen / Verträge ausstehend) is shown as a badge. */
  badge?: NavBadge;
  /** Shows the violet "Neu" tag. */
  isNew?: boolean;
  /** Shown directly in the mobile bottom navigation (the rest lives in "Mehr"). */
  primary?: boolean;
  /** `tab` is the value of the `?tab=` query parameter (settings tabs). */
  isActive: (pathname: string, tab: string | null) => boolean;
}

const startsWithPath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'betrieb', get label() { return tr('shell.betrieb'); } },
  { id: 'inhalte', get label() { return tr('shell.inhalte'); } },
  { id: 'system', get label() { return tr('shell.system'); } },
];

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', href: '/', get label() { return tr('shell.uebersicht'); }, icon: LayoutGrid, group: 'betrieb', primary: true, isActive: (p) => p === '/' },
  {
    id: 'inquiries',
    href: '/inquiries',
    get label() { return tr('common.anfragen'); },
    icon: MessageSquare,
    group: 'betrieb',
    area: 'inquiries',
    badge: 'inquiries',
    primary: true,
    isActive: (p) => startsWithPath(p, '/inquiries'),
  },
  {
    id: 'contracts',
    href: '/contracts',
    get label() { return tr('shell.vertraege'); },
    icon: FileText,
    group: 'betrieb',
    area: 'contracts',
    badge: 'contracts',
    primary: true,
    isActive: (p) => startsWithPath(p, '/contracts'),
  },
  {
    id: 'availability',
    href: '/availability',
    get label() { return tr('shell.kalender'); },
    icon: Calendar,
    group: 'betrieb',
    area: 'calendar',
    primary: true,
    isActive: (p) => startsWithPath(p, '/availability'),
  },
  { id: 'fleet', href: '/fleet', get label() { return tr('common.flotte'); }, icon: CarFront, group: 'betrieb', area: 'fleet', isActive: (p) => startsWithPath(p, '/fleet') },
  { id: 'fines', href: '/fines', get label() { return tr('shell.bussen'); }, icon: Gavel, group: 'betrieb', area: 'fines', isActive: (p) => startsWithPath(p, '/fines') },
  { id: 'reports', href: '/reports', get label() { return tr('shell.berichte'); }, icon: BarChart2, group: 'betrieb', area: 'reports', isActive: (p) => startsWithPath(p, '/reports') },

  { id: 'homepage', href: '/homepage', get label() { return tr('shell.homepage'); }, icon: Home, group: 'inhalte', area: 'content', isActive: (p) => startsWithPath(p, '/homepage') },
  { id: 'testimonials', href: '/testimonials', get label() { return tr('common.bewertungen'); }, icon: Star, group: 'inhalte', area: 'content', isActive: (p) => startsWithPath(p, '/testimonials') },
  { id: 'faq', href: '/faq', label: 'FAQ', icon: CircleHelp, group: 'inhalte', area: 'content', isActive: (p) => startsWithPath(p, '/faq') },
  { id: 'locations', href: '/locations', get label() { return tr('common.standorte'); }, icon: MapPin, group: 'inhalte', area: 'content', isActive: (p) => startsWithPath(p, '/locations') },
  { id: 'marketing', href: '/marketing', get label() { return tr('shell.marketing'); }, icon: Megaphone, group: 'inhalte', area: 'marketing', isActive: (p) => startsWithPath(p, '/marketing') },
  {
    id: 'website',
    href: '/settings',
    get label() { return tr('common.website'); },
    icon: Globe,
    group: 'inhalte',
    area: 'websiteSettings',
    isActive: (p, tab) => startsWithPath(p, '/settings') && tab !== 'users' && tab !== 'activity',
  },

  {
    id: 'users',
    href: '/settings?tab=users',
    get label() { return tr('shell.benutzerUndRollen'); },
    icon: Users,
    group: 'system',
    area: 'users',
    isNew: true,
    isActive: (p, tab) => startsWithPath(p, '/settings') && (tab === 'users' || tab === 'activity'),
  },
];

/** Page titles for the mobile top bar (and document titles). */
const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/inquiries', get title() { return tr('common.anfragen'); } },
  { prefix: '/contracts', get title() { return tr('shell.vertraege'); } },
  { prefix: '/availability', get title() { return tr('shell.kalender'); } },
  { prefix: '/fleet', get title() { return tr('common.flotte'); } },
  { prefix: '/fines', get title() { return tr('shell.bussen'); } },
  { prefix: '/reports', get title() { return tr('shell.berichte'); } },
  { prefix: '/homepage', get title() { return tr('shell.homepage'); } },
  { prefix: '/testimonials', get title() { return tr('common.bewertungen'); } },
  { prefix: '/faq', title: 'FAQ' },
  { prefix: '/locations', get title() { return tr('common.standorte'); } },
  { prefix: '/marketing', get title() { return tr('shell.marketing'); } },
  { prefix: '/settings', get title() { return tr('shell.einstellungen'); } },
  { prefix: '/profile', get title() { return tr('shell.profil2'); } },
];

export function pageTitleFor(pathname: string): string {
  if (pathname === '/') return tr('shell.uebersicht');
  return PAGE_TITLES.find((entry) => startsWithPath(pathname, entry.prefix))?.title ?? '';
}

/**
 * Permission area guarded by a route (null = open to every signed-in role: Übersicht, Profil).
 * `/settings` is both "Website" (websiteSettings) and, with ?tab=users|activity, "Benutzer und
 * Rollen" (users).
 */
export function areaForPath(pathname: string, tab: string | null): PermissionArea | null {
  if (pathname === '/' || startsWithPath(pathname, '/profile')) return null;
  if (startsWithPath(pathname, '/inquiries')) return 'inquiries';
  if (startsWithPath(pathname, '/contracts')) return 'contracts';
  if (startsWithPath(pathname, '/availability')) return 'calendar';
  if (startsWithPath(pathname, '/fleet')) return 'fleet';
  if (startsWithPath(pathname, '/reports')) return 'reports';
  if (startsWithPath(pathname, '/fines')) return 'fines';
  if (
    startsWithPath(pathname, '/homepage') ||
    startsWithPath(pathname, '/testimonials') ||
    startsWithPath(pathname, '/faq') ||
    startsWithPath(pathname, '/locations')
  ) {
    return 'content';
  }
  if (startsWithPath(pathname, '/marketing')) return 'marketing';
  if (startsWithPath(pathname, '/settings')) return tab === 'users' || tab === 'activity' ? 'users' : 'websiteSettings';
  return null;
}

/** Routes that render without the shell (mirror of PUBLIC_ROUTES in useAdminAuth). */
export const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/accept-invite', '/offline'];

export function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_ROUTES.includes(path);
}

/** "Mladen R." (first name + last initial), the way the boards show the signed-in user. */
export function shortName(user: { firstName?: string | null; lastName?: string | null; name?: string | null } | null | undefined): string {
  if (!user) return tr('shell.admin');
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  return first || user.name?.trim() || tr('shell.admin');
}

export function fullName(user: { firstName?: string | null; lastName?: string | null; name?: string | null } | null | undefined): string {
  if (!user) return tr('shell.admin');
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  return first || user.name?.trim() || tr('shell.admin');
}
