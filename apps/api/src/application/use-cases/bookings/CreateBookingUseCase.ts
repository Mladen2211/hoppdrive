import { v4 as uuid } from 'uuid';
import {
  Booking,
  DateRange,
  Money,
  PricingService,
  type IBookingRepository,
  type IVehicleRepository,
  type IPricingRuleRepository,
} from '../../../domain';

interface CreateBookingInput {
  vehicleId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  totalPrice?: number;
  notes?: string;
}

export class CreateBookingUseCase {
  constructor(
    private bookingRepo: IBookingRepository,
    private vehicleRepo: IVehicleRepository,
    private pricingRuleRepo: IPricingRuleRepository,
  ) {}

  async execute(input: CreateBookingInput): Promise<Booking> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${input.vehicleId} not found`);
    }

    const dateRange = DateRange.create(
      new Date(input.startDate),
      new Date(input.endDate),
    );

    // Check for overlapping bookings
    const existing = await this.bookingRepo.findByVehicleId(input.vehicleId);
    const overlap = existing.find(
      (b) =>
        (b.status === 'reserved' || b.status === 'active') &&
        b.dateRange.overlaps(dateRange),
    );
    if (overlap) {
      throw new Error('Vehicle is already booked for the selected dates');
    }

    // Use admin-supplied price or calculate from pricing rules
    let totalPrice: Money;
    if (input.totalPrice !== undefined && input.totalPrice !== null) {
      totalPrice = Money.create(input.totalPrice, 'CHF');
    } else {
      const rules = await this.pricingRuleRepo.findAll();
      const pricing = PricingService.calculate(
        vehicle.basePricePerDay,
        dateRange.totalDays,
        rules,
      );
      totalPrice = pricing.totalPrice;
    }

    const booking = Booking.create({
      id: uuid(),
      vehicleId: input.vehicleId,
      customerName: input.customerName,
      dateRange,
      totalPrice,
      status: 'reserved',
      notes: input.notes ?? null,
    });

    return this.bookingRepo.save(booking);
  }
}
