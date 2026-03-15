import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';

export function pricingRoutes(container: Container): Router {
  const router = Router();

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

  return router;
}
