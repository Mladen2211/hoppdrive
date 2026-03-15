import { PrismaClient, AuditLog as PrismaAuditLog } from '@prisma/client';
import { AuditLog, type IAuditLogRepository } from '../../../domain';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  async save(log: AuditLog): Promise<AuditLog> {
    const row = await this.prisma.auditLog.create({
      data: {
        id: log.id,
        adminId: log.adminId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: log.details,
      },
    });
    return this.toDomain(row);
  }

  async findAll(options?: {
    adminId?: string;
    resource?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const where: Record<string, unknown> = {};

    if (options?.adminId) where.adminId = options.adminId;
    if (options?.resource) where.resource = options.resource;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(row: PrismaAuditLog): AuditLog {
    return AuditLog.create({
      id: row.id,
      adminId: row.adminId,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      details: row.details,
      createdAt: row.createdAt,
    });
  }
}
