/**
 * Discount codes on the public site: the reason texts live in messages/<locale>.json
 * (contact.discount.reasons.<reason>), the maths mirror the API's DiscountService
 * (PERCENT of the price, FIXED amount, never more than the price).
 */
import type { DiscountReason } from '@/lib/api';

const REASONS: readonly DiscountReason[] = [
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

/** Message key for a reason code of the API; unknown codes fall back to `generic`. */
export function discountReasonKey(reason: string | undefined): DiscountReason | 'generic' {
  return reason && (REASONS as readonly string[]).includes(reason) ? (reason as DiscountReason) : 'generic';
}

export interface DiscountRule {
  type: 'PERCENT' | 'FIXED';
  value: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Amount deducted from `total` (0 for an empty total). */
export function discountAmount(rule: DiscountRule, total: number): number {
  if (!(total > 0)) return 0;
  const raw = rule.type === 'PERCENT' ? (total * rule.value) / 100 : rule.value;
  return Math.max(0, Math.min(round2(raw), round2(total)));
}

/** Upper case without spaces, like the API stores it ("hd-ab12 cd34" -> "HD-AB12CD34"). */
export function normalizeDiscountCode(code: string): string {
  return code.toUpperCase().replace(/\s+/g, '');
}
