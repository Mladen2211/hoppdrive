/**
 * Admin shell (sidebar / rail / bottom nav, top bar, search, notifications, guard).
 *   <AppShell>{children}</AppShell>   mounted by app/(cms)/layout.tsx
 *   <Providers>                       mounted by app/layout.tsx (toasts, confirm, service worker)
 *   useShellCounts()                  open-work counts + refresh() for the nav badges
 */
export { AppShell } from './AppShell';
export { Providers } from './Providers';
export { ShellCountsProvider, useShellCounts } from './ShellCounts';
export { NAV_ITEMS, areaForPath, pageTitleFor, isPublicRoute, shortName, fullName } from './nav-config';
export type { NavItem } from './nav-config';
