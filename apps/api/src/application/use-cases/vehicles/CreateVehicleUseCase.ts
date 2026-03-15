import { v4 as uuid } from 'uuid';
import {
  Vehicle,
  Money,
  VehicleSpecs,
  type IVehicleRepository,
  type VehicleType,
} from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';

interface CreateVehicleInput {
  brand: string;
  model: string;
  type: VehicleType;
  year: number;
  basePricePerDay: number;
  specs: {
    horsepower: number;
    transmission: 'automatic' | 'manual';
    seats: number;
    fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
    range?: string;
  };
}

export class CreateVehicleUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private cacheService: ICacheService,
  ) {}

  async execute(input: CreateVehicleInput): Promise<Vehicle> {
    const vehicle = Vehicle.create({
      id: uuid(),
      brand: input.brand,
      model: input.model,
      type: input.type,
      year: input.year,
      basePricePerDay: Money.create(input.basePricePerDay),
      specs: VehicleSpecs.create(input.specs),
      images: [],
      isAvailable: true,
    });

    const saved = await this.vehicleRepo.save(vehicle);

    // Invalidate vehicle list cache
    await this.cacheService.deleteByPattern('vehicles:*');

    return saved;
  }
}
