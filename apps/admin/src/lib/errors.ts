/**
 * User-facing error text for failed API calls (replaces the raw `alert(err.message)`).
 *
 *   toast.error(t('contracts.rechnungKonnteNicht'), errorText(err));
 *
 * 403 (role lacks permission) always reads "Keine Berechtigung". The API answers in English for
 * business-rule errors; the common ones are translated here (messages errors.*), everything else
 * is passed through.
 */
import { isForbidden } from '@/lib/api';
import { tr } from '@/i18n/active';

const KNOWN_MESSAGES: [RegExp, string][] = [
  [/already booked for the selected dates/i, 'errors.alreadyBooked'],
  [/under maintenance for the selected dates/i, 'errors.underMaintenance'],
  [/vehicle is not available for booking/i, 'errors.notBookable'],
  [/start date must be before end date/i, 'errors.endAfterStart'],
  [/inquiry has no start\/end date/i, 'errors.inquiryNoDates'],
  [/inquiry has already been converted/i, 'errors.inquiryConverted'],
  [/vehicle not found/i, 'errors.vehicleNotFound'],
  [/booking not found/i, 'errors.bookingNotFound'],
  [/invoice not found/i, 'errors.invoiceNotFound'],
  [/contact request not found/i, 'errors.inquiryNotFound'],
  [/periodend must be after periodstart/i, 'errors.periodEnd'],
  [/network error/i, 'errors.network'],
  [/timeout/i, 'errors.timeout'],
];

export function errorText(err: unknown, fallback?: string): string {
  if (isForbidden(err)) return tr('errors.forbidden');
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!message) return fallback ?? tr('errors.tryAgain');
  for (const [pattern, key] of KNOWN_MESSAGES) {
    if (pattern.test(message)) return tr(key);
  }
  return message;
}

/** True when a request was cancelled on purpose (AbortController / axios cancel). */
export function isCancelled(err: unknown): boolean {
  const e = err as { name?: string; code?: string } | null | undefined;
  return e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED';
}
