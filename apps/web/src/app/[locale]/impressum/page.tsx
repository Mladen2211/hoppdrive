import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalLayout, LegalSection } from '@/components/b2c/LegalLayout';
import { Alert } from '@/components/ui';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo';
import { getCompany, getPrimaryLocation } from '@/lib/server-api';
import { phoneHref, resolveContactInfo } from '@/lib/site';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'legal.impressum' });
  return buildMetadata({
    locale,
    title: t('title'),
    description: t('metaDescription'),
    pathname: '/impressum',
  });
}

export default async function ImpressumPage({ params: { locale } }: { params: { locale: string } }) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.impressum' });

  // The phone number comes from the admin (Einstellungen → Firma / Standorte);
  // without one the existing placeholder text stays.
  const [company, location] = await Promise.all([getCompany(locale), getPrimaryLocation()]);
  const { phone } = resolveContactInfo({ company, location });

  // The legal body text below is intentionally German in every language (the German version
  // is legally binding); titles and labels are translated.
  return (
    <LegalLayout current="impressum" title={t('title')}>
      <LegalSection title={t('company')}>
        <p>
          <strong>HoppDrive</strong>
          <br />
          [Rechtsform: z.B. GmbH]
          <br />
          [Registrierte Adresse]
          <br />
          [PLZ, Ort], Schweiz
        </p>
      </LegalSection>

      <LegalSection title={t('contact')}>
        <p>
          {t('emailLabel')}:{' '}
          <a href="mailto:info@hoppdrive.ch">info@hoppdrive.ch</a>
          <br />
          {t('phoneLabel')}: {phone ? <a href={phoneHref(phone)}>{phone}</a> : '+41 XX XXX XX XX'}
        </p>
      </LegalSection>

      <LegalSection title={t('representative')}>
        <p>[Name des Geschäftsführers / Zeichnungsberechtigten]</p>
      </LegalSection>

      <LegalSection title={t('register')}>
        <p>
          Eingetragen im Handelsregister des Kantons [Kanton], Schweiz.
          <br />
          Registernummer: CHE-XXX.XXX.XXX
        </p>
      </LegalSection>

      <LegalSection title={t('vat')}>
        <p>CHE-XXX.XXX.XXX MWST (falls zutreffend)</p>
      </LegalSection>

      <LegalSection title={t('disclaimer')}>
        <p className="max-w-[68ch] text-sm text-graphite">
          Die Inhalte dieser Website wurden mit grösster Sorgfalt erstellt.
          HoppDrive kann jedoch keine Gewähr für die Richtigkeit,
          Vollständigkeit und Aktualität der bereitgestellten Informationen
          übernehmen. Haftungsansprüche gegen HoppDrive, die sich
          auf Schäden materieller oder ideeller Art beziehen, welche durch die
          Nutzung oder Nichtnutzung der dargebotenen Informationen bzw. durch
          die Nutzung fehlerhafter und unvollständiger Informationen
          verursacht wurden, sind grundsätzlich ausgeschlossen.
        </p>
      </LegalSection>

      <Alert tone="info">{t('dataQuestions')}</Alert>
    </LegalLayout>
  );
}
