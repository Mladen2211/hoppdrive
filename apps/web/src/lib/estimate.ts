/**
 * Text of the live "Richtpreis" pill (quick-request bar, contact form, vehicle
 * price card). Always an estimate, never a binding offer.
 * `t` = translator of the `estimate` namespace; `locale` formats the amounts.
 */
import type { Translate } from '@/i18n/types';
import { fmtMoney } from '@/lib/format';
import { discountHint, type PriceResult } from '@/lib/pricing';

export interface EstimateText {
  label?: string;
  price: string;
  sub?: string;
}

export function describeEstimate(args: {
  t: Translate;
  locale: string;
  /** Currency code of the amounts (default 'CHF'). */
  currency?: string;
  /** Base price per day of the chosen vehicle, if any. */
  basePricePerDay: number | null;
  days: number | null;
  result: PriceResult | null;
  /** Both dates set but end before start. */
  invalid?: boolean;
  /** Cheapest vehicle of the fleet, shown while no vehicle is chosen. */
  fallbackMin?: number | null;
}): EstimateText {
  const { t, locale, currency, basePricePerDay, days, result, invalid, fallbackMin } = args;
  const money = (value: number, decimals = 2) => fmtMoney(value, { locale, currency, decimals });

  if (invalid) {
    return { label: t('label'), price: '–', sub: t('invalidSub') };
  }
  if (result && days) {
    return {
      label: t('labelDays', { days }),
      price: money(result.total),
      sub: t('averageSub', { perDay: money(result.perDay), hint: discountHint(result, t) }),
    };
  }
  if (basePricePerDay !== null) {
    return {
      label: t('label'),
      price: t('fromPerDay', { price: money(basePricePerDay, 0) }),
      sub: t('pickPeriod'),
    };
  }
  return {
    label: t('label'),
    price: fallbackMin != null ? t('fromPerDay', { price: money(fallbackMin, 0) }) : '–',
    sub: t('pickVehicleAndPeriod'),
  };
}
