'use client';

import type { ReactNode } from 'react';
import { AdminAuthProvider } from '@/hooks/useAdminAuth';
import { NewBookingProvider } from '@/components/NewBookingModal';
import { AppShell } from '@/components/shell';
import { PreferencesSync } from '@/components/shell/PreferencesSync';

/**
 * Signed-in admin area. The shell itself (sidebar, rail, bottom nav, top bar, search, notifications,
 * auth guard, "Keine Berechtigung" state) lives in components/shell; the global "Neue Buchung"
 * dialog is provided here so every page can open it with useNewBooking().open().
 * Toasts and confirm dialogs come from the root layout (components/shell/Providers).
 * PreferencesSync applies the signed-in admin's saved language and theme.
 */
export default function CmsLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <PreferencesSync />
      <NewBookingProvider>
        <AppShell>{children}</AppShell>
      </NewBookingProvider>
    </AdminAuthProvider>
  );
}
