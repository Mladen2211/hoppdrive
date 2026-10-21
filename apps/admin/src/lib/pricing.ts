/**
 * Price quote helpers for the admin shell (Neue Buchung, Anfragen).
 *
 * `api.ts` has no function for the public `GET /pricing?vehicleId&days` endpoint, so this file
 * talks to it with its own small axios instance. The endpoint is public (no token needed), so
 * no auth interceptor is required.
 *
 * `daysForRange` mirrors how the API counts rental days (CreateBooking / approve / invoices):
 * ceil((end - start) / 24 h), at least 1.
 * `buildTierBreakdown` mirrors PricingService (day by day, cumulative) to explain a quote:
 * "7 Tage × 79.00 + 7 Tage × 63.20 (20 % ab Tag 8)". The authoritative total always comes from
 * the API quote; the breakdown is only the explanation.
 */
import axios from 'axios';
import type { PricingTierDto } from '@hoppdrive/shared';
import { tr } from '@/i18n/active';

export interface PriceQuote {
  baseDaily: number;
  effectiveDaily: number;
  totalDays: number;
  totalPrice: number;
  discountPercent: number;
  currency: string;
}

const quoteClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api',
});

/** GET /pricing?vehicleId&days: the tiered price for a whole rental. Rejects on API errors. */
export async function fetchPriceQuote(vehicleId: string, days: number, signal?: AbortSignal): Promise<PriceQuote> {
  const res = await quoteClient.get('/pricing', { params: { vehicleId, days }, signal });
  return res.data.data as PriceQuote;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rental days between two dates as the API counts them. Accepts 'YYYY-MM-DD' strings or ISO
 * timestamps; returns 0 when a date is missing/invalid or the end is before the start.
 */
export function daysForRange(start: string | Date | null | undefined, end: string | Date | null | undefined): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.ceil((e - s) / DAY_MS));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface TierSegment {
  /** First rental day of this segment (1-based). */
  fromDay: number;
  days: number;
  discountPercent: number;
  perDay: number;
}

/** Day-by-day price segments (consecutive days with the same discount are merged). */
export function buildTierSegments(baseDaily: number, days: number, tiers: PricingTierDto[]): TierSegment[] {
  const sorted = [...tiers].sort((a, b) => a.fromDay - b.fromDay);
  const segments: TierSegment[] = [];
  for (let day = 1; day <= days; day++) {
    const rule = sorted.find((t) => day >= t.fromDay && (t.toDay === null || day <= t.toDay));
    const discount = rule?.discountPercent ?? 0;
    const last = segments[segments.length - 1];
    if (last && last.discountPercent === discount) {
      last.days += 1;
    } else {
      segments.push({ fromDay: day, days: 1, discountPercent: discount, perDay: round2(baseDaily * (1 - discount / 100)) });
    }
  }
  return segments;
}

function fmtPercent(n: number): string {
  return `${Number.isInteger(n) ? n : String(n).replace('.', ',')} %`;
}

/**
 * "7 Tage × 79.00 + 7 Tage × 63.20 (20 % ab Tag 8)" or "3 Tage × 79.00" without discounts.
 * Returns '' when there is nothing to explain (no days).
 */
export function buildTierBreakdown(baseDaily: number, days: number, tiers: PricingTierDto[]): string {
  if (days < 1 || !Number.isFinite(baseDaily)) return '';
  const segments = buildTierSegments(baseDaily, days, tiers);
  const parts = segments.map((s) => `${s.days} ${tr('pricing.tagN', { count: Number(s.days) })} × ${s.perDay.toFixed(2)}`);
  const discounts = segments.filter((s) => s.discountPercent > 0).map((s) => tr('pricing.abTag', { percent: fmtPercent(s.discountPercent), fromDay: s.fromDay }));
  return parts.join(' + ') + (discounts.length ? ` (${discounts.join(', ')})` : '');
}
