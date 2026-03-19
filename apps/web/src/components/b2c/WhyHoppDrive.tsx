import { Shield, PiggyBank, Wrench, HeartHandshake } from 'lucide-react';

const VALUE_PROPS = [
  {
    icon: PiggyBank,
    title: 'Unschlagbare Preise',
    description:
      'Starten Sie ab CHF 59/Tag – bis zu 40% Rabatt bei Langzeitmiete. Transparente Preise ohne versteckte Gebühren.',
  },
  {
    icon: Shield,
    title: 'Vollkasko inklusive',
    description:
      'Premium-Versicherungsschutz ist bei jeder Anmietung dabei. Keine Zusatzkosten, keine Überraschungen.',
  },
  {
    icon: Wrench,
    title: 'Bestens gewartet',
    description:
      'Jedes Fahrzeug wird vor jeder Übergabe professionell geprüft und gereinigt. Immer zuverlässig.',
  },
  {
    icon: HeartHandshake,
    title: 'Persönlicher Service',
    description:
      'Individuelle Beratung und flexible Laufzeiten. Wir passen uns Ihren Bedürfnissen an.',
  },
];

export function WhyHoppDrive() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-brand-600 font-semibold text-sm uppercase tracking-wider">
            Warum HoppDrive
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
            Günstig, flexibel &amp; zuverlässig
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
            Wir machen Autovermietung einfach und erschwinglich – mit transparenten Preisen und persönlichem Service.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="group text-center p-6 rounded-2xl border border-neutral-100 hover:border-brand-100 hover:shadow-lg hover:shadow-brand-50 transition-all duration-300"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-50 rounded-2xl mb-5 group-hover:bg-brand-100 transition-colors">
                <prop.icon className="w-7 h-7 text-brand-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">{prop.title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
