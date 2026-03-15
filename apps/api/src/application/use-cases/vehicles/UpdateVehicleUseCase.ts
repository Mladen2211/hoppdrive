import {
  Vehicle,
  Money,
  VehicleSpecs,
  type IVehicleRepository,
  type VehicleType,
} from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';

interface UpdateVehicleInput {
  id: string;
  brand?: string;
  model?: string;
  type?: VehicleType;
  year?: number;
  basePricePerDay?: number;
  specs?: {
    horsepower: number;
    transmission: 'automatic' | 'manual';
    seats: number;
    fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
    range?: string;
  };
  isAvailable?: boolean;
}

export class UpdateVehicleUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private cacheService: ICacheService,
  ) {}

  async execute(input: UpdateVehicleInput): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findById(input.id);
    if (!vehicle) {
      throw new Error(`Vehicle with id ${input.id} not found`);
    }

    vehicle.updateDetails({
      brand: input.brand,
      model: input.model,
      type: input.type,
      year: input.year,
      basePricePerDay: input.basePricePerDay !== undefined
        ? Money.create(input.basePricePerDay)
        : undefined,
      specs: input.specs ? VehicleSpecs.create(input.specs) : undefined,
    });

    if (input.isAvailable !== undefined) {
      input.isAvailable ? vehicle.markAvailable() : vehicle.markUnavailable();
    }

    const updated = await this.vehicleRepo.update(vehicle);

    // Invalidate all vehicle caches
    await this.cacheService.deleteByPattern('vehicles:*');

    return updated;
  }
}
