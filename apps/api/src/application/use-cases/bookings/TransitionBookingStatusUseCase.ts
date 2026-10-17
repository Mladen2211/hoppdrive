import { type Booking, type IBookingRepository } from '../../../domain';

interface TransitionBookingStatusInput {
  id: string;
  status: 'active' | 'completed' | 'cancelled';
}

/**
 * Drives Booking.activate()/complete()/cancel() — domain logic that already
 * existed but had no use-case or route ever calling it, so a booking stayed
 * "reserved" forever once created.
 */
export class TransitionBookingStatusUseCase {
  constructor(private bookingRepo: IBookingRepository) {}

  async execute(input: TransitionBookingStatusInput): Promise<Booking> {
    const booking = await this.bookingRepo.findById(input.id);
    if (!booking) {
      throw new Error(`Booking ${input.id} not found`);
    }

    switch (input.status) {
      case 'active':
        booking.activate();
        break;
      case 'completed':
        booking.complete();
        break;
      case 'cancelled':
        booking.cancel();
        break;
      default:
        throw new Error(`Invalid status transition: ${input.status}`);
    }

    return this.bookingRepo.update(booking);
  }
}
