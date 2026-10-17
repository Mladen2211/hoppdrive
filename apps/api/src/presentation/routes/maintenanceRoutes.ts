import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, createMaintenanceSchema } from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';

export function maintenanceRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);

  /** GET /api/maintenance?vehicleId=xxx – List maintenance/decommission periods (admin) */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId } = req.query;
      const periods = await container.getMaintenance.execute(vehicleId as string | undefined);
      res.json({ success: true, data: periods.map(mapMaintenance) });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/maintenance – Schedule a maintenance/decommission period (admin) */
  router.post(
    '/',
    auth,
    validate(createMaintenanceSchema),
    audit('maintenance', 'create'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const period = await container.scheduleMaintenance.execute({
          ...req.body,
          createdBy: req.adminId,
        });
        res.status(201).json({ success: true, data: mapMaintenance(period) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/maintenance/:id – Remove a maintenance/decommission period (admin) */
  router.delete(
    '/:id',
    auth,
    audit('maintenance', 'delete'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.deleteMaintenance.execute(req.params.id);
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

function mapMaintenance(m: any) {
  return {
    id: m.id,
    vehicleId: m.vehicleId,
    startDate: m.dateRange.startDate,
    endDate: m.dateRange.endDate,
    reason: m.reason,
    notes: m.notes,
    createdBy: m.createdBy,
    createdAt: m.createdAt,
  };
}
