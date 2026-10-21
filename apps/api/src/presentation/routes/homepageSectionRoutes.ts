import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { Prisma } from '@prisma/client';
import { localizeSection, parseLocale, sanitizeTranslations } from '../../application/i18n/localeMerge';
import { AppError } from '../../application/errors';

/** undefined = untouched; null = clear; object = validated translations. Throws a 422 for bad input. */
function parseTranslations(input: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (input === undefined) return undefined;
  const result = sanitizeTranslations(input);
  if ('error' in result) {
    throw new AppError('Validation failed', 422, 'validation_failed', undefined, { translations: [result.error] });
  }
  return result.value === null ? Prisma.JsonNull : (result.value as Prisma.InputJsonValue);
}

export function homepageSectionRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const contentView = access.requirePermission('content', 'view');
  const contentEdit = access.requirePermission('content', 'edit');

  /**
   * GET /api/homepage-sections[?locale=de|en|fr|it|hr] – Public: list active sections (sorted).
   * With a locale, `translations[locale]` is deep-merged over the German `content` (German is the fallback).
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.homepageSection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      const locale = parseLocale(req.query.locale);
      res.json({ success: true, data: rows.map((r) => localizeSection(r, locale)) });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/homepage-sections/all – Admin: list ALL sections (content: view) */
  router.get('/all', auth, contentView, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.homepageSection.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /api/homepage-sections/:key – Admin: update a section by sectionKey (content: edit) */
  router.put(
    '/:key',
    auth,
    contentEdit,
    // The log entry carries the section key (e.g. "hero"), not the content.
    audit('homepage-section', 'update', (req) => ({
      sectionKey: req.params.key,
      ...(req.body?.isActive !== undefined ? { isActive: req.body.isActive } : {}),
      ...(req.body?.content !== undefined ? { contentChanged: true } : {}),
      ...(req.body?.translations !== undefined ? { translationsChanged: true } : {}),
      ...(req.body?.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
    })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;
        const { isActive, sortOrder, content } = req.body;
        const translations = parseTranslations(req.body.translations);

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
              ...(translations !== undefined && { translations }),
            },
          });
          setAuditDetails(res, { created: true }, row.id);
          res.status(201).json({ success: true, data: row });
          return;
        }

        const updateData: any = {};
        if (isActive !== undefined) updateData.isActive = isActive;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
        if (content !== undefined) updateData.content = content;
        if (translations !== undefined) updateData.translations = translations;

        const row = await container.prisma.homepageSection.update({
          where: { sectionKey: key },
          data: updateData,
        });
        setAuditDetails(res, {}, row.id);
        res.json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/homepage-sections/:key/toggle – Admin: toggle active status (content: edit) */
  router.patch(
    '/:key/toggle',
    auth,
    contentEdit,
    audit('homepage-section', 'toggle', (req) => ({ sectionKey: req.params.key })),
    async (req: Request, res: Response, next: NextFunction) => {
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
        setAuditDetails(res, { isActive: row.isActive }, row.id);
        res.json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
