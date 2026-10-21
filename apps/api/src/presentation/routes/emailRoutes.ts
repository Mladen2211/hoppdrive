import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import type { EmailMessage, Prisma } from '@prisma/client';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { validate, sendTestEmailSchema } from '../validators';
import { EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATES, isSensitiveTemplate } from '../../infrastructure/email/templates';
import { AppError } from '../../application/errors';

const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many test mails. Please wait a minute.' },
});

/**
 * E-mail log and settings (permission area: websiteSettings, i.e. ADMIN).
 *   GET  /api/email/status                provider, configured, queue counts
 *   GET  /api/email/messages              log (?status=&template=&q=&page=&pageSize=)
 *   GET  /api/email/messages/:id          one message incl. its HTML (preview)
 *   POST /api/email/messages/:id/resend   retry a FAILED / QUEUED message, or send a SENT one again
 *   POST /api/email/test { to }           sends a test mail right now
 */
export function emailRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const settings = access.requirePermission('websiteSettings');
  const prisma = container.prisma;

  router.get('/status', auth, settings, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await container.emailService.getStatus();
      res.json({
        success: true,
        data: {
          ...status,
          workerRunning: container.emailWorker.isRunning,
          templates: EMAIL_TEMPLATE_KEYS.map((key) => ({ key, label: EMAIL_TEMPLATES[key].label })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/messages', auth, settings, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
      const where: Prisma.EmailMessageWhereInput = {};
      const status = String(req.query.status ?? '').toUpperCase();
      if (['QUEUED', 'SENT', 'FAILED'].includes(status)) where.status = status as EmailMessage['status'];
      if (typeof req.query.template === 'string' && req.query.template) where.template = req.query.template;
      if (typeof req.query.relatedType === 'string' && req.query.relatedType) where.relatedType = req.query.relatedType;
      if (typeof req.query.relatedId === 'string' && req.query.relatedId) where.relatedId = req.query.relatedId;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        where.OR = [
          { to: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { error: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.emailMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          // The (potentially large) HTML is only returned by GET /messages/:id
          select: {
            id: true, to: true, toName: true, subject: true, template: true, attachments: true, status: true,
            attempts: true, nextAttemptAt: true, provider: true, providerMessageId: true, error: true,
            relatedType: true, relatedId: true, sentAt: true, createdAt: true, updatedAt: true, html: false,
          },
        }),
        prisma.emailMessage.count({ where }),
      ]);
      res.json({
        success: true,
        data: {
          items: rows.map((r) => mapMessage({ ...r, html: '' })),
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/messages/:id', auth, settings, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await prisma.emailMessage.findUnique({ where: { id: req.params.id } });
      if (!row) throw new AppError('E-Mail nicht gefunden.', 404, 'not_found');
      res.json({ success: true, data: { ...mapMessage(row), html: row.html || null } });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/messages/:id/resend',
    auth,
    settings,
    audit('email', 'resend', async (req) => {
      const row = await prisma.emailMessage.findUnique({
        where: { id: req.params.id },
        select: { to: true, subject: true, template: true },
      });
      return { to: row?.to, subject: row?.subject, template: row?.template };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await container.emailService.resend(req.params.id);
        setAuditDetails(res, { status: result.status });
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/test',
    auth,
    settings,
    testLimiter,
    validate(sendTestEmailSchema),
    audit('email', 'test', (req) => ({ to: req.body?.to })),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const admin = await prisma.admin.findUnique({ where: { id: req.adminId! }, select: { name: true } });
        const result = await container.emailService.sendTest(req.body.to, admin?.name ?? null);
        setAuditDetails(res, { status: result.status });
        res.json({ success: true, data: { ...result, provider: container.emailService.providerName } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

function mapMessage(r: EmailMessage) {
  const attachments = ((r.attachments as unknown as { filename: string }[] | null) ?? []).map((a) => ({
    filename: a.filename,
  }));
  return {
    id: r.id,
    to: r.to,
    toName: r.toName,
    subject: r.subject,
    template: r.template,
    templateLabel: (EMAIL_TEMPLATES as Record<string, { label: string }>)[r.template]?.label ?? r.template,
    status: r.status,
    attempts: r.attempts,
    nextAttemptAt: r.nextAttemptAt,
    provider: r.provider,
    providerMessageId: r.providerMessageId,
    error: r.error,
    related: r.relatedType ? { type: r.relatedType, id: r.relatedId } : null,
    attachments,
    sentAt: r.sentAt,
    createdAt: r.createdAt,
    // Invite / password-reset mails hold one-time links: wiped after sending, not re-sendable.
    resendable: !isSensitiveTemplate(r.template),
  };
}
