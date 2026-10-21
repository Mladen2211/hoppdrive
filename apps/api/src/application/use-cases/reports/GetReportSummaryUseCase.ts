import {
  TimeUtils,
  bookingDays,
  overlapMs,
  proratedRevenue,
  round1,
  round2,
  type BookingSlice,
  type IReportingRepository,
  type IVehicleRepository,
  type VehicleType,
} from '../../../domain';
import { AppError } from '../../errors';

const DAY_MS = TimeUtils.DAY_MS;
/** Guards the endpoint against absurd ranges (about 10 years). */
const MAX_RANGE_DAYS = 3660;

export interface ReportKpis {
  revenue: number;
  bookings: number;
  avgDurationDays: number;
  utilizationPercent: number;
}

export interface ReportSummary extends ReportKpis {
  /** Inclusive start instant of the range. */
  from: string;
  /** Inclusive last instant of the range (end of the `to` day). */
  to: string;
  /** Same range shifted one year back. */
  previous: ReportKpis;
  /** One entry per calendar month touched by the range; revenue is clipped to the range. */
  monthly: { month: string; revenue: number; prevRevenue: number }[];
  /** share = percent (0-100) of the range's total revenue. */
  byCategory: { type: VehicleType; revenue: number; share: number }[];
  byVehicle: {
    vehicleId: string;
    name: string;
    bookings: number;
    days: number;
    utilizationPercent: number;
    revenue: number;
  }[];
}

export class GetReportSummaryUseCase {
  constructor(
    private reportingRepo: IReportingRepository,
    private vehicleRepo: IVehicleRepository,
  ) {}

  /**
   * @param fromInput "YYYY-MM-DD" (local day) or ISO instant — start, inclusive
   * @param toInput   "YYYY-MM-DD" (local day, fully included) or ISO instant — end
   */
  async execute(fromInput: string, toInput: string): Promise<ReportSummary> {
    const from = TimeUtils.parseRangeBoundary(fromInput, 'start');
    const to = TimeUtils.parseRangeBoundary(toInput, 'end'); // exclusive end instant
    if (!from || !to) {
      throw new AppError('from and to must be valid dates (YYYY-MM-DD)', 400, 'invalid_range');
    }
    if (from >= to) {
      throw new AppError('from must be before to', 400, 'invalid_range');
    }
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
      throw new AppError('The requested range is too large', 400, 'invalid_range');
    }

    const prevFrom = TimeUtils.shiftYears(from, -1);
    const prevTo = TimeUtils.shiftYears(to, -1);

    // One query for current and previous period.
    const [bookings, vehicles] = await Promise.all([
      this.reportingRepo.findBookingsOverlapping(prevFrom < from ? prevFrom : from, to),
      this.vehicleRepo.findAll(),
    ]);
    const vehicleCount = vehicles.length;

    const current = this.kpis(bookings, from, to, vehicleCount);
    const previous = this.kpis(bookings, prevFrom, prevTo, vehicleCount);

    // ── Monthly series (current vs same months one year earlier) ──
    const monthly: ReportSummary['monthly'] = [];
    let cursor = TimeUtils.startOfMonth(from, 0);
    while (cursor < to) {
      const next = TimeUtils.startOfMonth(cursor, 1);
      const segStart = cursor < from ? from : cursor;
      const segEnd = next > to ? to : next;
      const prevSegStart = TimeUtils.shiftYears(segStart, -1);
      const prevSegEnd = TimeUtils.shiftYears(segEnd, -1);
      let revenue = 0;
      let prevRevenue = 0;
      for (const b of bookings) {
        revenue += proratedRevenue(b, segStart, segEnd);
        prevRevenue += proratedRevenue(b, prevSegStart, prevSegEnd);
      }
      monthly.push({
        month: TimeUtils.monthKey(cursor),
        revenue: round2(revenue),
        prevRevenue: round2(prevRevenue),
      });
      cursor = next;
    }

    // ── Per vehicle + per category ──
    const rangeMs = to.getTime() - from.getTime();
    const perVehicle = new Map<string, { bookings: number; ms: number; revenue: number }>();
    for (const b of bookings) {
      const ms = overlapMs(b, from, to);
      if (ms === 0) continue;
      const entry = perVehicle.get(b.vehicleId) ?? { bookings: 0, ms: 0, revenue: 0 };
      entry.bookings += 1;
      entry.ms += ms;
      entry.revenue += proratedRevenue(b, from, to);
      perVehicle.set(b.vehicleId, entry);
    }

    const byVehicle: ReportSummary['byVehicle'] = vehicles.map((v) => {
      const e = perVehicle.get(v.id) ?? { bookings: 0, ms: 0, revenue: 0 };
      return {
        vehicleId: v.id,
        name: `${v.brand} ${v.model}`,
        bookings: e.bookings,
        days: Math.round(e.ms / DAY_MS),
        utilizationPercent: rangeMs > 0 ? Math.min(100, round1((e.ms / rangeMs) * 100)) : 0,
        revenue: round2(e.revenue),
      };
    });
    byVehicle.sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));

    const typeRevenue = new Map<VehicleType, number>();
    for (const v of vehicles) {
      const e = perVehicle.get(v.id);
      if (!e || e.revenue === 0) continue;
      typeRevenue.set(v.type, (typeRevenue.get(v.type) ?? 0) + e.revenue);
    }
    const totalRevenue = Array.from(typeRevenue.values()).reduce((s, n) => s + n, 0);
    const byCategory: ReportSummary['byCategory'] = Array.from(typeRevenue.entries())
      .map(([type, revenue]) => ({
        type,
        revenue: round2(revenue),
        share: totalRevenue > 0 ? round1((revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      from: from.toISOString(),
      to: new Date(to.getTime() - 1).toISOString(),
      ...current,
      previous,
      monthly,
      byCategory,
      byVehicle,
    };
  }

  /** KPIs for the half-open window [start, end). */
  private kpis(
    bookings: BookingSlice[],
    start: Date,
    end: Date,
    vehicleCount: number,
  ): ReportKpis {
    let revenue = 0;
    let bookedMs = 0;
    let count = 0;
    let durationSum = 0;

    for (const b of bookings) {
      const ms = overlapMs(b, start, end);
      if (ms === 0) continue;
      count += 1;
      bookedMs += ms;
      revenue += proratedRevenue(b, start, end);
      durationSum += bookingDays(b);
    }

    const capacityMs = vehicleCount * (end.getTime() - start.getTime());
    return {
      revenue: round2(revenue),
      bookings: count,
      avgDurationDays: count > 0 ? round1(durationSum / count) : 0,
      utilizationPercent: capacityMs > 0 ? Math.min(100, round1((bookedMs / capacityMs) * 100)) : 0,
    };
  }
}
