import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

export function reportRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);

  /**
   * GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD (reports: view)
   *
   * KPIs for the range plus the same range one year earlier, a monthly series, revenue by
   * vehicle category and a per-vehicle table. Cancelled bookings are excluded; revenue is each
   * booking's total prorated by the days that fall inside the range; utilisation is booked
   * vehicle-time / (vehicles x range length). The per-vehicle booking drill-down and the CSV
   * data stay on GET /api/bookings/report.
   */
  router.get(
    '/summary',
    auth,
    access.requirePermission('reports', 'view'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { from, to } = req.query;
        if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) {
          res.status(400).json({ success: false, error: 'from and to query params are required' });
          return;
        }
        const summary = await container.getReportSummary.execute(from, to);
        res.json({ success: true, data: summary });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
