import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'AGB',
  description: 'Allgemeine Geschäftsbedingungen (AGB) von HoppDrive – Ihrer günstigen Autovermietung in der Schweiz.',
  path: '/agb',
});

export default function AGBPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-2">Allgemeine Geschäftsbedingungen</h1>
          <p className="text-neutral-500 mb-8 text-sm">
            Nachfolgend finden Sie unsere vollständigen AGB als PDF-Dokument.
          </p>

          {/* Download link */}
          <div className="mb-6">
            <a
              href="/agb.pdf"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-brand-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
              </svg>
              AGB als PDF herunterladen
            </a>
          </div>

          {/* Embedded PDF viewer */}
          <div className="w-full rounded-lg border border-gray-mid/30 overflow-hidden shadow-sm">
            <iframe
              src="/agb.pdf"
              title="Allgemeine Geschäftsbedingungen – HoppDrive"
              className="w-full"
              style={{ height: '80vh' }}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
