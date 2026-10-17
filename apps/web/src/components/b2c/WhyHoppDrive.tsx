import { Shield, PiggyBank, Wrench, HeartHandshake } from 'lucide-react';
import type { WhyHoppDriveContent } from '@/types/homepage-sections';

const ICONS = [PiggyBank, Shield, Wrench, HeartHandshake];

const DEFAULT_ITEMS = [
  {
    title: 'Unschlagbare Preise',
    description:
      'Starten Sie ab CHF 59/Tag – bis zu 40% Rabatt bei Langzeitmiete. Transparente Preise ohne versteckte Gebühren.',
  },
  {
    title: 'Vollkasko inklusive',
    description:
      'Premium-Versicherungsschutz ist bei jeder Anmietung dabei. Keine Zusatzkosten, keine Überraschungen.',
  },
  {
    title: 'Bestens gewartet',
    description:
      'Jedes Fahrzeug wird vor jeder Übergabe professionell geprüft und gereinigt. Immer zuverlässig.',
  },
  {
    title: 'Persönlicher Service',
    description:
      'Individuelle Beratung und flexible Laufzeiten. Wir passen uns Ihren Bedürfnissen an.',
  },
];

export type { WhyHoppDriveContent };

interface WhyHoppDriveProps {
  content?: WhyHoppDriveContent;
}

export function WhyHoppDrive({ content }: WhyHoppDriveProps) {
  const c = content || {};
  const label = c.label ?? 'Warum HoppDrive';
  const heading = c.heading ?? 'Günstig, flexibel & zuverlässig';
  const description =
    c.description ?? 'Wir machen Autovermietung einfach und erschwinglich – mit transparenten Preisen und persönlichem Service.';
  const items = c.items?.length ? c.items : DEFAULT_ITEMS;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-brand-600 font-semibold text-sm uppercase tracking-wider">
            {label}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
            {heading}
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((prop, idx) => {
            const Icon = ICONS[idx % ICONS.length];
            return (
              <div
                key={prop.title}
                className="group text-center p-6 rounded-2xl border border-neutral-100 hover:border-brand-100 hover:shadow-lg hover:shadow-brand-50 transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-50 rounded-2xl mb-5 group-hover:bg-brand-100 transition-colors">
                  <Icon className="w-7 h-7 text-brand-600" />
                </div>
                <h3 className="text-lg font-bold mb-2">{prop.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  {prop.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
