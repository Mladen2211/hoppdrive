import { Vehicle, type IVehicleRepository } from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';

export class GetAllVehiclesUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private cacheService: ICacheService,
  ) {}

  async execute(options?: { isAvailable?: boolean }): Promise<Vehicle[]> {
    const cacheKey = `vehicles:list:${options?.isAvailable ?? 'all'}`;

    // Try cache first
    const cached = await this.cacheService.get<Vehicle[]>(cacheKey);
    if (cached) return cached;

    const vehicles = await this.vehicleRepo.findAll(options);

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, vehicles, 300);

    return vehicles;
  }
}
