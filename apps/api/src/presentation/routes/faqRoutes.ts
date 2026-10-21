import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { snippet } from '../middleware/auditDescribers';
import { Prisma } from '@prisma/client';
import { localizeRow, parseLocale, sanitizeTranslations } from '../../application/i18n/localeMerge';
import { AppError } from '../../application/errors';

/** Fields of a FAQ item that can be translated. */
const TRANSLATABLE = ['question', 'answer'] as const;

/** undefined = untouched; null = clear; object = validated translations. Throws a 422 for bad input. */
function parseTranslations(input: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (input === undefined) return undefined;
  const result = sanitizeTranslations(input);
  if ('error' in result) {
    throw new AppError('Validation failed', 422, 'validation_failed', undefined, { translations: [result.error] });
  }
  return result.value === null ? Prisma.JsonNull : (result.value as Prisma.InputJsonValue);
}

export function faqRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const contentView = access.requirePermission('content', 'view');
  const contentEdit = access.requirePermission('content', 'edit');

  /** { question } of the FAQ item in :id, for the activity log. */
  const describeFaq = async (req: Request) => {
    const row = await container.prisma.faqItem.findUnique({
      where: { id: req.params.id },
      select: { question: true },
    });
    return { question: snippet(row?.question) };
  };

  /** GET /api/faq[?locale=de|en|fr|it|hr] – Public: list active FAQ items (translated, German as fallback) */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.faqItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      const locale = parseLocale(req.query.locale);
      res.json({ success: true, data: rows.map((r) => localizeRow(r, locale, TRANSLATABLE)) });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/faq/all – Admin: list ALL FAQ items (content: view) */
  router.get('/all', auth, contentView, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.faqItem.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/faq – Admin: create FAQ item (content: edit) */
  router.post(
    '/',
    auth,
    contentEdit,
    audit('faq', 'create'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { question, answer, category, isActive, sortOrder } = req.body;
        if (!question || !answer) {
          res.status(400).json({ success: false, error: 'question and answer are required' });
          return;
        }
        const translations = parseTranslations(req.body.translations);
        const row = await container.prisma.faqItem.create({
          data: {
            question,
            answer,
            category: category || 'general',
            isActive: isActive ?? true,
            sortOrder: sortOrder ?? 0,
            ...(translations !== undefined && { translations }),
          },
        });
        setAuditDetails(res, { question: snippet(row.question) }, row.id);
        res.status(201).json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/faq/:id – Admin: update FAQ item (content: edit) */
  router.patch(
    '/:id',
    auth,
    contentEdit,
    audit('faq', 'update', describeFaq),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        // Whitelist allowed fields to prevent overwriting system fields (id, createdAt, etc.)
        const { question, answer, category, isActive, sortOrder } = req.body;
        const data: Record<string, unknown> = {};
        if (question !== undefined) data.question = question;
        if (answer !== undefined) data.answer = answer;
        if (category !== undefined) data.category = category;
        if (isActive !== undefined) data.isActive = isActive;
        if (sortOrder !== undefined) data.sortOrder = sortOrder;
        const translations = parseTranslations(req.body.translations);
        if (translations !== undefined) data.translations = translations;

        const row = await container.prisma.faqItem.update({ where: { id }, data });
        res.json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/faq/:id – Admin: delete FAQ item (content: edit) */
  router.delete(
    '/:id',
    auth,
    contentEdit,
    audit('faq', 'delete', describeFaq),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.prisma.faqItem.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
