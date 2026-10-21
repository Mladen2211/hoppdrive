import { v4 as uuid } from 'uuid';
import {
  Vehicle,
  Money,
  VehicleSpecs,
  type IVehicleRepository,
  type VehicleType,
} from '../../../domain';
import type { ICacheService } from '../../interfaces/ICacheService';
import type { ISettingsReader } from '../../interfaces/ISettingsReader';
import { AppError } from '../../errors';
import { isValidLicensePlate, normalizeLicensePlate } from '../../../domain/services/LicensePlate';

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
  description?: string | null;
  /** Free input ("ZH 123 456"); stored normalised. */
  licensePlate?: string | null;
  translations?: Record<string, Record<string, unknown>> | null;
}

export class CreateVehicleUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private cacheService: ICacheService,
    private settings: ISettingsReader,
  ) {}

  async execute(input: CreateVehicleInput): Promise<Vehicle> {
    const licensePlate = normalizeLicensePlate(input.licensePlate) || null;
    if (licensePlate) {
      if (!isValidLicensePlate(licensePlate)) {
        throw new AppError('Ungültiges Kennzeichen.', 422, 'invalid_license_plate', undefined, {
          licensePlate: ['Ungültiges Kennzeichen.'],
        });
      }
      if (await this.vehicleRepo.findByLicensePlate(licensePlate)) {
        throw new AppError('Dieses Kennzeichen ist bereits einem Fahrzeug zugeordnet.', 409, 'license_plate_taken');
      }
    }

    // New vehicles use the currency chosen in Settings → Währung.
    const currency = await this.settings.getCurrencyCode();
    const vehicle = Vehicle.create({
      id: uuid(),
      brand: input.brand,
      model: input.model,
      type: input.type,
      year: input.year,
      basePricePerDay: Money.create(input.basePricePerDay, currency),
      specs: VehicleSpecs.create(input.specs),
      images: [],
      isAvailable: true,
      description: input.description?.trim() || null,
      licensePlate,
      translations: input.translations ?? null,
    });

    const saved = await this.vehicleRepo.save(vehicle);

    // Invalidate vehicle list cache
    await this.cacheService.deleteByPattern('vehicles:*');

    return saved;
  }
}
