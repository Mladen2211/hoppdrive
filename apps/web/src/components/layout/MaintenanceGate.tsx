'use client';

import { Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { SiteLogo } from '@/components/layout/SiteLogo';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Pages that stay reachable while the site is in maintenance mode (legal duty; the unsubscribe
 * page too, so the link in a mail keeps working). These are the internal (German) pathnames:
 * next-intl's usePathname returns them for every language (/en/legal-notice -> /impressum).
 */
const ALWAYS_OPEN = ['/impressum', '/privacy', '/agb', '/abmelden'];

interface MaintenanceGateProps {
  enabled: boolean;
  message?: string;
  email: string;
  children: ReactNode;
}

/**
 * Renders a clean notice instead of the page while `maintenance_mode.enabled`
 * is on (admin: Einstellungen → Website). The flag is fetched in the root
 * layout with revalidate, so all other pages stay statically generated; the
 * pathname check happens here on the client (usePathname also works while
 * rendering on the server), which keeps the legal pages open.
 */
export function MaintenanceGate({ enabled, message, email, children }: MaintenanceGateProps) {
  const t = useTranslations('maintenance');
  const tFooter = useTranslations('footer');
  const pathname = usePathname() ?? '/';
  const open = ALWAYS_OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!enabled || open) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-[76px] items-center justify-between max-md:h-16">
          <SiteLogo className="h-[30px] min-[400px]:h-8 md:h-10 xl:h-11" />
          <LanguageSwitcher variant="menu" />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center">
        <div className="wrap py-16 max-md:py-10">
          <div className="card mx-auto flex max-w-[640px] flex-col items-start gap-5 !p-10 max-md:!p-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-ruby-tint text-ruby"
              aria-hidden="true"
            >
              <Wrench size={28} />
            </div>
            <h1 className="disp !text-[40px] max-md:!text-[30px]">{t('title')}</h1>
            <p className="lead whitespace-pre-line">{message?.trim() || t('defaultMessage')}</p>
            <p className="text-graphite">
              {t('urgent')}{' '}
              <a href={`mailto:${email}`} className="font-semibold text-ruby-dark underline underline-offset-2">
                {email}
              </a>
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-1 py-4 text-sm text-graphite">
          <Link href="/impressum" className="inline-flex min-h-11 items-center no-underline hover:text-ruby">
            {tFooter('imprint')}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center no-underline hover:text-ruby">
            {tFooter('privacy')}
          </Link>
          <Link href="/agb" className="inline-flex min-h-11 items-center no-underline hover:text-ruby">
            {tFooter('terms')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
