import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

export function dashboardRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);

  /** GET /api/dashboard – Get stats (any authenticated role) */
  router.get('/', auth, access.requireAnyRole(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await container.getDashboardStats.execute();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
