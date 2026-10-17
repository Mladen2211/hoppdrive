import { Entity } from './Entity';
import { DateRange } from '../value-objects/DateRange';

export type MaintenanceReason = 'repair' | 'accident' | 'other';

export interface VehicleMaintenanceProps {
  id: string;
  vehicleId: string;
  dateRange: DateRange;
  reason: MaintenanceReason;
  notes: string | null;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * A date-ranged block that takes a vehicle out of the rentable pool —
 * repair, accident, or other reason. Effective state ("is this currently
 * blocking bookings") is derived purely from comparing dates at read time;
 * there is no stored "active" flag and no cron job to lift it.
 */
export class VehicleMaintenance extends Entity {
  public vehicleId: string;
  public dateRange: DateRange;
  public reason: MaintenanceReason;
  public notes: string | null;
  public createdBy: string | null;

  private constructor(props: VehicleMaintenanceProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.vehicleId = props.vehicleId;
    this.dateRange = props.dateRange;
    this.reason = props.reason;
    this.notes = props.notes;
    this.createdBy = props.createdBy ?? null;
  }

  static create(props: VehicleMaintenanceProps): VehicleMaintenance {
    if (!props.vehicleId) {
      throw new Error('Vehicle ID is required for a maintenance period');
    }
    return new VehicleMaintenance(props);
  }

  overlaps(range: DateRange): boolean {
    return this.dateRange.overlaps(range);
  }
}
