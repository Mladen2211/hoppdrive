import { PrismaClient, Vehicle as PrismaVehicle, VehicleImage as PrismaImage } from '@prisma/client';
import {
  Vehicle,
  Money,
  VehicleSpecs,
  type IVehicleRepository,
  type VehicleImage,
} from '../../../domain';

type VehicleWithImages = PrismaVehicle & { images: PrismaImage[] };

export class PrismaVehicleRepository implements IVehicleRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(options?: { isAvailable?: boolean }): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: options?.isAvailable !== undefined ? { isAvailable: options.isAvailable } : undefined,
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(vehicle: Vehicle): Promise<Vehicle> {
    const row = await this.prisma.vehicle.create({
      data: {
        id: vehicle.id,
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        year: vehicle.year,
        basePricePerDay: vehicle.basePricePerDay.amount,
        currency: vehicle.basePricePerDay.currency,
        horsepower: vehicle.specs.horsepower,
        transmission: vehicle.specs.transmission,
        seats: vehicle.specs.seats,
        fuelType: vehicle.specs.fuelType,
        range: vehicle.specs.range,
        isAvailable: vehicle.isAvailable,
        images: {
          create: vehicle.images.map((img) => ({
            id: img.id,
            url: img.url,
            alt: img.alt,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        },
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toDomain(row);
  }

  async update(vehicle: Vehicle): Promise<Vehicle> {
    const row = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        year: vehicle.year,
        basePricePerDay: vehicle.basePricePerDay.amount,
        currency: vehicle.basePricePerDay.currency,
        horsepower: vehicle.specs.horsepower,
        transmission: vehicle.specs.transmission,
        seats: vehicle.specs.seats,
        fuelType: vehicle.specs.fuelType,
        range: vehicle.specs.range,
        isAvailable: vehicle.isAvailable,
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return this.prisma.vehicle.count();
  }

  private toDomain(row: VehicleWithImages): Vehicle {
    return Vehicle.create({
      id: row.id,
      brand: row.brand,
      model: row.model,
      type: row.type as Vehicle['type'],
      year: row.year,
      basePricePerDay: Money.create(Number(row.basePricePerDay), row.currency),
      specs: VehicleSpecs.create({
        horsepower: row.horsepower,
        transmission: row.transmission as 'automatic' | 'manual',
        seats: row.seats,
        fuelType: row.fuelType as 'petrol' | 'diesel' | 'electric' | 'hybrid',
        range: row.range ?? undefined,
      }),
      images: row.images.map(
        (img): VehicleImage => ({
          id: img.id,
          url: img.url,
          alt: img.alt,
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary,
        }),
      ),
      isAvailable: row.isAvailable,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
