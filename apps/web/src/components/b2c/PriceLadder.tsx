'use client';

/**
 * "Treppe" of the day tiers (design: `.steps`): one bar per tier, as high as
 * the day price is relative to the first tier (100 % / 80 % / 60 % with the
 * seeded rules). Without a base price (no vehicle known) the bars show the
 * discount only.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/components/ui';
import { useCurrency } from '@/i18n/CurrencyProvider';
import { useFormatters } from '@/i18n/useFormatters';
import { ladder, type PricingTier } from '@/lib/pricing';

interface PriceLadderProps {
  tiers: PricingTier[];
  /** Base price per day of the example vehicle; null = show percentages only. */
  basePricePerDay: number | null;
  /** Small variant for the vehicle page (150 px high, no sub line). */
  compact?: boolean;
  /** ISO code shown in front of the bar prices on wide screens (default: the site currency). */
  currency?: string;
  className?: string;
}

function barClass(index: number, count: number): string {
  if (index === 0) return 'bg-ink';
  if (index === count - 1) return 'bg-ruby';
  return 'bg-[#7A7D80]';
}

export function PriceLadder({
  tiers,
  basePricePerDay,
  compact = false,
  currency: currencyProp,
  className,
}: PriceLadderProps) {
  const t = useTranslations('ladder');
  const tPricing = useTranslations('pricing');
  const siteCurrency = useCurrency();
  const currency = currencyProp || siteCurrency;
  const f = useFormatters(currency);
  const steps = ladder(basePricePerDay ?? 100, tiers, tPricing);
  if (steps.length === 0) return null;
  const top = steps[0].pricePerDay || 1;

  const summary = steps
    .map(
      (step) =>
        `${step.label} ${step.discountPercent === 0 ? t('fullPrice') : t('minus', { percent: step.discountPercent })}`,
    )
    .join(', ');

  return (
    <div
      role="img"
      aria-label={t('ariaLabel', { summary })}
      className={cn(
        'grid items-end border-b-[3px] border-ink',
        compact ? 'h-[150px]' : 'h-[340px] max-md:h-[260px]',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => (
        <div
          key={step.fromDay}
          className={cn(
            'flex flex-col justify-end gap-0.5 text-white',
            compact ? 'p-2.5' : 'px-[18px] pb-4 pt-[18px] max-md:px-2.5 max-md:py-3',
            barClass(index, steps.length),
          )}
          style={{ height: `${Math.max(8, Math.round((step.pricePerDay / top) * 100))}%` }}
        >
          <span className={cn('opacity-95', compact ? 'text-[13px]' : 'text-sm')}>{step.label}</span>
          {basePricePerDay !== null ? (
            <b className={cn('num font-bold leading-none', compact ? 'text-[22px]' : 'text-[36px] max-md:text-[26px]')}>
              <span className={compact ? 'hidden' : 'max-md:hidden'}>{currency} </span>
              {f.money(step.pricePerDay, { withCurrency: false })}
            </b>
          ) : (
            <b className="num text-[36px] font-bold leading-none max-md:text-[26px]">
              {step.discountPercent === 0 ? t('zeroPercent') : `−${step.discountPercent} %`}
            </b>
          )}
          {!compact && (
            <span className="text-sm opacity-95">
              {step.discountPercent === 0 ? (
                <>
                  <span className="max-md:hidden">{t('standard')}</span>
                  <span className="md:hidden">{t('standardShort')}</span>
                </>
              ) : (
                t('discount', { percent: step.discountPercent })
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
