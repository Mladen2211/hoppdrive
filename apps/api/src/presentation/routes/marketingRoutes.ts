import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { validate, createCampaignSchema, unsubscribeSchema } from '../validators';
import type { CreateCampaignInput } from '../../infrastructure/services/MarketingService';
import { resolveDateInput } from '../helpers/dates';
import { snippet } from '../middleware/auditDescribers';
import type { CustomerFilter } from '../../infrastructure/services/MarketingService';

const unsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

const FILTERS: CustomerFilter[] = ['all', 'eligible', 'consent', 'customers', 'unsubscribed'];

/** Turns the validated request body into the service input (date-only inputs resolved to business days). */
function toCampaignInput(body: any): CreateCampaignInput {
  const code = body.code
    ? {
        ...body.code,
        validFrom: resolveDateInput(body.code.validFrom, 'start'),
        validUntil: resolveDateInput(body.code.validUntil, 'end'),
      }
    : undefined;
  return { subject: body.subject, message: body.message, recipients: body.recipients, codeMode: body.codeMode, code };
}

/**
 * Marketing: customer directory, campaigns and the public unsubscribe.
 *   GET  /api/customers                       directory (marketing: view)
 *   GET  /api/marketing/campaigns             history (marketing: view)
 *   GET  /api/marketing/campaigns/:id         campaign incl. per-recipient status
 *   POST /api/marketing/campaigns/preview     dry run: recipient count + sample code
 *   POST /api/marketing/campaigns             queue a campaign (marketing: edit)
 *   GET  /api/marketing/unsubscribe/:token    PUBLIC: { valid, email (masked), unsubscribed }
 *   POST /api/marketing/unsubscribe           PUBLIC: { token } -> { valid, alreadyUnsubscribed }
 */
export function marketingRoutes(container: Container): { customers: Router; marketing: Router } {
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const marketingArea = access.requirePermission('marketing');
  const service = container.marketingService;

  const customers = Router();
  customers.get('/', auth, marketingArea, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = FILTERS.includes(req.query.filter as CustomerFilter) ? (req.query.filter as CustomerFilter) : 'all';
      const data = await service.listCustomers({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        filter,
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 50,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  const marketing = Router();

  // ─── Public: unsubscribe ──────────────────────────────────────
  marketing.get('/unsubscribe/:token', unsubscribeLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await service.describeToken(req.params.token) });
    } catch (err) {
      next(err);
    }
  });

  marketing.post('/unsubscribe', unsubscribeLimiter, validate(unsubscribeSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.unsubscribe(req.body.token);
      if (!result.valid) {
        res.status(404).json({ success: false, error: 'Link ungültig', code: 'invalid_token' });
        return;
      }
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: campaigns ─────────────────────────────────────────
  marketing.get('/campaigns', auth, marketingArea, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await service.listCampaigns({ page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 20 }),
      });
    } catch (err) {
      next(err);
    }
  });

  marketing.get('/campaigns/:id', auth, marketingArea, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await service.getCampaign(req.params.id) });
    } catch (err) {
      next(err);
    }
  });

  // Registered before POST /campaigns is irrelevant (different path); POST because the body can be large.
  marketing.post(
    '/campaigns/preview',
    auth,
    marketingArea,
    validate(createCampaignSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({ success: true, data: await service.previewCampaign(toCampaignInput(req.body)) });
      } catch (err) {
        next(err);
      }
    },
  );

  marketing.post(
    '/campaigns',
    auth,
    marketingArea,
    validate(createCampaignSchema),
    audit('marketing-campaign', 'create', (req) => ({ subject: snippet(req.body?.subject), codeMode: req.body?.codeMode })),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { campaign, skipped } = await service.createCampaign(toCampaignInput(req.body), req.adminId!);
        setAuditDetails(
          res,
          { recipientCount: campaign.counts.total, skippedCount: skipped.length, codeMode: campaign.codeMode },
          campaign.id,
        );
        res.status(201).json({ success: true, data: { ...campaign, skipped } });
      } catch (err) {
        next(err);
      }
    },
  );

  return { customers, marketing };
}
