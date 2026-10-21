import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { Prisma } from '@prisma/client';
import { localizeRow, parseLocale, sanitizeTranslations } from '../../application/i18n/localeMerge';
import { AppError } from '../../application/errors';

/** Fields of a testimonial that can be translated (the name stays as written). */
const TRANSLATABLE = ['text', 'location'] as const;

/** undefined = untouched; null = clear; object = validated translations. Throws a 422 for bad input. */
function parseTranslations(input: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (input === undefined) return undefined;
  const result = sanitizeTranslations(input);
  if ('error' in result) {
    throw new AppError('Validation failed', 422, 'validation_failed', undefined, { translations: [result.error] });
  }
  return result.value === null ? Prisma.JsonNull : (result.value as Prisma.InputJsonValue);
}

export function testimonialRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const contentView = access.requirePermission('content', 'view');
  const contentEdit = access.requirePermission('content', 'edit');

  /** { name } of the testimonial in :id, for the activity log. */
  const describeTestimonial = async (req: Request) => {
    const row = await container.prisma.testimonial.findUnique({
      where: { id: req.params.id },
      select: { name: true },
    });
    return { name: row?.name };
  };

  /** GET /api/testimonials[?locale=de|en|fr|it|hr] – Public: list active testimonials (translated, German as fallback) */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      const locale = parseLocale(req.query.locale);
      res.json({ success: true, data: rows.map((r) => localizeRow(r, locale, TRANSLATABLE)) });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/testimonials/all – Admin: list ALL testimonials (content: view) */
  router.get('/all', auth, contentView, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.testimonial.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/testimonials – Admin: create testimonial (content: edit) */
  router.post(
    '/',
    auth,
    contentEdit,
    audit('testimonial', 'create'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, location, text, rating, avatarUrl, isActive, sortOrder } = req.body;
        if (!name || !text) {
          res.status(400).json({ success: false, error: 'name and text are required' });
          return;
        }
        const translations = parseTranslations(req.body.translations);
        const row = await container.prisma.testimonial.create({
          data: {
            name,
            location: location || null,
            text,
            rating: rating ?? 5,
            avatarUrl: avatarUrl || null,
            isActive: isActive ?? true,
            sortOrder: sortOrder ?? 0,
            ...(translations !== undefined && { translations }),
          },
        });
        setAuditDetails(res, { name: row.name }, row.id);
        res.status(201).json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/testimonials/:id – Admin: update testimonial (content: edit) */
  router.patch(
    '/:id',
    auth,
    contentEdit,
    audit('testimonial', 'update', describeTestimonial),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        // Whitelist editable fields so system columns (id, createdAt, ...) can never be overwritten.
        const { name, location, text, rating, avatarUrl, isActive, sortOrder } = req.body;
        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (location !== undefined) data.location = location;
        if (text !== undefined) data.text = text;
        if (rating !== undefined) data.rating = rating;
        if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
        if (isActive !== undefined) data.isActive = isActive;
        if (sortOrder !== undefined) data.sortOrder = sortOrder;
        const translations = parseTranslations(req.body.translations);
        if (translations !== undefined) data.translations = translations;

        const row = await container.prisma.testimonial.update({
          where: { id },
          data,
        });
        res.json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/testimonials/:id – Admin: delete testimonial (content: edit) */
  router.delete(
    '/:id',
    auth,
    contentEdit,
    audit('testimonial', 'delete', describeTestimonial),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.prisma.testimonial.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
