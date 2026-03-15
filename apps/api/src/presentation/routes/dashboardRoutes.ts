import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';

export function dashboardRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/dashboard – Get stats (admin) */
  router.get('/', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await container.getDashboardStats.execute();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
