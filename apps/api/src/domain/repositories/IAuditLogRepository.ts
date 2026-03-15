import { AuditLog } from '../entities/AuditLog';

export interface IAuditLogRepository {
  save(log: AuditLog): Promise<AuditLog>;
  findAll(options?: {
    adminId?: string;
    resource?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AuditLog[]; total: number }>;
}
