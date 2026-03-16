import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';

export function settingsRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/settings/:key – Public: read a single setting */
  router.get('/:key', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await container.prisma.siteSetting.findUnique({
        where: { key: req.params.key },
      });
      res.json({
        success: true,
        data: row ? row.value : null,
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/settings – Admin: list all settings */
  router.get('/', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.siteSetting.findMany();
      const map: Record<string, any> = {};
      for (const r of rows) {
        map[r.key] = r.value;
      }
      res.json({ success: true, data: map });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/settings/:key – Admin: upsert a setting */
  router.put('/:key', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (value === undefined) {
        res.status(400).json({ success: false, error: 'value is required' });
        return;
      }
      const row = await container.prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      res.json({ success: true, data: row.value });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
