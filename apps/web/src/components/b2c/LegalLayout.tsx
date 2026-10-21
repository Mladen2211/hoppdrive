import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Alert, Crumbs, cn } from '@/components/ui';
import { DEFAULT_LOCALE } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';

/**
 * Layout of the legal pages (design board "Rechtliche Seiten Desktop"):
 * breadcrumb, a side navigation (Impressum / Datenschutz / AGB) and the content
 * in a card. Below 1024 px the side navigation becomes a row of links above
 * the card.
 *
 * Only the German text of Impressum, Datenschutz and AGB is legally binding: on the other
 * languages the page chrome (titles, section headings, navigation) is translated, the body text
 * stays German (marked with lang="de") and a note says that the German version prevails.
 */
export type LegalPage = 'impressum' | 'privacy' | 'agb';

const PAGES: { key: LegalPage; href: string }[] = [
  { key: 'impressum', href: '/impressum' },
  { key: 'privacy', href: '/privacy' },
  { key: 'agb', href: '/agb' },
];

interface LegalLayoutProps {
  current: LegalPage;
  title: string;
  /** Card width: 'prose' = readable text column, 'wide' = e.g. the embedded AGB PDF. */
  width?: 'prose' | 'wide';
  children: ReactNode;
}

export function LegalLayout({ current, title, width = 'prose', children }: LegalLayoutProps) {
  const t = useTranslations('legal');
  const locale = useLocale();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="pb-[72px] pt-10 max-md:pb-10 max-md:pt-6">
          <div className="wrap">
            <Crumbs items={[{ label: t('home'), href: '/' }, { label: title }]} />
            <div className="mt-5 grid grid-cols-[240px_minmax(0,1fr)] items-start gap-14 max-lg:grid-cols-1 max-lg:gap-5">
              <nav
                aria-label={t('navLabel')}
                className="flex flex-col gap-1 lg:sticky lg:top-6 max-lg:flex-row max-lg:flex-wrap max-lg:gap-2"
              >
                {PAGES.map((page) => {
                  const active = page.key === current;
                  return (
                    <Link
                      key={page.key}
                      href={page.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-12 items-center rounded-10 px-4 no-underline',
                        active
                          ? 'border border-l-4 border-line border-l-ruby bg-white font-bold text-ink'
                          : 'font-medium text-graphite hover:bg-white',
                      )}
                    >
                      {t(`pages.${page.key}`)}
                    </Link>
                  );
                })}
              </nav>

              <article
                className={cn(
                  'card flex flex-col gap-7 !p-12 max-md:!p-6',
                  width === 'prose' ? 'max-w-[860px]' : 'max-w-[1080px]',
                )}
              >
                <h1 className="disp !text-[44px] max-md:!text-[32px]">{title}</h1>
                {locale !== DEFAULT_LOCALE && <Alert tone="info">{t('note')}</Alert>}
                {children}
              </article>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/** A titled block of a legal text (translated title, German body on non-German pages). */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  const locale = useLocale();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="h3">{title}</h2>
      <div
        lang={locale === DEFAULT_LOCALE ? undefined : 'de'}
        className="flex flex-col gap-3 leading-relaxed [&_a]:font-semibold [&_a]:text-ruby-dark [&_a]:underline [&_a]:underline-offset-2 [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:pl-1 [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6"
      >
        {children}
      </div>
    </section>
  );
}
