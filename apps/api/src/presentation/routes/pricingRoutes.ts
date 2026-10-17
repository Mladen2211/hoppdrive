import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, pricingRuleSchema } from '../validators';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';

export function pricingRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);

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
   * Admin CRUD for the real day-tier discount rules (PricingRule). Previously
   * the only way to change these was editing prisma/seed.ts and re-seeding —
   * the repository (PrismaPricingRuleRepository) already fully implemented
   * save/update/delete, but no route ever called them.
   */

  /** GET /api/pricing/rules – List all discount tiers (admin) */
  router.get('/rules', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = await container.getPricingRules.execute();
      res.json({ success: true, data: rules.map(mapPricingRule) });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/pricing/rules – Create a discount tier (admin) */
  router.post(
    '/rules',
    auth,
    validate(pricingRuleSchema),
    audit('pricing-rule', 'create'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rule = await container.createPricingRule.execute(req.body);
        res.status(201).json({ success: true, data: mapPricingRule(rule) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/pricing/rules/:id – Update a discount tier (admin) */
  router.patch(
    '/rules/:id',
    auth,
    validate(pricingRuleSchema),
    audit('pricing-rule', 'update'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rule = await container.updatePricingRule.execute({
          id: req.params.id,
          ...req.body,
        });
        res.json({ success: true, data: mapPricingRule(rule) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/pricing/rules/:id – Remove a discount tier (admin) */
  router.delete(
    '/rules/:id',
    auth,
    audit('pricing-rule', 'delete'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.deletePricingRule.execute(req.params.id);
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
