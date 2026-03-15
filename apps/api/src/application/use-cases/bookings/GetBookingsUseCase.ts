import type { IBookingRepository, BookingStatus, Booking } from '../../../domain';

interface GetBookingsInput {
  status?: BookingStatus;
  page?: number;
  pageSize?: number;
}

export class GetBookingsUseCase {
  constructor(private bookingRepo: IBookingRepository) {}

  async execute(input: GetBookingsInput = {}): Promise<{
    items: Booking[];
    total: number;
  }> {
    return this.bookingRepo.findAll({
      status: input.status,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    });
  }
}
