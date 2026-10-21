import {
  Vehicle,
  Money,
  VehicleSpecs,
  type IVehicleRepository,
  type VehicleType,
} from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';
import { AppError } from '../../errors';
import { isValidLicensePlate, normalizeLicensePlate } from '../../../domain/services/LicensePlate';

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
  description?: string | null;
  /** undefined = untouched; '' or null = clear; otherwise stored normalised. */
  licensePlate?: string | null;
  /** undefined = untouched; null = clear all translations. */
  translations?: Record<string, Record<string, unknown>> | null;
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

    let licensePlate: string | null | undefined;
    if (input.licensePlate !== undefined) {
      licensePlate = normalizeLicensePlate(input.licensePlate) || null;
      if (licensePlate) {
        if (!isValidLicensePlate(licensePlate)) {
          throw new AppError('Ungültiges Kennzeichen.', 422, 'invalid_license_plate', undefined, {
            licensePlate: ['Ungültiges Kennzeichen.'],
          });
        }
        const owner = await this.vehicleRepo.findByLicensePlate(licensePlate);
        if (owner && owner.id !== vehicle.id) {
          throw new AppError('Dieses Kennzeichen ist bereits einem Fahrzeug zugeordnet.', 409, 'license_plate_taken');
        }
      }
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
      // undefined = untouched; '' or null = clear
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      licensePlate,
      translations: input.translations,
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
