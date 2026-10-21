import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, pricingRuleSchema } from '../validators';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

const TIERS_CACHE_KEY = 'pricing:tiers';
const TIERS_CACHE_TTL_SECONDS = 300;

export function pricingRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const settingsEdit = access.requirePermission('websiteSettings', 'edit');

  const invalidateTiers = () => container.cacheService.deleteByPattern('pricing:*');

  /** GET /api/pricing?vehicleId=xxx&days=30 – Calculate price (public) */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId, days } = req.query;
      if (!vehicleId || !days) {
        res.status(400).json({
          success: false,
          error: 'vehicleId and days query parameters are required',
        });
        return;
      }

      const result = await container.calculatePricing.execute({
        vehicleId: vehicleId as string,
        totalDays: Number(days),
      });

      res.json({
        success: true,
        data: {
          baseDaily: result.baseDaily.amount,
          effectiveDaily: result.effectiveDaily.amount,
          totalDays: result.totalDays,
          totalPrice: result.totalPrice.amount,
          discountPercent: result.discountPercent,
          currency: result.totalPrice.currency,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/pricing/tiers – the day-tier discount rules, sorted by fromDay (public).
   * [{ fromDay, toDay|null, discountPercent }] — enough for the website to mirror
   * PricingService (day-by-day, cumulative) without a request per price. Cached 5 min like
   * the vehicle list; invalidated whenever a rule is created, changed or deleted.
   */
  router.get('/tiers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await container.cacheService.get<
        { fromDay: number; toDay: number | null; discountPercent: number }[]
      >(TIERS_CACHE_KEY);
      if (cached) {
        res.json({ success: true, data: cached });
        return;
      }

      const rules = await container.getPricingRules.execute();
      const tiers = rules
        .map((r) => ({
          fromDay: r.fromDay,
          toDay: r.toDay,
          discountPercent: Number(r.discountPercent),
        }))
        .sort((a, b) => a.fromDay - b.fromDay);

      await container.cacheService.set(TIERS_CACHE_KEY, tiers, TIERS_CACHE_TTL_SECONDS);
      res.json({ success: true, data: tiers });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Admin CRUD for the real day-tier discount rules (PricingRule). Previously
   * the only way to change these was editing prisma/seed.ts and re-seeding —
   * the repository (PrismaPricingRuleRepository) already fully implemented
   * save/update/delete, but no route ever called them.
   */

  /** GET /api/pricing/rules – List all discount tiers (any authenticated role, read-only) */
  router.get('/rules', auth, access.requireAnyRole(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = await container.getPricingRules.execute();
      res.json({ success: true, data: rules.map(mapPricingRule) });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/pricing/rules – Create a discount tier (websiteSettings: edit) */
  router.post(
    '/rules',
    auth,
    settingsEdit,
    validate(pricingRuleSchema),
    audit('pricing-rule', 'create', (req) => ({
      fromDay: req.body.fromDay,
      toDay: req.body.toDay,
      discountPercent: req.body.discountPercent,
    })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rule = await container.createPricingRule.execute(req.body);
        await invalidateTiers();
        res.locals.auditResourceId = rule.id;
        res.status(201).json({ success: true, data: mapPricingRule(rule) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/pricing/rules/:id – Update a discount tier (websiteSettings: edit) */
  router.patch(
    '/rules/:id',
    auth,
    settingsEdit,
    validate(pricingRuleSchema),
    audit('pricing-rule', 'update', async (req) => {
      const rules = await container.getPricingRules.execute();
      const before = rules.find((r) => r.id === req.params.id);
      return {
        fromDay: req.body.fromDay,
        toDay: req.body.toDay,
        discountPercent: req.body.discountPercent,
        previous: before
          ? { fromDay: before.fromDay, toDay: before.toDay, discountPercent: Number(before.discountPercent) }
          : undefined,
      };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rule = await container.updatePricingRule.execute({
          id: req.params.id,
          ...req.body,
        });
        await invalidateTiers();
        res.json({ success: true, data: mapPricingRule(rule) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/pricing/rules/:id – Remove a discount tier (websiteSettings: edit) */
  router.delete(
    '/rules/:id',
    auth,
    settingsEdit,
    audit('pricing-rule', 'delete', async (req) => {
      const rules = await container.getPricingRules.execute();
      const before = rules.find((r) => r.id === req.params.id);
      return before
        ? { fromDay: before.fromDay, toDay: before.toDay, discountPercent: Number(before.discountPercent) }
        : undefined;
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.deletePricingRule.execute(req.params.id);
        await invalidateTiers();
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

function mapPricingRule(r: any) {
  return {
    id: r.id,
    fromDay: r.fromDay,
    toDay: r.toDay,
    discountPercent: Number(r.discountPercent),
  };
}
