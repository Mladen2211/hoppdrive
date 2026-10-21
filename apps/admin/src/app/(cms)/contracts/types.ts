import type { InvoiceItemDto, InvoiceType } from '@hoppdrive/shared';
import { deriveInvoiceStatus } from '@/components/ui';

export interface Booking {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
  totalPrice?: number;
  currency?: string;
  contractStatus?: string;
  signedAt?: string | null;
  createdAt?: string;
  vehicle?: { brand: string; model: string; licensePlate?: string | null } | null;
  /** Pickup / return carry real times; false = legacy whole-day booking (stored at 00:00). */
  hasTimes?: boolean;
  customerPhone?: string | null;
  customerLocale?: string | null;
  driverStreet?: string | null;
  driverZip?: string | null;
  driverCity?: string | null;
  driverCountry?: string | null;
  /** YYYY-MM-DD */
  driverBirthDate?: string | null;
  driverLicenseNumber?: string | null;
  driverLicenseCountry?: string | null;
  /** totalPrice is the final price; this is the part that was taken off by the code. */
  discountAmount?: number;
  discountCode?: { id: string; code: string } | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  /** RENTAL (default for older invoices) | DAMAGE | FINE | OTHER */
  type?: InvoiceType;
  /** null for invoices without a booking (damage / fine / other). */
  bookingId: string | null;
  customerName?: string;
  customerEmail?: string | null;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  penalty: number;
  total: number;
  currency: string;
  status: 'PENDING' | 'PAID';
  isOverdue?: boolean;
  parentInvoiceId?: string | null;
  notes?: string | null;
  /** The PDF carries the Swiss QR payment slip. */
  withQrBill?: boolean;
  qrReference?: string | null;
  items?: InvoiceItemDto[];
  createdAt: string;
  booking?: { id: string; customerName: string; vehicle?: { brand: string; model: string } | null } | null;
}

export type BookingStatusFilter = 'all' | 'reserved' | 'active' | 'completed' | 'cancelled';
export type ContractFilter = 'all' | 'pending' | 'signed';
export type InvoiceFilter = 'all' | 'open' | 'overdue' | 'paid';
export type InvoiceTypeFilter = 'all' | InvoiceType;

/** Rental when the API did not say (invoices from before the type existed). */
export const invoiceTypeOf = (inv: Invoice): InvoiceType => inv.type ?? 'RENTAL';

export const vehicleOf = (b: Booking): string => (b.vehicle?.brand ? `${b.vehicle.brand} ${b.vehicle.model}` : '–');

/** Offen / Überfällig / Bezahlt (the API only knows PENDING / PAID; overdue is derived). */
export function invoiceState(inv: Invoice): 'PENDING' | 'PAID' | 'OVERDUE' {
  if (inv.status === 'PAID') return 'PAID';
  return inv.isOverdue ? 'OVERDUE' : deriveInvoiceStatus(inv);
}

export const canInvoice = (b: Booking): boolean => b.status !== 'cancelled' && b.totalPrice != null && b.totalPrice > 0;

/** Callbacks the list and the drawer share. Every mutating one is only offered to roles with "edit". */
export interface ContractActions {
  canEdit: boolean;
  openBooking: (id: string) => void;
  downloadContract: (b: Booking) => void;
  signOnDevice: (b: Booking) => void;
  quickSign: (b: Booking) => void;
  editEmail: (b: Booking) => void;
  /** Opens "Buchung bearbeiten" (times, Fahrerdaten). */
  editBooking: (b: Booking) => void;
  transition: (b: Booking, status: 'active' | 'completed' | 'cancelled') => void;
  /** `null` opens the dialog without a pre-selected booking (the dialog then asks for one). */
  createInvoice: (b: Booking | null) => void;
  downloadInvoice: (inv: Invoice) => void;
  /** The invoice PDF with the Swiss QR payment slip (rendered on demand). */
  downloadInvoiceQr: (inv: Invoice) => void;
  toggleInvoice: (inv: Invoice) => void;
  dunning: (inv: Invoice) => void;
  /** Id of the booking / invoice a request is running for (disables its buttons). */
  busyId: string | null;
}
