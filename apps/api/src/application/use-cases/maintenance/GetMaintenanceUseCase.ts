import { type VehicleMaintenance, type IVehicleMaintenanceRepository } from '../../../domain';

export class GetMaintenanceUseCase {
  constructor(private maintenanceRepo: IVehicleMaintenanceRepository) {}

  execute(vehicleId?: string): Promise<VehicleMaintenance[]> {
    return this.maintenanceRepo.findAll(vehicleId);
  }
}
