import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';

export function faqRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/faq – Public: list active FAQ items */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.faqItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/faq/all – Admin: list ALL FAQ items */
  router.get('/all', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.faqItem.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/faq – Admin: create FAQ item */
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, answer, category, isActive, sortOrder } = req.body;
      if (!question || !answer) {
        res.status(400).json({ success: false, error: 'question and answer are required' });
        return;
      }
      const row = await container.prisma.faqItem.create({
        data: {
          question,
          answer,
          category: category || 'general',
          isActive: isActive ?? true,
          sortOrder: sortOrder ?? 0,
        },
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/faq/:id – Admin: update FAQ item */
  router.patch('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const row = await container.prisma.faqItem.update({
        where: { id },
        data: req.body,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /api/faq/:id – Admin: delete FAQ item */
  router.delete('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await container.prisma.faqItem.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
