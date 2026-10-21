/**
 * Helpers of the Marketing page: discount code states, the validity text, the code generator and the
 * reason why a customer cannot receive campaigns.
 */
import type { CustomerDto, DiscountCodeDto, DiscountStatus } from '@hoppdrive/shared';
import type { StatusTone } from '@/components/ui';
import { describeDiscount } from '@/lib/discount';
import { fmtDate } from '@/lib/format';
import { tr } from '@/i18n/active';

export type MarketingTab = 'codes' | 'customers' | 'campaign' | 'history';
export const MARKETING_TABS: MarketingTab[] = ['codes', 'customers', 'campaign', 'history'];

export const CODE_STATUS_TONE: Record<DiscountStatus, StatusTone> = {
  active: 'green',
  inactive: 'gray',
  scheduled: 'blue',
  expired: 'gray',
  exhausted: 'amber',
};

export const CODE_STATUSES: DiscountStatus[] = ['active', 'scheduled', 'expired', 'exhausted', 'inactive'];

// No 0/O/1/I so a code read out over the phone is not mistaken.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A fresh readable code like HD-7K3Q-M9XA (the server checks that it is unused). */
export function generateCode(): string {
  const pick = () => {
    const bytes = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else bytes[0] = Math.floor(Math.random() * 2 ** 32);
    return CODE_ALPHABET[bytes[0] % CODE_ALPHABET.length];
  };
  const part = () => Array.from({ length: 4 }, pick).join('');
  return `HD-${part()}-${part()}`;
}

/** "ab 01.12.2026 bis 31.01.2027", "bis 31.01.2027", "unbegrenzt" */
export function validityText(code: Pick<DiscountCodeDto, 'validFrom' | 'validUntil'>): string {
  if (code.validFrom && code.validUntil) return tr('marketing.validity.range', { from: fmtDate(code.validFrom), to: fmtDate(code.validUntil) });
  if (code.validFrom) return tr('marketing.validity.from', { from: fmtDate(code.validFrom) });
  if (code.validUntil) return tr('marketing.validity.until', { to: fmtDate(code.validUntil) });
  return tr('marketing.validity.unlimited');
}

export const discountText = (code: Pick<DiscountCodeDto, 'type' | 'value' | 'currency'>): string => describeDiscount(code.type, code.value, code.currency);

/** Why a customer cannot receive campaigns (null = eligible). */
export function ineligibleReason(customer: CustomerDto): string | null {
  if (customer.eligible) return null;
  if (customer.unsubscribed) return tr('marketing.customers.reasonUnsubscribed');
  return tr('marketing.customers.reasonNoConsent');
}
