'use client';

/**
 * App-wide providers mounted by the root layout: i18n (next-intl, locale from the server cookie),
 * theme (light / dark / system), toasts (replace alert()), confirm dialogs (replace confirm()) and
 * the service worker registration (production only).
 * Everything below can call useTranslations(), useToast() and useConfirm(), including the pages
 * outside the (cms) group (contracts/[id]/sign) and the login pages.
 */
import type { ReactNode } from 'react';
import { ConfirmProvider, ToastProvider } from '@/components/ui';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages';
import { ThemeProvider } from './ThemeProvider';

interface ProvidersProps {
  children: ReactNode;
  /** Language chosen on the server (cookie / Accept-Language). */
  locale: Locale;
  /** Messages of `locale` merged over German; omitted for German (bundled with the client). */
  messages?: Messages;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <I18nProvider initialLocale={locale} initialMessages={messages}>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            {children}
            <ServiceWorkerRegister />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
