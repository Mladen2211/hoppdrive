import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalLayout, LegalSection } from '@/components/b2c/LegalLayout';
import { htmlLang } from '@/i18n/locales';
import { isLocale } from '@/i18n/routing';
import { fmtDateLong } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import { getCompany, getPrimaryLocation } from '@/lib/server-api';
import { phoneHref, resolveContactInfo } from '@/lib/site';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return buildMetadata({
    locale,
    title: t('metaTitle'),
    description: t('metaDescription'),
    pathname: '/privacy',
  });
}

export default async function PrivacyPage({ params: { locale } }: { params: { locale: string } }) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });

  // The phone number comes from the admin (Einstellungen → Firma / Standorte);
  // without one the existing placeholder text stays.
  const [company, location] = await Promise.all([getCompany(locale), getPrimaryLocation()]);
  const { phone } = resolveContactInfo({ company, location });
  // Sub-headings are translated, but sit inside the German body text of their section.
  const lang = htmlLang(locale);

  // The legal body text below is intentionally German in every language (the German version
  // is legally binding); titles, section headings and labels are translated.
  return (
    <LegalLayout current="privacy" title={t('title')}>
      <p className="-mt-3 text-sm text-graphite">
        {t('lastUpdated', { date: fmtDateLong(new Date(), locale) })}
      </p>

      {/* 1. Controller */}
      <LegalSection title={t('controller')}>
        <p>
          Die verantwortliche Stelle für diese Website ist:
        </p>
        <p>
          <strong>HoppDrive</strong>
          <br />
          [Registrierte Adresse], Schweiz
          <br />
          E-Mail: info@hoppdrive.ch
          <br />
          Telefon: {phone ? <a href={phoneHref(phone)}>{phone}</a> : '+41 XX XXX XX XX'}
        </p>
      </LegalSection>

      {/* 2. What Data We Collect */}
      <LegalSection title={t('data')}>
        <h3 lang={lang}>{t('dataContact')}</h3>
        <p>
          Wenn Sie unser Kontaktformular absenden, erheben wir: Ihren vollständigen
          Namen, Ihre E-Mail-Adresse, Telefonnummer und den Nachrichteninhalt. Diese
          Daten sind zur Bearbeitung Ihrer Mietanfrage erforderlich (Art. 6 Abs. 1
          lit. b DSGVO / Art. 31 DSG).
        </p>
        <h3 lang={lang}>{t('dataAuto')}</h3>
        <p>
          Beim Besuch unserer Website übermittelt Ihr Browser automatisch
          bestimmte Daten, darunter Ihre IP-Adresse, den Browsertyp und die
          Zugriffszeit. Diese Daten werden zu Sicherheits- und Statistikzwecken
          verarbeitet.
        </p>
        <h3 lang={lang}>{t('dataCookies')}</h3>
        <p>
          Wir verwenden Google Analytics 4 (GA4), um zu verstehen, wie Besucher
          unsere Website nutzen. GA4-Skripte werden <strong>erst nach Ihrer
          ausdrücklichen Einwilligung</strong> über unser Cookie-Banner geladen.
          Vor Ihrem Opt-in werden keine Tracking-Cookies gesetzt.
        </p>
      </LegalSection>

      {/* 3. Third Parties */}
      <LegalSection title={t('processors')}>
        <p>Wir nutzen folgende Drittanbieter-Dienste:</p>
        <ul>
          <li>
            <strong>Brevo (Sendinblue)</strong> — E-Mail-Zustellung für Bestätigungs-
            und Benachrichtigungs-E-Mails. Daten können nach Frankreich/EU übermittelt werden.
          </li>
          <li>
            <strong>Google LLC</strong> — Google Analytics 4 zur Website-Traffic-
            Analyse (nur mit Einwilligung). Daten können in die USA übermittelt werden.
            Google ist gemäss dem EU-US Data Privacy Framework zertifiziert.
          </li>
        </ul>
      </LegalSection>

      {/* 4. Retention */}
      <LegalSection title={t('retention')}>
        <p>
          Kontaktformular-Eingaben, die nicht zu einem unterschriebenen Mietvertrag
          führen, werden nach <strong>12 Monaten</strong> automatisch gelöscht.
          Daten zu abgeschlossenen Verträgen können gemäss den schweizerischen
          Steuer- und Buchführungsvorschriften länger aufbewahrt werden.
        </p>
      </LegalSection>

      {/* 5. Your Rights */}
      <LegalSection title={t('rights')}>
        <p>Gemäss DSG und DSGVO haben Sie das Recht auf:</p>
        <ul>
          <li>
            <strong>Auskunft</strong> — Eine Kopie aller personenbezogenen Daten
            anfordern, die wir über Sie gespeichert haben.
          </li>
          <li>
            <strong>Berichtigung</strong> — Korrektur unrichtiger Daten verlangen.
          </li>
          <li>
            <strong>Löschung</strong> — Löschung Ihrer Daten verlangen (&quot;Recht
            auf Vergessenwerden&quot;).
          </li>
          <li>
            <strong>Datenübertragbarkeit</strong> — Ihre Daten in einem
            maschinenlesbaren Format erhalten.
          </li>
          <li>
            <strong>Einwilligung widerrufen</strong> — Sie können Ihre Cookie-
            Einstellungen jederzeit über den Link &quot;Cookie-Einstellungen&quot;
            in der Fusszeile ändern.
          </li>
        </ul>
        <p>
          Um diese Rechte auszuüben, kontaktieren Sie uns unter{' '}
          <a href="mailto:info@hoppdrive.ch">info@hoppdrive.ch</a>.
        </p>
      </LegalSection>

      {/* 6. Security */}
      <LegalSection title={t('security')}>
        <p>
          Wir setzen geeignete technische und organisatorische Massnahmen (TOMs)
          zum Schutz Ihrer personenbezogenen Daten um, darunter SSL/TLS-Verschlüsselung,
          strenge Firewall-Regeln, regelmässige Sicherheitsupdates und verschlüsselte
          externe Backups.
        </p>
      </LegalSection>

      {/* 7. Complaints */}
      <LegalSection title={t('complaints')}>
        <p>
          Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen
          Daten gegen Datenschutzgesetze verstösst, haben Sie das Recht, eine
          Beschwerde beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten
          (EDÖB) einzureichen:
        </p>
        <p>
          <a
            href="https://www.edoeb.admin.ch"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.edoeb.admin.ch
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
