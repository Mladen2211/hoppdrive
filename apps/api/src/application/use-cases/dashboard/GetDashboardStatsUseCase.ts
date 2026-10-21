import {
  TimeUtils,
  proratedRevenue,
  percentChange,
  round2,
  type IBookingRepository,
  type IVehicleRepository,
  type IContactRequestRepository,
  type IReportingRepository,
} from '../../../domain';

export interface DashboardStats {
  activeRentals: number;
  pendingReturns: number;
  /** Non-cancelled booking revenue prorated by the days inside the current calendar month. */
  monthlyRevenue: number;
  /** Percent change of monthlyRevenue vs the previous calendar month (rounded to an integer). */
  revenueChangePercent: number;
  fleetUtilization: number;
  totalVehicles: number;
  bookedVehicles: number;
  pendingInquiries: number;
  /** Inquiries created since Monday 00:00 (business time zone), any status. */
  newInquiriesThisWeek: number;
  /** Unsigned contracts (contractStatus PENDING) on non-cancelled bookings. */
  pendingContracts: number;
  /** Invoices still PENDING whose due date has passed. */
  overdueInvoices: number;
}

export class GetDashboardStatsUseCase {
  constructor(
    private bookingRepo: IBookingRepository,
    private vehicleRepo: IVehicleRepository,
    private contactRepo: IContactRequestRepository,
    private reportingRepo: IReportingRepository,
  ) {}

  async execute(): Promise<DashboardStats> {
    const now = new Date();
    const monthStart = TimeUtils.startOfMonth(now, 0);
    const nextMonthStart = TimeUtils.startOfMonth(now, 1);
    const prevMonthStart = TimeUtils.startOfMonth(now, -1);

    const [
      activeRentals,
      pendingReturns,
      totalVehicles,
      pendingInquiries,
      newInquiriesThisWeek,
      pendingContracts,
      overdueInvoices,
      bookings,
    ] = await Promise.all([
      this.bookingRepo.countActive(),
      this.bookingRepo.countPendingReturns(),
      this.vehicleRepo.count(),
      this.contactRepo.count('pending'),
      this.contactRepo.countCreatedSince(TimeUtils.startOfIsoWeek(now)),
      this.reportingRepo.countPendingContracts(),
      this.reportingRepo.countOverdueInvoices(now),
      this.reportingRepo.findBookingsOverlapping(prevMonthStart, nextMonthStart),
    ]);

    const bookedVehicles = activeRentals;
    const fleetUtilization =
      totalVehicles > 0
        ? Math.round((bookedVehicles / totalVehicles) * 100)
        : 0;

    let monthlyRevenue = 0;
    let previousRevenue = 0;
    for (const b of bookings) {
      monthlyRevenue += proratedRevenue(b, monthStart, nextMonthStart);
      previousRevenue += proratedRevenue(b, prevMonthStart, monthStart);
    }
    monthlyRevenue = round2(monthlyRevenue);
    previousRevenue = round2(previousRevenue);

    return {
      activeRentals,
      pendingReturns,
      monthlyRevenue,
      revenueChangePercent: percentChange(monthlyRevenue, previousRevenue),
      fleetUtilization,
      totalVehicles,
      bookedVehicles,
      pendingInquiries,
      newInquiriesThisWeek,
      pendingContracts,
      overdueInvoices,
    };
  }
}
