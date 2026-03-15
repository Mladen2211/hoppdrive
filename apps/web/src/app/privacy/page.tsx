import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung – HoppDrive Autovermietung Schweiz',
  description: 'Datenschutzerklärung und Datenschutzinformationen von HoppDrive gemäss DSG und DSGVO. Erfahren Sie, wie wir Ihre Daten schützen.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-2">Datenschutzerklärung</h1>
          <p className="text-neutral-500 mb-8 text-sm">
            Zuletzt aktualisiert: {new Date().toLocaleDateString('de-CH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-neutral max-w-none space-y-8 text-sm leading-relaxed">
            {/* 1. Controller */}
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Verantwortliche Stelle</h2>
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
                Telefon: +41 XX XXX XX XX
              </p>
            </section>

            {/* 2. What Data We Collect */}
            <section>
              <h2 className="text-xl font-semibold mb-3">2. Erhobene Daten</h2>
              <h3 className="font-medium mb-2">a) Kontaktformular-Eingaben</h3>
              <p>
                Wenn Sie unser Kontaktformular absenden, erheben wir: Ihren vollständigen
                Namen, Ihre E-Mail-Adresse, Telefonnummer und den Nachrichteninhalt. Diese
                Daten sind zur Bearbeitung Ihrer Mietanfrage erforderlich (Art. 6 Abs. 1
                lit. b DSGVO / Art. 31 DSG).
              </p>
              <h3 className="font-medium mb-2 mt-4">b) Automatisch erhobene Daten</h3>
              <p>
                Beim Besuch unserer Website übermittelt Ihr Browser automatisch
                bestimmte Daten, darunter Ihre IP-Adresse, den Browsertyp und die
                Zugriffszeit. Diese Daten werden zu Sicherheits- und Statistikzwecken
                verarbeitet.
              </p>
              <h3 className="font-medium mb-2 mt-4">c) Cookies und Analyse (nur mit Einwilligung)</h3>
              <p>
                Wir verwenden Google Analytics 4 (GA4), um zu verstehen, wie Besucher
                unsere Website nutzen. GA4-Skripte werden <strong>erst nach Ihrer
                ausdrücklichen Einwilligung</strong> über unser Cookie-Banner geladen.
                Vor Ihrem Opt-in werden keine Tracking-Cookies gesetzt.
              </p>
            </section>

            {/* 3. Third Parties */}
            <section>
              <h2 className="text-xl font-semibold mb-3">3. Auftragsverarbeiter (Drittanbieter)</h2>
              <p>Wir nutzen folgende Drittanbieter-Dienste:</p>
              <ul className="list-disc list-inside space-y-2 mt-2">
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
            </section>

            {/* 4. Retention */}
            <section>
              <h2 className="text-xl font-semibold mb-3">4. Aufbewahrungsdauer</h2>
              <p>
                Kontaktformular-Eingaben, die nicht zu einem unterschriebenen Mietvertrag
                führen, werden nach <strong>12 Monaten</strong> automatisch gelöscht.
                Daten zu abgeschlossenen Verträgen können gemäss den schweizerischen
                Steuer- und Buchführungsvorschriften länger aufbewahrt werden.
              </p>
            </section>

            {/* 5. Your Rights */}
            <section>
              <h2 className="text-xl font-semibold mb-3">5. Ihre Rechte</h2>
              <p>Gemäss DSG und DSGVO haben Sie das Recht auf:</p>
              <ul className="list-disc list-inside space-y-2 mt-2">
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
              <p className="mt-3">
                Um diese Rechte auszuüben, kontaktieren Sie uns unter{' '}
                <a href="mailto:info@hoppdrive.ch" className="text-brand-600 hover:underline">
                  info@hoppdrive.ch
                </a>.
              </p>
            </section>

            {/* 6. Security */}
            <section>
              <h2 className="text-xl font-semibold mb-3">6. Sicherheitsmassnahmen</h2>
              <p>
                Wir setzen geeignete technische und organisatorische Massnahmen (TOMs)
                zum Schutz Ihrer personenbezogenen Daten um, darunter SSL/TLS-Verschlüsselung,
                strenge Firewall-Regeln, regelmässige Sicherheitsupdates und verschlüsselte
                externe Backups.
              </p>
            </section>

            {/* 7. Complaints */}
            <section>
              <h2 className="text-xl font-semibold mb-3">7. Beschwerderecht</h2>
              <p>
                Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen
                Daten gegen Datenschutzgesetze verstösst, haben Sie das Recht, eine
                Beschwerde beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten
                (EDÖB) einzureichen:
              </p>
              <p className="mt-2">
                <a
                  href="https://www.edoeb.admin.ch"
                  className="text-brand-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.edoeb.admin.ch
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
