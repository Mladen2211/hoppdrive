'use client';

import { ChevronRight, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { SiteLogo } from '@/components/layout/SiteLogo';
import { Button, IconButton, useFocusTrap, useLockBodyScroll, useMediaQuery } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { phoneHref } from '@/lib/site';

const NAV_LINKS = [
  { href: '/#fleet', key: 'fleet' },
  { href: '/#pricing', key: 'pricing' },
  { href: '/#faq', key: 'faq' },
  { href: '/#location', key: 'location' },
] as const;

interface NavbarClientProps {
  email: string;
  phone: string | null;
}

/**
 * Header: 76 px (64 px on mobile). From 1024 px the links sit in the bar; below
 * that a hamburger opens a full-screen menu (aria-expanded, focus trap, Escape).
 * The language switcher is a compact menu in the bar and a list in the mobile menu.
 */
export function NavbarClient({ email, phone }: NavbarClientProps) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const close = () => setOpen(false);

  useFocusTrap(panelRef, open, { onEscape: close });
  useLockBodyScroll(open);

  // Growing the window past the breakpoint while the menu is open closes it.
  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  return (
    <header className="border-b border-line bg-white">
      <div className="wrap flex h-[76px] items-center gap-5 max-md:h-16 max-md:gap-3 xl:gap-8">
        <Link href="/" aria-label={t('home')} className="flex-none">
          <SiteLogo className="h-[30px] min-[400px]:h-8 md:h-10 lg:h-8 xl:h-10 3xl:h-11" />
        </Link>

        <nav aria-label={t('main')} className="ml-auto flex gap-5 max-lg:hidden xl:gap-7">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap border-b-2 border-transparent px-0.5 py-2.5 font-medium text-ink no-underline hover:border-ruby"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <LanguageSwitcher variant="menu" className="max-lg:hidden" />

        <Button href="/#contact-form" className="max-lg:ml-auto max-md:hidden">
          {t('cta')}
        </Button>

        <IconButton
          aria-label={t('toggle')}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
          className="ml-0 max-md:ml-auto lg:hidden"
        >
          <Menu size={24} aria-hidden="true" />
        </IconButton>
      </div>

      {open && (
        <div
          ref={panelRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('menu')}
          className="fixed inset-0 z-[65] flex animate-fade-in flex-col overflow-y-auto bg-white lg:hidden"
        >
          <div className="border-b border-line">
            <div className="wrap flex h-16 items-center gap-3 md:h-[76px]">
              <Link href="/" aria-label={t('home')} onClick={close} className="flex-none">
                <SiteLogo className="h-[30px] min-[400px]:h-8 md:h-10" />
              </Link>
              <IconButton
                aria-label={t('closeMenu')}
                aria-expanded="true"
                aria-controls="mobile-menu"
                onClick={close}
                className="ml-auto"
              >
                <X size={24} aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <nav aria-label={t('mobile')} className="flex flex-col px-5 py-3 md:px-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="flex min-h-[60px] items-center justify-between border-b border-line-soft text-xl font-semibold text-ink no-underline"
              >
                {t(link.key)}
                <ChevronRight size={22} strokeWidth={2.4} className="text-cool" aria-hidden="true" />
              </Link>
            ))}
          </nav>

          <div className="px-5 pt-2 md:px-8">
            <Button href="/#contact-form" size="lg" fullWidth onClick={close}>
              {t('cta')}
            </Button>
          </div>

          <div className="px-5 pt-5 md:px-8">
            <LanguageSwitcher variant="list" onNavigate={close} />
          </div>

          <div className="mt-auto flex flex-col gap-1.5 bg-paper p-5 text-[15px] md:px-8">
            <b>{t('questions')}</b>
            <a href={`mailto:${email}`} className="text-graphite no-underline">
              {email}
            </a>
            {phone && (
              <a href={phoneHref(phone)} className="text-graphite no-underline">
                {phone}
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
