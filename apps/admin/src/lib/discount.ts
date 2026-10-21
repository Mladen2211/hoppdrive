/**
 * Discount codes in the admin: the reduced price (same rule as the API's DiscountService.computeAmount)
 * and German / localised texts for the reasons a code cannot be used.
 */
import type { DiscountInvalidReason, DiscountType } from '@hoppdrive/shared';
import { fmtMoney } from '@/lib/format';
import { tr } from '@/i18n/active';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** PERCENT of the price or the FIXED amount, never more than the price itself. */
export function discountAmount(type: DiscountType, value: number, baseTotal: number): number {
  const raw = type === 'PERCENT' ? (baseTotal * value) / 100 : value;
  return Math.max(0, Math.min(round2(raw), round2(baseTotal)));
}

/** "20 %" or "CHF 30.00" */
export function describeDiscount(type: DiscountType, value: number, currency?: string | null): string {
  if (type === 'PERCENT') return `${String(value).replace('.', ',')} %`;
  return fmtMoney(value, { currency: currency ?? 'CHF' });
}

const KNOWN_REASONS: DiscountInvalidReason[] = [
  'not_found',
  'inactive',
  'not_started',
  'expired',
  'exhausted',
  'email_limit',
  'min_days',
  'wrong_recipient',
  'email_required',
  'currency_mismatch',
];

/** Text for a reason code of the API (unknown reasons fall back to the server's message). */
export function discountReasonText(reason: string | null | undefined, fallback?: string): string {
  if (reason && (KNOWN_REASONS as string[]).includes(reason)) return tr(`discount.reason.${reason}`);
  return fallback || tr('discount.reason.unknown');
}
