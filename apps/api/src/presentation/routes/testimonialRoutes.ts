import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';

export function testimonialRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/testimonials – Public: list active testimonials */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/testimonials/all – Admin: list ALL testimonials */
  router.get('/all', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.testimonial.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/testimonials – Admin: create testimonial */
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, location, text, rating, avatarUrl, isActive, sortOrder } = req.body;
      if (!name || !text) {
        res.status(400).json({ success: false, error: 'name and text are required' });
        return;
      }
      const row = await container.prisma.testimonial.create({
        data: {
          name,
          location: location || null,
          text,
          rating: rating ?? 5,
          avatarUrl: avatarUrl || null,
          isActive: isActive ?? true,
          sortOrder: sortOrder ?? 0,
        },
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/testimonials/:id – Admin: update testimonial */
  router.patch('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const row = await container.prisma.testimonial.update({
        where: { id },
        data: req.body,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/testimonials/:id – Admin: delete testimonial */
  router.delete('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await container.prisma.testimonial.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
