import type { IVehicleRepository } from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';

export class DeleteVehicleUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private cacheService: ICacheService,
  ) {}

  async execute(id: string): Promise<void> {
    const vehicle = await this.vehicleRepo.findById(id);
    if (!vehicle) {
      throw new Error(`Vehicle with id ${id} not found`);
    }

    await this.vehicleRepo.delete(id);
    await this.cacheService.deleteByPattern('vehicles:*');
  }
}
