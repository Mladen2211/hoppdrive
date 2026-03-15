import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { AuditLog } from '../../domain';
import type { IAuditLogRepository } from '../../domain';
import type { AuthenticatedRequest } from './authMiddleware';

/**
 * Creates middleware that logs admin actions for FADP compliance.
 */
export function createAuditMiddleware(auditLogRepo: IAuditLogRepository) {
  return (resource: string, action: string) => {
    return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
      // Log after the request proceeds (audit fires on every admin mutation)
      const adminId = req.adminId;
      if (adminId) {
        const resourceId = req.params.id || null;
        try {
          await auditLogRepo.save(
            AuditLog.create({
              id: uuid(),
              adminId,
              action,
              resource,
              resourceId,
              details: JSON.stringify({
                method: req.method,
                path: req.originalUrl,
                body: req.body ? '(redacted)' : null,
              }),
            }),
          );
        } catch (err) {
          console.error('[Audit] Failed to log:', err);
        }
      }
      next();
    };
  };
}
