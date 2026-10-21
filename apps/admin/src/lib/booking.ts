/**
 * Helpers around bookings, contracts and invoices shared by the dashboard and the contracts page.
 */
import type { StepState } from '@/components/ui';
import { tr } from '@/i18n/active';

export interface BookingLike {
  id: string;
  status: string;
  contractStatus?: string | null;
  customerName?: string;
  totalPrice?: number;
}

export interface InvoiceLike {
  bookingId: string | null;
  status: string;
}

/** "Nr. 3F2A9C1B": the short contract number shown next to a booking (first 8 characters of the id). */
export function contractNumber(bookingId: string): string {
  return bookingId.substring(0, 8).toUpperCase();
}

export const contractFilename = (bookingId: string) => `HoppDrive-Vertrag-${contractNumber(bookingId)}.pdf`;
export const invoiceFilename = (invoiceNumber: string) => `HoppDrive-Rechnung-${invoiceNumber}.pdf`;

export interface BookingProgress {
  /** Vertrag (booking exists), Signiert, Rechnung (any invoice), Bezahlt (all invoices paid). */
  steps: { label: string; state: StepState }[];
  /** Text for "Als Nächstes: ..." on mobile and in the drawer. */
  next: string;
  /** Machine-readable id of the next step: 'sign' | 'invoice' | 'pay' | 'done' | 'none'. */
  nextAction: 'sign' | 'invoice' | 'pay' | 'done' | 'none';
}

/**
 * Progress of a booking. Cancelled bookings have none (all steps open). The first unfinished step is
 * "now" (the next thing to do).
 */
export function bookingProgress(booking: BookingLike, invoices: InvoiceLike[]): BookingProgress {
  if (booking.status === 'cancelled') {
    return {
      steps: [tr('common.vertrag'), tr('common.signiert'), tr('booking.rechnung'), tr('common.bezahlt')].map((label) => ({ label, state: 'todo' as StepState })),
      next: tr('booking.storniert'),
      nextAction: 'none',
    };
  }
  const signed = booking.contractStatus === 'SIGNED';
  const hasInvoice = invoices.length > 0;
  const allPaid = hasInvoice && invoices.every((i) => i.status === 'PAID');
  const done = [true, signed, hasInvoice, allPaid];
  const firstOpen = done.indexOf(false);
  const labels = [tr('common.vertrag'), tr('common.signiert'), tr('booking.rechnung'), tr('common.bezahlt')];
  const steps = labels.map((label, index) => ({
    label,
    state: (done[index] ? 'done' : index === firstOpen ? 'now' : 'todo') as StepState,
  }));
  if (firstOpen === -1) return { steps, next: tr('booking.allesErledigt'), nextAction: 'done' };
  if (firstOpen === 1) return { steps, next: tr('booking.unterschriftAbwarten'), nextAction: 'sign' };
  if (firstOpen === 2) return { steps, next: tr('common.rechnungErstellen'), nextAction: 'invoice' };
  return { steps, next: tr('booking.zahlungPruefen'), nextAction: 'pay' };
}
