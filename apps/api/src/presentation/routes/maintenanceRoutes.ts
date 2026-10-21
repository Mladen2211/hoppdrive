import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, createMaintenanceSchema } from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware, vehicleLabel } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { vehicleLabelById } from '../middleware/auditDescribers';

export function maintenanceRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);

  /**
   * GET /api/maintenance?vehicleId=xxx – List maintenance/decommission periods
   * (fleet or calendar: view — the calendar draws them)
   */
  router.get(
    '/',
    auth,
    access.requireAnyPermission([
      { area: 'fleet', level: 'view' },
      { area: 'calendar', level: 'view' },
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { vehicleId } = req.query;
        const periods = await container.getMaintenance.execute(vehicleId as string | undefined);
        res.json({ success: true, data: periods.map(mapMaintenance) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /api/maintenance – Schedule a maintenance/decommission period (fleet: edit) */
  router.post(
    '/',
    auth,
    access.requirePermission('fleet', 'edit'),
    validate(createMaintenanceSchema),
    audit('maintenance', 'create', async (req) => ({
      vehicle: await vehicleLabelById(container, req.body?.vehicleId),
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      reason: req.body?.reason,
    })),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const period = await container.scheduleMaintenance.execute({
          ...req.body,
          createdBy: req.adminId,
        });
        res.locals.auditResourceId = period.id;
        res.status(201).json({ success: true, data: mapMaintenance(period) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/maintenance/:id – Remove a maintenance/decommission period (fleet: edit) */
  router.delete(
    '/:id',
    auth,
    access.requirePermission('fleet', 'edit'),
    audit('maintenance', 'delete', async (req) => {
      const period = await container.prisma.vehicleMaintenance.findUnique({
        where: { id: req.params.id },
        select: { startDate: true, endDate: true, reason: true, vehicle: { select: { brand: true, model: true } } },
      });
      return period
        ? {
            vehicle: vehicleLabel(period.vehicle),
            startDate: period.startDate,
            endDate: period.endDate,
            reason: period.reason,
          }
        : undefined;
    }),
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
