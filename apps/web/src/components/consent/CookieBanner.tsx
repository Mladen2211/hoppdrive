'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Sheet, Switch } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { useConsent } from './CookieConsentProvider';

/**
 * Cookie consent (design board "Mobil Menü Cookies Zustände", states 2 and 3):
 *  - a bottom bar/sheet with "Akzeptieren" and "Nur notwendige" side by side
 *    and equally prominent (no dark patterns), plus "Einstellungen verwalten";
 *  - a settings sheet with three switches (Notwendig is always on), pre-filled
 *    from the stored consent when the banner is reopened from the footer.
 * The bar is deliberately not a blocking overlay: the site stays usable.
 */
export function CookieBanner() {
  const t = useTranslations('cookie');
  const tCommon = useTranslations('common');
  const { consent, acceptAll, declineNonEssential, savePreferences, closeBanner } = useConsent();
  // Reopened from the footer (a choice already exists): go straight to the settings.
  const reopened = consent !== null;
  const [settingsOpen, setSettingsOpen] = useState(reopened);
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  const [marketing, setMarketing] = useState(consent?.marketing ?? false);

  function closeSettings() {
    if (reopened) closeBanner();
    else setSettingsOpen(false);
  }

  return (
    <>
      {!reopened && (
        <div
          role="dialog"
          aria-label={t('dialogLabel')}
          className="fixed inset-x-0 bottom-0 z-[60] rounded-t-20 border-t border-line bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-10px_30px_rgba(0,0,0,.12)] md:px-6"
        >
          <div className="mx-auto flex max-w-[1280px] items-center gap-5 max-lg:flex-col max-lg:items-stretch max-lg:gap-3.5 3xl:max-w-[1680px]">
            <div className="flex-1">
              <b className="text-lg">{t('title')}</b>
              <p className="mt-1.5 text-sm leading-[1.45] text-graphite">
                {t.rich('text', {
                  link: (chunks) => (
                    <Link href="/privacy" className="font-medium text-ruby-dark underline underline-offset-2">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>

            <div className="flex flex-none flex-wrap gap-2.5 max-lg:flex-col">
              {/* Accept and "only necessary" are equally prominent: same size, same row */}
              <div className="grid grid-cols-2 gap-2.5 md:flex">
                <Button onClick={acceptAll}>{t('accept')}</Button>
                <Button variant="outline" onClick={declineNonEssential}>
                  {t('declineNonEssential')}
                </Button>
              </div>
              <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                {t('manage')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet
        open={settingsOpen}
        onClose={closeSettings}
        title={t('settingsTitle')}
        closeLabel={tCommon('close')}
        footer={
          <Button size="lg" fullWidth onClick={() => savePreferences({ analytics, marketing })}>
            {t('save')}
          </Button>
        }
      >
        <div className="flex flex-col">
          <div className="border-b border-line py-1">
            <Switch
              checked
              disabled
              labelPosition="left"
              label={t('necessary')}
              description={t('necessaryDescription')}
            />
          </div>
          <div className="border-b border-line py-1">
            <Switch
              checked={analytics}
              onChange={setAnalytics}
              labelPosition="left"
              label={t('analytics')}
              description={t('analyticsDescription')}
            />
          </div>
          <div className="border-b border-line py-1">
            <Switch
              checked={marketing}
              onChange={setMarketing}
              labelPosition="left"
              label={t('marketing')}
              description={t('marketingDescription')}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
