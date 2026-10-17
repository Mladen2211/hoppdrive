import Link from 'next/link';
import Image from 'next/image';
import { getAllVehicles } from '@/lib/server-api';
import { CATEGORIES } from '@/lib/seo';
import type { VehicleType } from '@hoppdrive/shared';

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:98';

export async function Footer() {
  const vehicles = await getAllVehicles();
  const activeCategories = (Object.keys(CATEGORIES) as VehicleType[]).filter((type) =>
    vehicles.some((v) => v.type === type)
  );

  return (
    <footer className="bg-surface py-12 border-t border-gray-mid/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Logo & Tagline */}
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo-footer.png" alt="HoppDrive" width={120} height={40} className="h-10 w-auto" />
        </div>

        {/* Fahrzeuge */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-6 text-sm">
          <span className="text-charcoal font-semibold">Fahrzeuge:</span>
          <Link href="/fahrzeuge" className="text-graphite hover:text-charcoal transition-colors">
            Alle Fahrzeuge
          </Link>
          {activeCategories.map((type) => (
            <Link
              key={type}
              href={`/mieten/${CATEGORIES[type].slug}`}
              className="text-graphite hover:text-charcoal transition-colors"
            >
              {CATEGORIES[type].label} mieten
            </Link>
          ))}
        </div>

        {/* Legal Links */}
        <div className="flex gap-6 mb-8 text-graphite">
          <Link
            href="/impressum"
            className="hover:text-charcoal transition-colors text-sm"
          >
            Impressum
          </Link>
          <Link
            href="/privacy"
            className="hover:text-charcoal transition-colors text-sm"
          >
            Datenschutz
          </Link>
          <Link
            href="/agb"
            className="hover:text-charcoal transition-colors text-sm"
          >
            AGB
          </Link>
          <button
            className="hover:text-charcoal transition-colors text-sm"
            id="cookie-settings-trigger"
          >
            Cookie-Einstellungen
          </button>
        </div>

        {/* Copyright */}
        <p className="text-gray-mid text-sm flex items-center gap-1">
          &copy; {new Date().getFullYear()} Euro-Abschleppservice GmbH. Alle Rechte vorbehalten.
          {/* Hidden Admin Login Trigger */}
          <a
            href={`${ADMIN_URL}/login`}
            className="w-1.5 h-1.5 rounded-full bg-gray-soft hover:bg-brand-500 cursor-pointer transition-colors ml-2"
            title="Admin"
            aria-label="Admin-Anmeldung"
          />
        </p>
      </div>
    </footer>
  );
}
