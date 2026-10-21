import { DAY_MS } from './TimeUtils';

/** Minimal booking projection needed for revenue / utilisation maths. */
export interface BookingSlice {
  id: string;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
}

/** Milliseconds the booking occupies inside the half-open window [start, end). */
export function overlapMs(booking: BookingSlice, start: Date, end: Date): number {
  const from = Math.max(booking.startDate.getTime(), start.getTime());
  const to = Math.min(booking.endDate.getTime(), end.getTime());
  return Math.max(0, to - from);
}

/**
 * Revenue of a booking attributable to the window [start, end): its total price
 * prorated by the share of its duration that falls inside the window. Because it is
 * a pure ms ratio, revenues of consecutive windows (months) always add up to the total.
 */
export function proratedRevenue(booking: BookingSlice, start: Date, end: Date): number {
  const duration = booking.endDate.getTime() - booking.startDate.getTime();
  if (duration <= 0) return 0;
  const inside = overlapMs(booking, start, end);
  if (inside === 0) return 0;
  return (booking.totalPrice * inside) / duration;
}

/** Whole rental days of a booking (same rounding as DateRange.totalDays: ceil, min 1). */
export function bookingDays(booking: BookingSlice): number {
  const duration = booking.endDate.getTime() - booking.startDate.getTime();
  return Math.max(1, Math.ceil(duration / DAY_MS));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Percent change from `previous` to `current`, rounded to an integer. 0 when both are 0. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
