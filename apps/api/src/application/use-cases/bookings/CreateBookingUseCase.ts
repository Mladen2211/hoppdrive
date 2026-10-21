import { v4 as uuid } from 'uuid';
import {
  Booking,
  DateRange,
  Money,
  PricingService,
  type IBookingRepository,
  type IVehicleRepository,
  type IPricingRuleRepository,
  type IVehicleMaintenanceRepository,
} from '../../../domain';
import type { IDiscountPolicy } from '../../interfaces/IDiscountPolicy';
import { AppError } from '../../errors';

export interface CreateBookingInput {
  vehicleId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Website language of the customer. */
  customerLocale?: string;
  /** Pickup / return as ISO date-times (real times; midnight = whole day). */
  startDate: string;
  endDate: string;
  /** Price BEFORE the discount (computed from the pricing rules when omitted). */
  totalPrice?: number;
  notes?: string;
  locationId?: string;
  driverStreet?: string;
  driverZip?: string;
  driverCity?: string;
  driverCountry?: string;
  /** Calendar day. */
  driverBirthDate?: Date | null;
  driverLicenseNumber?: string;
  driverLicenseCountry?: string;
  /** Optional discount code; applied on top of totalPrice. */
  discountCode?: string;
}

export interface CreateBookingResult {
  booking: Booking;
  /** Amount deducted by the discount code (0 when none). */
  discountAmount: number;
  discountCodeId: string | null;
}

export class CreateBookingUseCase {
  constructor(
    private bookingRepo: IBookingRepository,
    private vehicleRepo: IVehicleRepository,
    private pricingRuleRepo: IPricingRuleRepository,
    private maintenanceRepo: IVehicleMaintenanceRepository,
    private discounts?: IDiscountPolicy,
  ) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingResult> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${input.vehicleId} not found`);
    }

    if (!vehicle.isAvailable) {
      throw new Error('Vehicle is not available for booking');
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

    // Check for overlapping maintenance/decommission periods
    const maintenanceOverlap = await this.maintenanceRepo.findOverlapping(input.vehicleId, dateRange);
    if (maintenanceOverlap.length > 0) {
      throw new Error('Vehicle is under maintenance for the selected dates');
    }

    // Admin-supplied base price, or calculated from the pricing rules (in the vehicle's currency,
    // which follows Settings → Währung).
    const currency = vehicle.basePricePerDay.currency;
    let basePrice: Money;
    if (input.totalPrice !== undefined && input.totalPrice !== null) {
      basePrice = Money.create(input.totalPrice, currency);
    } else {
      const rules = await this.pricingRuleRepo.findAll();
      basePrice = PricingService.calculate(vehicle.basePricePerDay, dateRange.totalDays, rules).totalPrice;
    }

    // Optional discount code, applied to the computed price.
    let totalPrice = basePrice;
    let discountAmount = 0;
    let discountCodeId: string | null = null;
    const code = input.discountCode?.trim();
    if (code) {
      if (!this.discounts) throw new Error('Discount codes are not available');
      const check = await this.discounts.check({
        code,
        email: input.customerEmail,
        days: dateRange.totalDays,
        baseTotal: basePrice.amount,
        currency,
      });
      if (!check.valid || !check.code) {
        throw new AppError(check.message ?? 'Der Rabattcode ist ungültig.', 422, 'discount_invalid', { reason: check.reason }, {
          discountCode: [check.message ?? 'Der Rabattcode ist ungültig.'],
        });
      }
      discountAmount = check.discount;
      discountCodeId = check.code.id;
      totalPrice = Money.create(Math.max(0, basePrice.amount - discountAmount), currency);
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

    const saved = await this.bookingRepo.save(booking, {
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      customerLocale: input.customerLocale,
      locationId: input.locationId,
      driverStreet: input.driverStreet,
      driverZip: input.driverZip,
      driverCity: input.driverCity,
      driverCountry: input.driverCountry,
      driverBirthDate: input.driverBirthDate,
      driverLicenseNumber: input.driverLicenseNumber,
      driverLicenseCountry: input.driverLicenseCountry,
      discount:
        discountCodeId && input.customerEmail
          ? { codeId: discountCodeId, email: input.customerEmail, amount: discountAmount }
          : discountCodeId
            ? { codeId: discountCodeId, email: '', amount: discountAmount }
            : null,
    });
    return { booking: saved, discountAmount, discountCodeId };
  }
}
