import type { PrismaClient } from '@prisma/client';
import { TimeUtils } from '../../domain';

/**
 * Live "availableNow" computation for vehicle DTOs.
 *
 * A vehicle is NOT available now when a reserved/active booking or a maintenance period
 * overlaps the current calendar day (business time zone). Day granularity on purpose:
 * a booking that ends today at 00:00 means the car is back, a booking that starts today
 * means it is out. Computed per request (two small queries) and never cached with the
 * 5-minute vehicle list, because it changes with time.
 */
export class VehicleAvailabilityService {
  constructor(private prisma: PrismaClient) {}

  /** Ids (out of `vehicleIds`) that are occupied today. */
  async findBusyVehicleIds(vehicleIds: string[], now: Date = new Date()): Promise<Set<string>> {
    if (vehicleIds.length === 0) return new Set();

    const dayStart = TimeUtils.startOfDay(now);
    const dayEnd = TimeUtils.startOfNextDay(now);
    const overlapsToday = { startDate: { lt: dayEnd }, endDate: { gt: dayStart } };

    const [bookings, maintenance] = await Promise.all([
      this.prisma.booking.findMany({
        where: { vehicleId: { in: vehicleIds }, status: { in: ['reserved', 'active'] }, ...overlapsToday },
        select: { vehicleId: true },
      }),
      this.prisma.vehicleMaintenance.findMany({
        where: { vehicleId: { in: vehicleIds }, ...overlapsToday },
        select: { vehicleId: true },
      }),
    ]);

    const busy = new Set<string>();
    for (const b of bookings) busy.add(b.vehicleId);
    for (const m of maintenance) busy.add(m.vehicleId);
    return busy;
  }
}
