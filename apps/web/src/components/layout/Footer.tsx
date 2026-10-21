import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { CookieSettingsButton } from '@/components/layout/CookieSettingsButton';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { getAllVehicles, getCompany, getPrimaryLocation } from '@/lib/server-api';
import { CATEGORY_SLUGS, CATEGORY_TYPES, categoryRent } from '@/lib/seo';
import { phoneHref, resolveContactInfo } from '@/lib/site';

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:98';

const linkClass =
  'inline-flex min-h-9 items-center text-[15px] text-graphite no-underline hover:text-ruby max-md:min-h-11';

export async function Footer() {
  const locale = await getLocale();
  const [vehicles, company, location, t, tCategory] = await Promise.all([
    getAllVehicles(locale),
    getCompany(locale),
    getPrimaryLocation(),
    getTranslations({ locale, namespace: 'footer' }),
    getTranslations({ locale, namespace: 'category' }),
  ]);
  const activeCategories = CATEGORY_TYPES.filter((type) => vehicles.some((v) => v.type === type));
  const contact = resolveContactInfo({ company, location });

  return (
    <footer className="mt-auto border-t border-line bg-white pb-7 pt-14 max-md:pb-6 max-md:pt-9">
      <div className="wrap">
        <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-10 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-7">
          <div className="flex flex-col items-start gap-3.5">
            <Image
              src="/logos/logo-stacked.svg"
              alt={t('logoAlt')}
              width={250}
              height={105}
              className="block h-auto w-[250px] max-md:w-[200px]"
              unoptimized
            />
            <p className="mut max-w-[32ch]">{t('tagline')}</p>
            <LanguageSwitcher variant="inline" className="mt-1" />
          </div>

          <div>
            <h4 className="mb-3 text-[15px] font-bold">{t('vehicles')}</h4>
            <ul className="m-0 list-none p-0">
              <li>
                <Link href="/fahrzeuge" className={linkClass}>
                  {t('allVehicles')}
                </Link>
              </li>
              {activeCategories.map((type) => (
                <li key={type}>
                  <Link href={`/mieten/${CATEGORY_SLUGS[type]}`} className={linkClass}>
                    {categoryRent(type, tCategory)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-[15px] font-bold">{t('legal')}</h4>
            <ul className="m-0 list-none p-0">
              <li>
                <Link href="/impressum" className={linkClass}>
                  {t('imprint')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/agb" className={linkClass}>
                  {t('terms')}
                </Link>
              </li>
              <li>
                <CookieSettingsButton className={linkClass} />
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-[15px] font-bold">{t('contact')}</h4>
            <ul className="m-0 list-none p-0">
              <li>
                <a href={`mailto:${contact.email}`} className={linkClass}>
                  {contact.email}
                </a>
              </li>
              {contact.phone && (
                <li>
                  <a href={phoneHref(contact.phone)} className={linkClass}>
                    {contact.phone}
                  </a>
                </li>
              )}
              <li>
                <Link href="/#location" className={linkClass}>
                  {t('locationHours')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-sm text-graphite">
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          {/* Hidden admin login trigger (a small dot with a roomy hit area) */}
          <a
            href={`${ADMIN_URL}/login`}
            title={t('adminTitle')}
            aria-label={t('adminAria')}
            className="group -m-2 inline-flex h-8 w-8 items-center justify-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-line transition-colors group-hover:bg-ruby" />
          </a>
        </div>
      </div>
    </footer>
  );
}
