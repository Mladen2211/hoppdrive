import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Impressum – HoppDrive Günstige Autovermietung Schweiz',
  description: 'Impressum und Firmeninformationen von HoppDrive – Ihrer günstigen Autovermietung in der Schweiz.',
  robots: { index: true, follow: true },
};

export default function ImpressumPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-8">Impressum</h1>

          <div className="prose prose-neutral max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">Firmenangaben</h2>
              <p>
                <strong>HoppDrive</strong>
                <br />
                [Rechtsform: z.B. GmbH]
                <br />
                [Registrierte Adresse]
                <br />
                [PLZ, Ort], Schweiz
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
              <p>
                E-Mail:{' '}
                <a href="mailto:info@hoppdrive.ch" className="text-brand-600 hover:underline">
                  info@hoppdrive.ch
                </a>
                <br />
                Telefon: +41 XX XXX XX XX
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Vertretungsberechtigte Person</h2>
              <p>[Name des Geschäftsführers / Zeichnungsberechtigten]</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Handelsregister</h2>
              <p>
                Eingetragen im Handelsregister des Kantons [Kanton], Schweiz.
                <br />
                Registernummer: CHE-XXX.XXX.XXX
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Mehrwertsteuernummer</h2>
              <p>CHE-XXX.XXX.XXX MWST (falls zutreffend)</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Haftungsausschluss</h2>
              <p className="text-sm text-neutral-600">
                Die Inhalte dieser Website wurden mit grösster Sorgfalt erstellt.
                HoppDrive kann jedoch keine Gewähr für die Richtigkeit,
                Vollständigkeit und Aktualität der bereitgestellten Informationen
                übernehmen. Haftungsansprüche gegen HoppDrive, die sich
                auf Schäden materieller oder ideeller Art beziehen, welche durch die
                Nutzung oder Nichtnutzung der dargebotenen Informationen bzw. durch
                die Nutzung fehlerhafter und unvollständiger Informationen
                verursacht wurden, sind grundsätzlich ausgeschlossen.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
