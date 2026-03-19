import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';

export function homepageSectionRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/homepage-sections – Public: list active sections (sorted) */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.homepageSection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/homepage-sections/all – Admin: list ALL sections */
  router.get('/all', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.homepageSection.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/homepage-sections/:key – Admin: update a section by sectionKey */
  router.put('/:key', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const { isActive, sortOrder, content } = req.body;

      const existing = await container.prisma.homepageSection.findUnique({
        where: { sectionKey: key },
      });

      if (!existing) {
        // Create if doesn't exist
        const row = await container.prisma.homepageSection.create({
          data: {
            sectionKey: key,
            isActive: isActive ?? true,
            sortOrder: sortOrder ?? 0,
            content: content ?? {},
          },
        });
        res.status(201).json({ success: true, data: row });
        return;
      }

      const updateData: any = {};
      if (isActive !== undefined) updateData.isActive = isActive;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (content !== undefined) updateData.content = content;

      const row = await container.prisma.homepageSection.update({
        where: { sectionKey: key },
        data: updateData,
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/homepage-sections/:key/toggle – Admin: toggle active status */
  router.patch('/:key/toggle', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const existing = await container.prisma.homepageSection.findUnique({
        where: { sectionKey: key },
      });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Section not found' });
        return;
      }
      const row = await container.prisma.homepageSection.update({
        where: { sectionKey: key },
        data: { isActive: !existing.isActive },
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
