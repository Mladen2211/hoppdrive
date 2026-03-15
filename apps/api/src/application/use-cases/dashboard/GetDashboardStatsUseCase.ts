import type {
  IBookingRepository,
  IVehicleRepository,
  IContactRequestRepository,
} from '../../../domain';

export interface DashboardStats {
  activeRentals: number;
  pendingReturns: number;
  monthlyRevenue: number;
  revenueChangePercent: number;
  fleetUtilization: number;
  totalVehicles: number;
  bookedVehicles: number;
  pendingInquiries: number;
}

export class GetDashboardStatsUseCase {
  constructor(
    private bookingRepo: IBookingRepository,
    private vehicleRepo: IVehicleRepository,
    private contactRepo: IContactRequestRepository,
  ) {}

  async execute(): Promise<DashboardStats> {
    const [activeRentals, pendingReturns, totalVehicles, pendingInquiries] =
      await Promise.all([
        this.bookingRepo.countActive(),
        this.bookingRepo.countPendingReturns(),
        this.vehicleRepo.count(),
        this.contactRepo.count('pending'),
      ]);

    // Simplified calculation – in production, query bookings for the month
    const bookedVehicles = activeRentals;
    const fleetUtilization =
      totalVehicles > 0
        ? Math.round((bookedVehicles / totalVehicles) * 100)
        : 0;

    return {
      activeRentals,
      pendingReturns,
      monthlyRevenue: 0, // Would be calculated from actual booking data
      revenueChangePercent: 0,
      fleetUtilization,
      totalVehicles,
      bookedVehicles,
      pendingInquiries,
    };
  }
}
