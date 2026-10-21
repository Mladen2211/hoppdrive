import { Booking, BookingStatus } from '../entities/Booking';

/** Fields stored with a new booking that are not part of the Booking entity. */
export interface BookingExtras {
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerLocale?: string | null;
  locationId?: string | null;
  driverStreet?: string | null;
  driverZip?: string | null;
  driverCity?: string | null;
  driverCountry?: string | null;
  /** Calendar day (UTC midnight of the date). */
  driverBirthDate?: Date | null;
  driverLicenseNumber?: string | null;
  driverLicenseCountry?: string | null;
  /** Discount that was applied to the booking price (already deducted from totalPrice). */
  discount?: { codeId: string; email: string; amount: number } | null;
}

export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByVehicleId(vehicleId: string): Promise<Booking[]>;
  findAll(options?: {
    status?: BookingStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Booking[]; total: number }>;
  /** Stores the booking; a discount redemption is recorded in the same transaction. */
  save(booking: Booking, extras?: BookingExtras): Promise<Booking>;
  update(booking: Booking): Promise<Booking>;
  delete(id: string): Promise<void>;
  countActive(): Promise<number>;
  countPendingReturns(): Promise<number>;
}
