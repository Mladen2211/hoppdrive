import type { ContactRequestStatus } from '@hoppdrive/shared';

export interface Inquiry {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  vehicleOfInterest?: string | null;
  message: string;
  desiredStartDate?: string | null;
  desiredEndDate?: string | null;
  status: ContactRequestStatus | string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  /** Code typed into the inquiry form (uppercase); applied when the inquiry is converted. */
  discountCode?: string | null;
  /** Website language of the visitor (de | en | fr | it | hr). */
  locale?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface VehicleRow {
  id: string;
  brand: string;
  model: string;
  licensePlate?: string | null;
  isAvailable?: boolean;
}

export interface BookingRow {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  status: string;
}

/** Tabs (Offen / Alle / Abgelehnt) plus the four pipeline tiles (one status each). */
export type InquiryFilter = 'open' | 'all' | 'denied' | 'pending' | 'reviewed' | 'responded' | 'converted';

/** "Offen" = every inquiry that still needs work. */
export const OPEN_STATUSES = ['pending', 'reviewed', 'responded'] as const;
/** Statuses without further actions. */
export const CLOSED_STATUSES = ['converted', 'denied', 'archived'];
