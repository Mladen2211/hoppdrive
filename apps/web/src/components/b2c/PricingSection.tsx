'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { PriceCalculator } from '@/components/b2c/PriceCalculator';
import { PriceLadder } from '@/components/b2c/PriceLadder';
import { useSelectedVehicle } from '@/components/b2c/SelectedVehicleContext';
import { Badge } from '@/components/ui';
import type { Translate } from '@/i18n/types';
import { useSiteFormatters } from '@/i18n/CurrencyProvider';
import { tierLabel, type PricingTier as PricingRuleTier } from '@/lib/pricing';
import type { PricingContent, PricingTier } from '@/types/homepage-sections';

export type { PricingContent, PricingTier };

interface PricingSectionProps {
  config?: {
    visible?: boolean;
    title?: string;
    tiers?: PricingTier[];
  } | null;
  content?: PricingContent;
}

/**
 * Copy for the tiers when the CMS has none: derived from the live day tiers, so
 * it can never contradict the ladder (which comes from the API's pricing rules).
 * `t` = translator of the `pricing` namespace.
 */
function defaultTierCopy(tiers: PricingRuleTier[], t: Translate): PricingTier[] {
  return tiers.map((tier, index) => ({
    number: String(index + 1).padStart(2, '0'),
    title: tierLabel(tier, t),
    description:
      tier.discountPercent === 0
        ? t('tierStandard')
        : t('tierDiscount', { percent: tier.discountPercent }),
    ...(tier.discountPercent > 0 ? { badge: t('tierBadge', { percent: tier.discountPercent }) } : {}),
  }));
}

export function PricingSection({ config, content }: PricingSectionProps) {
  const t = useTranslations('pricing');
  const f = useSiteFormatters();
  const { vehicles, tiers } = useSelectedVehicle();
  const [ladderVehicleId, setLadderVehicleId] = useState<string | null>(null);
  const onVehicleChange = useCallback((id: string | null) => setLadderVehicleId(id), []);

  if (config && config.visible === false) return null;

  const c = content || {};
  const exampleVehicle = vehicles.find((v) => v.id === ladderVehicleId) ?? vehicles[0] ?? null;
  const label = c.label ?? t('label');
  const heading = c.heading ?? config?.title ?? t('heading');
  const description =
    c.description ??
    (exampleVehicle
      ? t('descriptionVehicle', {
          name: exampleVehicle.name,
          price: f.money(exampleVehicle.basePricePerDay, { decimals: 0 }),
        })
      : t('description'));
  // CMS copy for the tiers: section content first, then the legacy `pricing` setting, then the defaults.
  const tierCopy = c.tiers?.length ? c.tiers : config?.tiers?.length ? config.tiers : defaultTierCopy(tiers, t);
  const includedItems = c.includedItems?.length ? c.includedItems : (t.raw('included') as string[]);

  return (
    <section id="pricing" className="sec">
      <div className="wrap">
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] items-start gap-14 max-lg:grid-cols-1 max-lg:gap-8">
          <div className="flex flex-col gap-[22px] max-md:gap-[18px]">
            <p className="kick">{label}</p>
            <h2 className="h2">{heading}</h2>
            <p className="lead">{description}</p>

            <PriceLadder tiers={tiers} basePricePerDay={exampleVehicle?.basePricePerDay ?? null} />

            {/* Tier copy maintained in the CMS (Startseite → Preismodell) */}
            <ol className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              {tierCopy.map((tier, index) => (
                <li key={`${tier.title}-${index}`} className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {tier.title}
                    {tier.badge && <Badge tone={index === tierCopy.length - 1 ? 'ruby' : 'off'}>{tier.badge}</Badge>}
                  </span>
                  <span className="text-sm leading-[1.45] text-graphite">{tier.description}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-2.5 border-t border-line pt-5">
              <h3 className="text-[15px] font-bold">{t('includedTitle')}</h3>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium">
                {includedItems.map((text) => (
                  <li key={text} className="flex items-center gap-2">
                    <Check size={18} strokeWidth={2.4} className="flex-none text-ruby" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <PriceCalculator variant="card" onVehicleChange={onVehicleChange} className="lg:sticky lg:top-6" />
        </div>
      </div>
    </section>
  );
}
