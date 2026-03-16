import { PrismaClient, Booking as PrismaBooking } from '@prisma/client';
import {
  Booking,
  DateRange,
  Money,
  type IBookingRepository,
  type BookingStatus,
} from '../../../domain';

export class PrismaBookingRepository implements IBookingRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Booking | null> {
    const row = await this.prisma.booking.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByVehicleId(vehicleId: string): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({
      where: { vehicleId },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findAll(options?: {
    status?: BookingStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Booking[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where = options?.status ? { status: options.status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async save(booking: Booking, customerEmail?: string): Promise<Booking> {
    const row = await this.prisma.booking.create({
      data: {
        id: booking.id,
        vehicleId: booking.vehicleId,
        customerName: booking.customerName,
        customerEmail: customerEmail || null,
        startDate: booking.dateRange.startDate,
        endDate: booking.dateRange.endDate,
        totalPrice: booking.totalPrice.amount,
        currency: booking.totalPrice.currency,
        status: booking.status,
        notes: booking.notes,
      },
    });
    return this.toDomain(row);
  }

  async update(booking: Booking): Promise<Booking> {
    const row = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: booking.status,
        notes: booking.notes,
      },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.booking.delete({ where: { id } });
  }

  async countActive(): Promise<number> {
    return this.prisma.booking.count({
      where: { status: { in: ['reserved', 'active'] } },
    });
  }

  async countPendingReturns(): Promise<number> {
    return this.prisma.booking.count({
      where: {
        status: 'active',
        endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // within 7 days
      },
    });
  }

  private toDomain(row: PrismaBooking): Booking {
    return Booking.create({
      id: row.id,
      vehicleId: row.vehicleId,
      customerName: row.customerName,
      dateRange: DateRange.create(row.startDate, row.endDate),
      totalPrice: Money.create(Number(row.totalPrice), row.currency),
      status: row.status as BookingStatus,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
