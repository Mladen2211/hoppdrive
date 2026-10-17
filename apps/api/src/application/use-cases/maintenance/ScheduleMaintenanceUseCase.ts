import { v4 as uuid } from 'uuid';
import {
  VehicleMaintenance,
  DateRange,
  type IVehicleMaintenanceRepository,
  type IBookingRepository,
  type MaintenanceReason,
} from '../../../domain';

interface ScheduleMaintenanceInput {
  vehicleId: string;
  startDate: string;
  endDate: string;
  reason: MaintenanceReason;
  notes?: string | null;
  createdBy?: string | null;
}

export class ScheduleMaintenanceUseCase {
  constructor(
    private maintenanceRepo: IVehicleMaintenanceRepository,
    private bookingRepo: IBookingRepository,
  ) {}

  async execute(input: ScheduleMaintenanceInput): Promise<VehicleMaintenance> {
    const dateRange = DateRange.create(new Date(input.startDate), new Date(input.endDate));

    // Reject if an active/reserved booking already occupies this window —
    // forces the admin to resolve the conflict first rather than silently
    // creating a contradictory state.
    const existingBookings = await this.bookingRepo.findByVehicleId(input.vehicleId);
    const bookingOverlap = existingBookings.find(
      (b) => (b.status === 'reserved' || b.status === 'active') && b.dateRange.overlaps(dateRange),
    );
    if (bookingOverlap) {
      throw new Error('Vehicle has an active or reserved booking overlapping these dates');
    }

    const maintenance = VehicleMaintenance.create({
      id: uuid(),
      vehicleId: input.vehicleId,
      dateRange,
      reason: input.reason,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    });

    return this.maintenanceRepo.save(maintenance);
  }
}
