import { ChevronRight } from 'lucide-react';

export function HeroSection() {
  return (
    <header className="relative bg-neutral-950 text-white overflow-hidden">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1449965408869-ebd3fee7710d?auto=format&fit=crop&q=80&w=2000"
          alt="Modernes Auto auf Schweizer Strasse – HoppDrive günstige Autovermietung"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 flex flex-col items-center text-center">
        <span className="px-3 py-1 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-300 text-xs font-semibold tracking-wider uppercase mb-6">
          Günstige Kurz- & Langzeitvermietung Schweiz
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl">
          Günstig unterwegs,{' '}
          <br />
          <span className="text-brand-500">flexibel gemietet.</span>
        </h1>
        <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mb-10">
          Zuverlässige Fahrzeuge wie Škoda Superb, VW Passat & mehr – ab CHF 59 pro Tag.
          Je länger Sie mieten, desto mehr sparen Sie. Vollkasko inklusive.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a
            href="#fleet"
            className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 rounded-full font-semibold transition-colors flex items-center justify-center gap-2"
          >
            Flotte entdecken <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </header>
  );
}
