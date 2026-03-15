import { Entity } from './Entity';
import { DateRange } from '../value-objects/DateRange';
import { Money } from '../value-objects/Money';

export type BookingStatus = 'reserved' | 'active' | 'completed' | 'cancelled';

export interface BookingProps {
  id: string;
  vehicleId: string;
  customerName: string;
  dateRange: DateRange;
  totalPrice: Money;
  status: BookingStatus;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Booking extends Entity {
  public vehicleId: string;
  public customerName: string;
  public dateRange: DateRange;
  public totalPrice: Money;
  public status: BookingStatus;
  public notes: string | null;

  private constructor(props: BookingProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.vehicleId = props.vehicleId;
    this.customerName = props.customerName;
    this.dateRange = props.dateRange;
    this.totalPrice = props.totalPrice;
    this.status = props.status;
    this.notes = props.notes;
  }

  static create(props: BookingProps): Booking {
    if (!props.vehicleId) {
      throw new Error('Vehicle ID is required for a booking');
    }
    if (!props.customerName || props.customerName.trim().length === 0) {
      throw new Error('Customer name is required');
    }
    return new Booking(props);
  }

  get totalDays(): number {
    return this.dateRange.totalDays;
  }

  activate(): void {
    if (this.status !== 'reserved') {
      throw new Error('Only reserved bookings can be activated');
    }
    this.status = 'active';
    this.updatedAt = new Date();
  }

  complete(): void {
    if (this.status !== 'active') {
      throw new Error('Only active bookings can be completed');
    }
    this.status = 'completed';
    this.updatedAt = new Date();
  }

  cancel(): void {
    if (this.status === 'completed') {
      throw new Error('Completed bookings cannot be cancelled');
    }
    this.status = 'cancelled';
    this.updatedAt = new Date();
  }
}
