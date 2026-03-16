interface PricingTier {
  number: string;
  title: string;
  description: string;
  badge?: string;
}

interface PricingSectionProps {
  config?: {
    visible?: boolean;
    title?: string;
    tiers?: PricingTier[];
  } | null;
}

const DEFAULT_TIERS: PricingTier[] = [
  { number: '01', title: 'Tag 1 – 7', description: 'Standard-Tagestarif für kurzfristige Bedürfnisse.' },
  { number: '02', title: 'Tag 8 – 30', description: 'Automatisch 20% Rabatt auf den Tagestarif bei verlängerter Miete.', badge: '20% RABATT' },
  { number: '03', title: 'Ab 31 Tagen', description: 'Maximaler 40% Rabatt. Bestes Preis-Leistungs-Verhältnis für echte Langzeitmobilität.', badge: '40% RABATT' },
];

export function PricingSection({ config }: PricingSectionProps) {
  if (config && config.visible === false) return null;

  const title = config?.title || 'So funktioniert unsere Preisgestaltung';
  const tiers = config?.tiers?.length ? config.tiers : DEFAULT_TIERS;

  return (
    <section id="pricing" className="py-20 bg-neutral-50 border-y border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold mb-12">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, idx) => {
            const isLast = idx === tiers.length - 1;
            const hasBadge = !!tier.badge;
            const borderClass = isLast
              ? 'border-brand-600'
              : hasBadge
                ? 'border-brand-100'
                : 'border-neutral-100';

            return (
              <div
                key={idx}
                className={`bg-white p-8 rounded-2xl shadow-sm border ${borderClass} relative overflow-hidden`}
              >
                {hasBadge && (
                  <div
                    className={`absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg ${
                      isLast
                        ? 'bg-brand-600 text-white'
                        : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {tier.badge}
                  </div>
                )}
                <div
                  className={`text-4xl font-black mb-4 ${
                    hasBadge ? 'text-brand-50' : 'text-neutral-200'
                  }`}
                >
                  {tier.number}
                </div>
                <h4 className="text-lg font-bold mb-2">{tier.title}</h4>
                <p className="text-neutral-500 text-sm">{tier.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
