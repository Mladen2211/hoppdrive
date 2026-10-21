import { Vehicle } from '../entities/Vehicle';

/**
 * Repository interface for Vehicle aggregate.
 * Defined in the domain layer, implemented in infrastructure.
 */
export interface IVehicleRepository {
  findById(id: string): Promise<Vehicle | null>;
  /** Looks a vehicle up by its NORMALISED licence plate. */
  findByLicensePlate(normalisedPlate: string): Promise<Vehicle | null>;
  findAll(options?: { isAvailable?: boolean }): Promise<Vehicle[]>;
  save(vehicle: Vehicle): Promise<Vehicle>;
  update(vehicle: Vehicle): Promise<Vehicle>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}
