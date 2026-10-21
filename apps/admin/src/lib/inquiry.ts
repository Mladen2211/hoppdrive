/**
 * Small helpers shared by the dashboard and the inquiries page.
 */
import { daysForRange } from '@/lib/pricing';
import { tr } from '@/i18n/active';

export interface VehicleLike {
  id: string;
  brand: string;
  model: string;
  licensePlate?: string | null;
}

/**
 * Finds the vehicle an inquiry asked for. The website sends the vehicle's display name in
 * `vehicleOfInterest`; the approve flow always matched it loosely ("brand model" contains it), so
 * this does too, but an exact match wins over a partial one.
 */
export function matchVehicleByName<T extends VehicleLike>(vehicles: T[], name: string | null | undefined): T | undefined {
  const needle = name?.trim().toLowerCase();
  if (!needle) return undefined;
  const label = (v: T) => `${v.brand} ${v.model}`.toLowerCase();
  return vehicles.find((v) => label(v) === needle) ?? vehicles.find((v) => label(v).includes(needle));
}

/** Rental days of an inquiry as the API counts them (0 when a date is missing). */
export function inquiryDays(inq: { desiredStartDate?: string | null; desiredEndDate?: string | null }): number {
  return daysForRange(inq.desiredStartDate, inq.desiredEndDate);
}

/**
 * "seit 2 Tagen" / "seit 3 Stunden" / "seit 12 Minuten": how long ago something happened, phrased for
 * "Älteste seit 2 Tagen unbeantwortet".
 */
export function sinceText(input: string | Date | null | undefined, now: Date = new Date()): string {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? tr('time.sinceFewMinutes') : tr('time.sinceMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr('time.sinceHours', { count: hours });
  return tr('time.sinceDays', { count: Math.floor(hours / 24) });
}
