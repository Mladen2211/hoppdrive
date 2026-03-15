import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import {
  validate,
  createVehicleSchema,
  updateVehicleSchema,
} from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';

export function vehicleRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);

  // ─── Public Routes ────────────────────────────────────────

  /** GET /api/vehicles – List all available vehicles (public) */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicles = await container.getAllVehicles.execute({ isAvailable: true });
      res.json({
        success: true,
        data: vehicles.map(mapVehicle),
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/vehicles/:id – Get vehicle details (public) */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicle = await container.getVehicleById.execute(req.params.id);
      if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
      }
      res.json({ success: true, data: mapVehicle(vehicle) });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin Routes ─────────────────────────────────────────

  /** GET /api/vehicles/admin/all – List ALL vehicles (admin) */
  router.get('/admin/all', auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicles = await container.getAllVehicles.execute();
      res.json({ success: true, data: vehicles.map(mapVehicle) });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/vehicles – Create vehicle (admin) */
  router.post(
    '/',
    auth,
    validate(createVehicleSchema),
    audit('vehicle', 'create'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vehicle = await container.createVehicle.execute(req.body);
        res.status(201).json({ success: true, data: mapVehicle(vehicle) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/vehicles/:id – Update vehicle (admin) */
  router.patch(
    '/:id',
    auth,
    validate(updateVehicleSchema),
    audit('vehicle', 'update'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vehicle = await container.updateVehicle.execute({
          id: req.params.id,
          ...req.body,
        });
        res.json({ success: true, data: mapVehicle(vehicle) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/vehicles/:id – Delete vehicle (admin) */
  router.delete(
    '/:id',
    auth,
    audit('vehicle', 'delete'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.deleteVehicle.execute(req.params.id);
        res.json({ success: true, data: null, message: 'Vehicle deleted' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

function mapVehicle(v: any) {
  return {
    id: v.id,
    brand: v.brand,
    model: v.model,
    type: v.type,
    year: v.year,
    basePricePerDay: v.basePricePerDay?.amount ?? v.basePricePerDay,
    currency: v.basePricePerDay?.currency ?? 'CHF',
    specs: {
      horsepower: v.specs?.horsepower ?? 0,
      transmission: v.specs?.transmission ?? 'automatic',
      seats: v.specs?.seats ?? 4,
      fuelType: v.specs?.fuelType ?? 'petrol',
      range: v.specs?.range,
    },
    thumbnailUrl: v.thumbnailUrl ?? null,
    images: v.images ?? [],
    isAvailable: v.isAvailable,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}
