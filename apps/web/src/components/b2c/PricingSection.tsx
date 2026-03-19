import { Shield, Wrench, Phone, FileText } from 'lucide-react';

interface PricingTier {
  number: string;
  title: string;
  description: string;
  badge?: string;
}

export interface PricingContent {
  label?: string;
  heading?: string;
  description?: string;
  tiers?: PricingTier[];
  includedItems?: string[];
}

interface PricingSectionProps {
  config?: {
    visible?: boolean;
    title?: string;
    tiers?: PricingTier[];
  } | null;
  content?: PricingContent;
}

const DEFAULT_TIERS: PricingTier[] = [
  { number: '01', title: 'Tag 1 – 7', description: 'Standard-Tagestarif für kurzfristige Bedürfnisse.' },
  { number: '02', title: 'Tag 8 – 30', description: 'Automatisch 20% Rabatt auf den Tagestarif bei verlängerter Miete.', badge: '20% RABATT' },
  { number: '03', title: 'Ab 31 Tagen', description: 'Maximaler 40% Rabatt. Bestes Preis-Leistungs-Verhältnis für echte Langzeitmobilität.', badge: '40% RABATT' },
];

const DEFAULT_INCLUDED = ['Vollkasko-Versicherung', 'Wartung & Service', 'Pannenhilfe 24/7', 'Transparente Verträge'];
const INCLUDED_ICONS = [Shield, Wrench, Phone, FileText];

export function PricingSection({ config, content }: PricingSectionProps) {
  if (config && config.visible === false) return null;

  const c = content || {};
  const label = c.label ?? 'Preismodell';
  const heading = c.heading ?? config?.title ?? 'So funktioniert unsere Preisgestaltung';
  const description = c.description ?? 'Je länger Sie mieten, desto günstiger wird es. Alle Preise inklusive Vollkasko.';
  const tiers = c.tiers?.length ? c.tiers : (config?.tiers?.length ? config.tiers : DEFAULT_TIERS);
  const includedItems = c.includedItems?.length ? c.includedItems : DEFAULT_INCLUDED;

  return (
    <section id="pricing" className="py-24 bg-neutral-50 border-y border-neutral-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-brand-600 font-semibold text-sm uppercase tracking-wider">
            {label}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">{heading}</h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
            {description}
          </p>
        </div>

        {/* Timeline-style steps */}
        <div className="relative mb-16">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-8 left-[calc(16.67%-12px)] right-[calc(16.67%-12px)] h-px bg-neutral-300" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            {tiers.map((tier, idx) => {
              const isLast = idx === tiers.length - 1;
              const hasBadge = !!tier.badge;

              return (
                <div key={idx} className="flex flex-col items-center text-center">
                  {/* Step circle */}
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-5 relative z-10 ${
                      isLast
                        ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                        : hasBadge
                          ? 'bg-brand-50 text-brand-700 ring-4 ring-brand-50/50'
                          : 'bg-white text-neutral-700 ring-4 ring-neutral-100'
                    }`}
                  >
                    {tier.number}
                  </div>

                  {/* Content card */}
                  <div className="flex flex-col items-center">
                    <h4 className="text-lg font-bold text-neutral-900 mb-1.5">{tier.title}</h4>

                    {hasBadge && (
                      <span
                        className={`inline-block text-[11px] tracking-wide font-bold px-2.5 py-0.5 rounded-full mb-2 ${
                          isLast
                            ? 'bg-brand-600 text-white'
                            : 'bg-brand-100 text-brand-700'
                        }`}
                      >
                        {tier.badge}
                      </span>
                    )}

                    <p className="text-neutral-500 text-sm leading-relaxed max-w-[260px]">
                      {tier.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* What's included */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 md:p-10">
          <h3 className="text-lg font-bold text-center mb-6">Immer inklusive – ohne Aufpreis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {includedItems.map((text, idx) => {
              const Icon = INCLUDED_ICONS[idx % INCLUDED_ICONS.length];
              return (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <span className="text-sm font-medium text-neutral-700">{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
