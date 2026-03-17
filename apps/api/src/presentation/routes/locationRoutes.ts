import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';

export function locationRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/locations – List all locations */
  router.get('/', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const locations = await container.prisma.location.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { bookings: true } },
        },
      });
      res.json({ success: true, data: locations });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/locations/:id – Get single location */
  router.get('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const location = await container.prisma.location.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { bookings: true } } },
      });
      if (!location) {
        res.status(404).json({ success: false, error: 'Location not found' });
        return;
      }
      res.json({ success: true, data: location });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/locations – Create location */
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, address, zip, city, country, phone, email } = req.body;
      if (!name || !address || !zip || !city) {
        res.status(400).json({ success: false, error: 'name, address, zip, city are required' });
        return;
      }
      const location = await container.prisma.location.create({
        data: { name, address, zip, city, country: country || 'CH', phone, email },
      });
      res.status(201).json({ success: true, data: location });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/locations/:id – Update location */
  router.patch('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, address, zip, city, country, phone, email, isActive } = req.body;
      const location = await container.prisma.location.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(address !== undefined && { address }),
          ...(zip !== undefined && { zip }),
          ...(city !== undefined && { city }),
          ...(country !== undefined && { country }),
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json({ success: true, data: location });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/locations/:id – Delete location */
  router.delete('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await container.prisma.location.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
