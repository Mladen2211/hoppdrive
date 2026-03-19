import { ChevronRight, CheckCircle, Shield, Clock, Car } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Shield, text: 'Vollkasko inklusive' },
  { icon: Clock, text: 'Bis 40% Langzeitrabatt' },
  { icon: Car, text: 'Top-gepflegte Fahrzeuge' },
  { icon: CheckCircle, text: 'Keine versteckten Kosten' },
];

export function HeroSection() {
  return (
    <header className="relative bg-neutral-950 text-white overflow-hidden">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1449965408869-ebd3fee7710d?auto=format&fit=crop&q=80&w=2000"
          alt="Modernes Auto auf Schweizer Strasse – HoppDrive günstige Autovermietung"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/85 to-neutral-950/50" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 flex flex-col items-center text-center">
        {/* Price anchor badge */}
        <span className="px-4 py-1.5 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-300 text-sm font-semibold tracking-wide mb-6 inline-flex items-center gap-2">
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
          Ab CHF 59 / Tag — Günstige Autovermietung Schweiz
        </span>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl leading-[1.1]">
          Günstig unterwegs,{' '}
          <br className="hidden sm:block" />
          <span className="text-brand-500">flexibel gemietet.</span>
        </h1>

        <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mb-8 leading-relaxed">
          Zuverlässige Fahrzeuge wie Škoda Superb, VW Passat & mehr – ab CHF 59 pro Tag.
          Je länger Sie mieten, desto mehr sparen Sie. Vollkasko inklusive.
        </p>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-12">
          <a
            href="#fleet"
            className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 rounded-full font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25"
          >
            Flotte entdecken <ChevronRight className="w-5 h-5" />
          </a>
          <a
            href="#contact-form"
            className="bg-white/10 hover:bg-white/20 backdrop-blur text-white px-8 py-4 rounded-full font-semibold transition-colors flex items-center justify-center gap-2 border border-white/20"
          >
            Verfügbarkeit prüfen
          </a>
        </div>

        {/* Trust strip */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-neutral-400">
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-brand-400" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
