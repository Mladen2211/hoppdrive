import { type IVehicleMaintenanceRepository } from '../../../domain';

export class DeleteMaintenanceUseCase {
  constructor(private maintenanceRepo: IVehicleMaintenanceRepository) {}

  execute(id: string): Promise<void> {
    return this.maintenanceRepo.delete(id);
  }
}
