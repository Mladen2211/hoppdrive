/**
 * Readable errors for creating / changing a booking. The API answers business-rule failures with a code:
 *  - 409 booking_overlap      another reserved / active booking covers the period
 *  - 409 maintenance_overlap  the vehicle is in maintenance in that period
 *  - 409 booking_closed       a completed / cancelled booking cannot be moved
 *  - 422 invalid_period       the return is not after the pickup
 *  - 422 discount_invalid     the discount code cannot be used (data.reason says why)
 */
import { errorText } from '@/lib/errors';
import { discountReasonText } from '@/lib/discount';
import { tr } from '@/i18n/active';

interface ApiErrorLike {
  status?: number;
  code?: string;
  message?: string;
  data?: { reason?: string };
  details?: Record<string, string[]>;
}

export function isDiscountInvalid(err: unknown): boolean {
  return (err as ApiErrorLike | null)?.code === 'discount_invalid';
}

/** Reason text of a rejected discount code ("Dieser Code ist abgelaufen."). */
export function discountErrorText(err: unknown): string {
  const e = err as ApiErrorLike | null;
  return discountReasonText(e?.data?.reason, e?.message);
}

export function bookingErrorText(err: unknown, fallback?: string): string {
  const e = err as ApiErrorLike | null;
  switch (e?.code) {
    case 'booking_overlap':
      return tr('errors.bookingOverlap');
    case 'maintenance_overlap':
      return tr('errors.maintenanceOverlap');
    case 'booking_closed':
      return tr('errors.bookingClosed');
    case 'invalid_period':
      return tr('errors.invalidPeriod');
    case 'discount_invalid':
      return discountErrorText(err);
    default:
      return errorText(err, fallback);
  }
}
