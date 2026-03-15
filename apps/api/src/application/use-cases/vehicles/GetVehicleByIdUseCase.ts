import { Vehicle, type IVehicleRepository } from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';

export class GetVehicleByIdUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private cacheService: ICacheService,
  ) {}

  async execute(id: string): Promise<Vehicle | null> {
    const cacheKey = `vehicles:detail:${id}`;

    const cached = await this.cacheService.get<Vehicle>(cacheKey);
    if (cached) return cached;

    const vehicle = await this.vehicleRepo.findById(id);
    if (!vehicle) return null;

    await this.cacheService.set(cacheKey, vehicle, 300);

    return vehicle;
  }
}
