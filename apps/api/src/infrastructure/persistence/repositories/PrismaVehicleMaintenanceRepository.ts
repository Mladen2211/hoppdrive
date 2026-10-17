import { PrismaClient, VehicleMaintenance as PrismaVehicleMaintenance } from '@prisma/client';
import {
  VehicleMaintenance,
  DateRange,
  type IVehicleMaintenanceRepository,
  type MaintenanceReason,
} from '../../../domain';

export class PrismaVehicleMaintenanceRepository implements IVehicleMaintenanceRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(vehicleId?: string): Promise<VehicleMaintenance[]> {
    const rows = await this.prisma.vehicleMaintenance.findMany({
      where: vehicleId ? { vehicleId } : undefined,
      orderBy: { startDate: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findOverlapping(vehicleId: string, range: DateRange): Promise<VehicleMaintenance[]> {
    const rows = await this.prisma.vehicleMaintenance.findMany({
      where: {
        vehicleId,
        startDate: { lt: range.endDate },
        endDate: { gt: range.startDate },
      },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(maintenance: VehicleMaintenance): Promise<VehicleMaintenance> {
    const row = await this.prisma.vehicleMaintenance.create({
      data: {
        id: maintenance.id,
        vehicleId: maintenance.vehicleId,
        startDate: maintenance.dateRange.startDate,
        endDate: maintenance.dateRange.endDate,
        reason: maintenance.reason,
        notes: maintenance.notes,
        createdBy: maintenance.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicleMaintenance.delete({ where: { id } });
  }

  private toDomain(row: PrismaVehicleMaintenance): VehicleMaintenance {
    return VehicleMaintenance.create({
      id: row.id,
      vehicleId: row.vehicleId,
      dateRange: DateRange.create(row.startDate, row.endDate),
      reason: row.reason as MaintenanceReason,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
