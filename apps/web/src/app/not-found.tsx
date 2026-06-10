import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden | HoppDrive',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-extrabold text-brand-600 mb-4">404</div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-3">
          Seite nicht gefunden
        </h1>
        <p className="text-neutral-500 mb-8">
          Das gesuchte Fahrzeug oder die Seite existiert leider nicht mehr.
          Entdecken Sie unsere aktuelle Flotte.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
          >
            Zur Startseite
          </Link>
          <Link
            href="/#fleet"
            className="px-6 py-3 border-2 border-neutral-900 text-neutral-900 font-semibold rounded-lg hover:bg-neutral-900 hover:text-white transition-colors"
          >
            Flotte ansehen
          </Link>
        </div>
      </div>
    </div>
  );
}
