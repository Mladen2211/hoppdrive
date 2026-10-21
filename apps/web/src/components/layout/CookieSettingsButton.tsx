'use client';

import { useTranslations } from 'next-intl';
import { useConsent } from '@/components/consent/CookieConsentProvider';

/**
 * Footer link that reopens the cookie banner / settings (withdraw or change
 * the consent at any time, as promised in the privacy policy).
 */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations('footer');
  const { reopenBanner } = useConsent();
  return (
    <button type="button" id="cookie-settings-trigger" className={className} onClick={reopenBanner}>
      {t('cookieSettings')}
    </button>
  );
}
