import type { BookingSlice } from '../services/RevenueCalculator';

/**
 * Read-only aggregate queries for the dashboard and the reports page.
 * Kept separate from the aggregate repositories because it spans several tables.
 */
export interface IReportingRepository {
  /** Non-cancelled bookings overlapping the half-open window [from, to). */
  findBookingsOverlapping(from: Date, to: Date): Promise<BookingSlice[]>;
  /** Bookings whose contract is still unsigned (contractStatus PENDING, not cancelled). */
  countPendingContracts(): Promise<number>;
  /** Invoices with status PENDING and a due date before `now`. */
  countOverdueInvoices(now: Date): Promise<number>;
}
