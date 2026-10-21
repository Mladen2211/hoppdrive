/**
 * Client-safe pricing helpers for the public site. They mirror the API's
 * `PricingService.calculate` (apps/api/src/domain/services/PricingService.ts)
 * exactly: the price is built DAY BY DAY and CUMULATIVE. Every rental day is
 * priced with the discount of the tier it falls into, each day price is
 * rounded to 2 decimals (Money.applyDiscount), the days are summed and the sum
 * is rounded again. Example with the seeded tiers (1-7: 0 %, 8-30: 20 %,
 * 31+: 40 %):
 *
 *   priceFor(79, 14, tiers)  -> total 995.40  (7 x 79.00 + 7 x 63.20), avg 71.10
 *   priceFor(65, 30, tiers)  -> total 1651.00 (7 x 65.00 + 23 x 52.00)
 *
 * The tiers come from the PUBLIC `GET /pricing/tiers` endpoint (see
 * `getPricingTiers` in server-api.ts). This module has no server-only imports
 * so client components (quick bar, calculator, cards) can use it too.
 *
 * Texts ("Tag 1 – 7", "Rabatt ab Tag 8") come from the messages: the helpers that produce
 * them take a translator (`useTranslations('pricing')` / `useTranslations('estimate')`).
 */
import type { Translate } from '@/i18n/types';

export interface PricingTier {
  fromDay: number;
  /** null = open end (e.g. "ab Tag 31") */
  toDay: number | null;
  discountPercent: number;
}

/**
 * The seeded rules (apps/api/prisma/seed.ts). Used ONLY when the tiers
 * endpoint cannot be reached; an empty list from the API is respected
 * (= no discounts at all).
 */
export const DEFAULT_TIERS: PricingTier[] = [
  { fromDay: 1, toDay: 7, discountPercent: 0 },
  { fromDay: 8, toDay: 30, discountPercent: 20 },
  { fromDay: 31, toDay: null, discountPercent: 40 },
];

/** Upper bound for a computed estimate (100 years); beyond that we show none. */
const MAX_DAYS = 36_500;

/** Money.create: round to 2 decimals. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Validates raw API data into tiers (sorted). Returns null when it is not a tier list. */
export function normalizeTiers(raw: unknown): PricingTier[] | null {
  if (!Array.isArray(raw)) return null;
  const tiers: PricingTier[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const { fromDay, toDay, discountPercent } = item as Record<string, unknown>;
    const from = Number(fromDay);
    const discount = Number(discountPercent);
    if (!Number.isFinite(from) || from < 1 || !Number.isFinite(discount)) return null;
    const to = toDay === null || toDay === undefined ? null : Number(toDay);
    if (to !== null && (!Number.isFinite(to) || to < from)) return null;
    tiers.push({ fromDay: from, toDay: to, discountPercent: discount });
  }
  return tiers.sort((a, b) => a.fromDay - b.fromDay);
}

function discountForDay(day: number, sorted: PricingTier[]): number {
  const rule = sorted.find((t) => day >= t.fromDay && (t.toDay === null || day <= t.toDay));
  return rule?.discountPercent ?? 0;
}

export interface PriceResult {
  days: number;
  /** Total for the whole rental, 2 decimals. */
  total: number;
  /** Average price per day (total / days), 2 decimals. */
  perDay: number;
  /** Discount that applies to the LAST day (like the API's `discountPercent`). */
  discountPercent: number;
  /** First rental day that already carries a discount (null = no discount in this period). */
  firstDiscountDay: number | null;
}

/** Day-by-day cumulative price. Returns null for invalid input (no days, no/invalid base price). */
export function priceFor(
  basePricePerDay: number,
  days: number,
  tiers: PricingTier[] = DEFAULT_TIERS,
): PriceResult | null {
  if (!Number.isFinite(basePricePerDay) || basePricePerDay < 0) return null;
  if (!Number.isFinite(days)) return null;
  const n = Math.floor(days);
  if (n < 1 || n > MAX_DAYS) return null;

  const sorted = [...tiers].sort((a, b) => a.fromDay - b.fromDay);
  let total = 0;
  let last = 0;
  let firstDiscountDay: number | null = null;
  for (let day = 1; day <= n; day++) {
    const discount = discountForDay(day, sorted);
    last = discount;
    if (discount > 0 && firstDiscountDay === null) firstDiscountDay = day;
    total += round2(basePricePerDay * (1 - discount / 100));
  }
  const totalPrice = round2(total);
  return {
    days: n,
    total: totalPrice,
    perDay: round2(total / n),
    discountPercent: last,
    firstDiscountDay,
  };
}

export interface LadderStep {
  fromDay: number;
  toDay: number | null;
  discountPercent: number;
  /** Price of ONE day inside this tier. */
  pricePerDay: number;
  /** "Tag 1 – 7" / "Ab Tag 31" */
  label: string;
}

/** Per-day price for every tier ("Preisstaffel"), in tier order. `t` = translator of the `pricing` namespace. */
export function ladder(basePricePerDay: number, tiers: PricingTier[], t: Translate): LadderStep[] {
  return [...tiers]
    .sort((a, b) => a.fromDay - b.fromDay)
    .map((tier) => ({
      fromDay: tier.fromDay,
      toDay: tier.toDay,
      discountPercent: tier.discountPercent,
      pricePerDay: round2(basePricePerDay * (1 - tier.discountPercent / 100)),
      label: tierLabel(tier, t),
    }));
}

/** "Tag 1 – 7" / "Tag 5" / "Ab Tag 31". `t` = translator of the `pricing` namespace. */
export function tierLabel(tier: Pick<PricingTier, 'fromDay' | 'toDay'>, t: Translate): string {
  if (tier.toDay === null) return t('tierFrom', { from: tier.fromDay });
  if (tier.toDay === tier.fromDay) return t('tierDay', { day: tier.fromDay });
  return t('tierRange', { from: tier.fromDay, to: tier.toDay });
}

/** Highest discount of the ladder ("Bis 40 % Langzeitrabatt"); 0 when there is none. */
export function maxDiscount(tiers: PricingTier[] = DEFAULT_TIERS): number {
  return tiers.reduce((max, t) => Math.max(max, t.discountPercent), 0);
}

/** Total for 30 rental days ("30 Tage zusammen"). */
export function monthTotal(basePricePerDay: number, tiers: PricingTier[] = DEFAULT_TIERS): number | null {
  return priceFor(basePricePerDay, 30, tiers)?.total ?? null;
}

/** "Rabatt ab Tag 8" or "ohne Rabatt" for the sub line of a price estimate. `t` = translator of the `estimate` namespace. */
export function discountHint(result: PriceResult, t: Translate): string {
  return result.firstDiscountDay ? t('discountFromDay', { day: result.firstDiscountDay }) : t('noDiscount');
}
