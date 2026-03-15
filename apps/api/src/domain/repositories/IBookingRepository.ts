import { Booking, BookingStatus } from '../entities/Booking';

export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByVehicleId(vehicleId: string): Promise<Booking[]>;
  findAll(options?: {
    status?: BookingStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Booking[]; total: number }>;
  save(booking: Booking): Promise<Booking>;
  update(booking: Booking): Promise<Booking>;
  delete(id: string): Promise<void>;
  countActive(): Promise<number>;
  countPendingReturns(): Promise<number>;
}
