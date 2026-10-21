import { PrismaClient } from '@prisma/client';
import type { IReportingRepository, BookingSlice } from '../../../domain';

export class PrismaReportingRepository implements IReportingRepository {
  constructor(private prisma: PrismaClient) {}

  async findBookingsOverlapping(from: Date, to: Date): Promise<BookingSlice[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: { not: 'cancelled' },
        startDate: { lt: to },
        endDate: { gt: from },
      },
      select: { id: true, vehicleId: true, startDate: true, endDate: true, totalPrice: true },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      startDate: r.startDate,
      endDate: r.endDate,
      totalPrice: Number(r.totalPrice),
    }));
  }

  async countPendingContracts(): Promise<number> {
    return this.prisma.booking.count({
      where: { contractStatus: 'PENDING', status: { not: 'cancelled' } },
    });
  }

  async countOverdueInvoices(now: Date): Promise<number> {
    return this.prisma.invoice.count({
      where: { status: 'PENDING', dueDate: { lt: now } },
    });
  }
}
