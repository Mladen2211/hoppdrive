import { Search, CalendarCheck, CarFront } from 'lucide-react';
import type { HowItWorksContent } from '@/types/homepage-sections';

const STEP_ICONS = [Search, CalendarCheck, CarFront];

const DEFAULT_STEPS = [
  {
    number: '01',
    title: 'Fahrzeug wählen',
    description: 'Durchstöbern Sie unsere Flotte und finden Sie das passende Auto für Ihre Bedürfnisse.',
    time: '2 Minuten',
  },
  {
    number: '02',
    title: 'Unverbindlich anfragen',
    description: 'Senden Sie uns eine kostenlose Anfrage mit Ihren Wunschdaten – wir antworten schnellstmöglich.',
    time: 'Kostenlos',
  },
  {
    number: '03',
    title: 'Losfahren',
    description: 'Vertrag unterschreiben, Schlüssel erhalten, und schon sind Sie günstig und flexibel unterwegs.',
    time: 'Sofort startklar',
  },
];

export type { HowItWorksContent };

interface HowItWorksProps {
  content?: HowItWorksContent;
}

export function HowItWorks({ content }: HowItWorksProps) {
  const c = content || {};
  const label = c.label ?? 'So einfach geht\u2019s';
  const heading = c.heading ?? 'In 3 Schritten zum Mietwagen';
  const description =
    c.description ?? 'Keine komplizierten Prozesse. Kein Papierkram. Einfach anfragen und losfahren.';
  const steps = c.steps?.length
    ? c.steps.map((s, i) => ({ ...DEFAULT_STEPS[i], ...s, number: s.number ?? String(i + 1).padStart(2, '0') }))
    : DEFAULT_STEPS;

  return (
    <section className="py-20 bg-neutral-50 border-y border-neutral-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <div className="relative">
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-neutral-300" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            {steps.map((step, idx) => {
              const Icon = STEP_ICONS[idx % STEP_ICONS.length];
              return (
                <div key={step.number} className="flex flex-col items-center text-center">
                  <div className="relative z-10 mb-5">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        idx === steps.length - 1
                          ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                          : 'bg-white text-brand-600 ring-4 ring-neutral-100 shadow-sm'
                      }`}
                    >
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="absolute -top-2 -right-2 bg-neutral-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-neutral-500 text-sm leading-relaxed max-w-[260px] mb-3">
                    {step.description}
                  </p>
                  {step.time && (
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
                      {step.time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
