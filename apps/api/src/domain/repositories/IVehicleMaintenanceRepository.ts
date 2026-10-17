import { VehicleMaintenance } from '../entities/VehicleMaintenance';
import { DateRange } from '../value-objects/DateRange';

export interface IVehicleMaintenanceRepository {
  findAll(vehicleId?: string): Promise<VehicleMaintenance[]>;
  findOverlapping(vehicleId: string, range: DateRange): Promise<VehicleMaintenance[]>;
  save(maintenance: VehicleMaintenance): Promise<VehicleMaintenance>;
  delete(id: string): Promise<void>;
}
