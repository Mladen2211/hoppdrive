import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { Container } from '../../infrastructure/config/container';
import {
  validate,
  createVehicleSchema,
  updateVehicleSchema,
} from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware, diffFields, setAuditDetails, vehicleLabel } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { vehicleLabelById } from '../middleware/auditDescribers';
import { parseLocale } from '../../application/i18n/localeMerge';
import { AppError } from '../../application/errors';
import { normalizeLicensePlate } from '../../domain/services/LicensePlate';
import type { AppLocale } from '@hoppdrive/shared';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export function vehicleRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const fleetEdit = access.requirePermission('fleet', 'edit');

  /**
   * Maps vehicles to DTOs incl. the live availableNow flag (never cached, see VehicleAvailabilityService).
   * Public callers pass ?locale= (description is translated, translations are not exposed);
   * admin callers get the raw German description plus the full `translations` blob.
   */
  async function toDtos(vehicles: any[], options: { locale?: AppLocale | null; admin?: boolean } = {}) {
    const busy = await container.vehicleAvailability.findBusyVehicleIds(vehicles.map((v) => v.id));
    return vehicles.map((v) => mapVehicle(v, !busy.has(v.id), options));
  }

  /** Re-numbers sortOrder 0..n-1 and makes sure exactly one image is primary (the first when none is). */
  async function normaliseImages(vehicleId: string) {
    return container.prisma.$transaction(async (tx) => {
      const images = await tx.vehicleImage.findMany({ where: { vehicleId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      const primary = images.find((i) => i.isPrimary) ?? images[0];
      for (let i = 0; i < images.length; i++) {
        const wantPrimary = images[i].id === primary?.id;
        if (images[i].sortOrder !== i || images[i].isPrimary !== wantPrimary) {
          await tx.vehicleImage.update({ where: { id: images[i].id }, data: { sortOrder: i, isPrimary: wantPrimary } });
        }
      }
      return tx.vehicleImage.findMany({ where: { vehicleId }, orderBy: { sortOrder: 'asc' } });
    });
  }

  /** { vehicle: 'Škoda Kodiaq' } of the vehicle in :id, for the activity log. */
  const describeVehicle = async (req: AuthenticatedRequest) => ({
    vehicle: await vehicleLabelById(container, req.params.id),
  });

  // ─── Public Routes ────────────────────────────────────────

  /** GET /api/vehicles – List all available vehicles (public) */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicles = await container.getAllVehicles.execute({ isAvailable: true });
      res.json({
        success: true,
        data: await toDtos(vehicles, { locale: parseLocale(req.query.locale) }),
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
      const [dto] = await toDtos([vehicle], { locale: parseLocale(req.query.locale) });
      res.json({ success: true, data: dto });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin Routes ─────────────────────────────────────────

  /** GET /api/vehicles/admin/all – List ALL vehicles (admin; fleet or calendar view) */
  router.get(
    '/admin/all',
    auth,
    access.requireAnyPermission([
      { area: 'fleet', level: 'view' },
      { area: 'calendar', level: 'view' },
    ]),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const vehicles = await container.getAllVehicles.execute();
        res.json({ success: true, data: await toDtos(vehicles, { admin: true }) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /api/vehicles – Create vehicle (admin) */
  router.post(
    '/',
    auth,
    fleetEdit,
    validate(createVehicleSchema),
    audit('vehicle', 'create'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vehicle = await container.createVehicle.execute(req.body);
        setAuditDetails(res, { vehicle: vehicleLabel(vehicle), licensePlate: vehicle.licensePlate ?? undefined }, vehicle.id);
        const [dto] = await toDtos([vehicle], { admin: true });
        res.status(201).json({ success: true, data: dto });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/vehicles/:id – Update vehicle (admin) */
  router.patch(
    '/:id',
    auth,
    fleetEdit,
    validate(updateVehicleSchema),
    // Logs what changed, e.g. { vehicle:'Škoda Kodiaq', changes:[{field:'basePricePerDay', from:79, to:89}] }
    audit('vehicle', 'update', async (req) => {
      const before = await container.prisma.vehicle.findUnique({ where: { id: req.params.id } });
      if (!before) return undefined;
      const body = req.body ?? {};
      const specs = body.specs ?? {};
      const changes = diffFields(before as unknown as Record<string, unknown>, {
        brand: body.brand,
        model: body.model,
        type: body.type,
        year: body.year,
        basePricePerDay: body.basePricePerDay,
        description: body.description === undefined ? undefined : (body.description?.trim() || null),
        licensePlate: body.licensePlate === undefined ? undefined : (normalizeLicensePlate(body.licensePlate) || null),
        isAvailable: body.isAvailable,
        horsepower: specs.horsepower,
        transmission: specs.transmission,
        seats: specs.seats,
        fuelType: specs.fuelType,
        range: specs.range,
      });
      return {
        vehicle: vehicleLabel(before),
        changes,
        ...(body.translations !== undefined ? { translationsChanged: true } : {}),
      };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vehicle = await container.updateVehicle.execute({
          id: req.params.id,
          ...req.body,
        });
        const [dto] = await toDtos([vehicle], { admin: true });
        res.json({ success: true, data: dto });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/vehicles/:id – Delete vehicle (admin) */
  router.delete(
    '/:id',
    auth,
    fleetEdit,
    audit('vehicle', 'delete', describeVehicle),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // The damage rows go with the vehicle (cascade): remember them to remove their private photo files afterwards.
        const damageIds = (
          await container.prisma.vehicleDamage.findMany({ where: { vehicleId: req.params.id }, select: { id: true } })
        ).map((d) => d.id);
        await container.deleteVehicle.execute(req.params.id);
        await Promise.all(damageIds.map((id) => container.privateStorage.deletePrefix(`damages/${id}`).catch(() => undefined)));
        res.json({ success: true, data: null, message: 'Vehicle deleted' });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/vehicles/:id/images – Upload a vehicle image (admin, multipart field `image`).
   * The first image of a vehicle becomes the primary one.
   */
  router.post(
    '/:id/images',
    auth,
    fleetEdit,
    upload.single('image'),
    audit('vehicle', 'upload-image', describeVehicle),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!req.file) {
          res.status(400).json({ success: false, error: 'No image file provided' });
          return;
        }

        const vehicle = await container.prisma.vehicle.findUnique({ where: { id } });
        if (!vehicle) {
          res.status(404).json({ success: false, error: 'Vehicle not found' });
          return;
        }

        const { url } = await container.imageService.processAndSave(req.file.buffer, req.file.originalname);
        const existingCount = await container.prisma.vehicleImage.count({ where: { vehicleId: id } });

        const image = await container.prisma.vehicleImage.create({
          data: {
            vehicleId: id,
            url,
            alt: `${vehicle.brand} ${vehicle.model}`,
            sortOrder: existingCount,
            isPrimary: existingCount === 0,
          },
        });
        await container.cacheService.deleteByPattern('vehicles:*');

        res.status(201).json({ success: true, data: image });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /api/vehicles/:id/images/:imageId/primary – Make this the main image ("Hauptbild").
   * Runs in one transaction, so exactly one image of the vehicle is primary afterwards.
   * Responds with the vehicle's images (sorted).
   */
  router.patch(
    '/:id/images/:imageId/primary',
    auth,
    fleetEdit,
    audit('vehicle', 'set-primary-image', describeVehicle),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id, imageId } = req.params;
        const image = await container.prisma.vehicleImage.findUnique({ where: { id: imageId } });
        if (!image || image.vehicleId !== id) {
          res.status(404).json({ success: false, error: 'Image not found' });
          return;
        }
        await container.prisma.$transaction([
          container.prisma.vehicleImage.updateMany({ where: { vehicleId: id, NOT: { id: imageId } }, data: { isPrimary: false } }),
          container.prisma.vehicleImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
        ]);
        await container.cacheService.deleteByPattern('vehicles:*');
        const images = await container.prisma.vehicleImage.findMany({ where: { vehicleId: id }, orderBy: { sortOrder: 'asc' } });
        res.json({ success: true, data: images });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PUT /api/vehicles/:id/images/order { imageIds: string[] } – Set the display order.
   * `imageIds` must list every image of the vehicle exactly once (first = shown first).
   * The primary image is not changed. Responds with the vehicle's images (sorted).
   */
  router.put(
    '/:id/images/order',
    auth,
    fleetEdit,
    audit('vehicle', 'reorder-images', describeVehicle),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const imageIds: unknown = req.body?.imageIds;
        if (!Array.isArray(imageIds) || imageIds.some((v) => typeof v !== 'string')) {
          throw new AppError('imageIds must be an array of image ids', 422, 'validation_failed', undefined, {
            imageIds: ['imageIds must be an array of image ids'],
          });
        }
        const existing = await container.prisma.vehicleImage.findMany({ where: { vehicleId: id }, select: { id: true } });
        const sameSet =
          imageIds.length === existing.length &&
          new Set(imageIds).size === imageIds.length &&
          existing.every((e) => (imageIds as string[]).includes(e.id));
        if (!sameSet) {
          throw new AppError('imageIds must contain every image of the vehicle exactly once', 422, 'validation_failed', undefined, {
            imageIds: ['imageIds must contain every image of the vehicle exactly once'],
          });
        }
        await container.prisma.$transaction(
          (imageIds as string[]).map((imageId, index) =>
            container.prisma.vehicleImage.update({ where: { id: imageId }, data: { sortOrder: index } }),
          ),
        );
        await container.cacheService.deleteByPattern('vehicles:*');
        const images = await container.prisma.vehicleImage.findMany({ where: { vehicleId: id }, orderBy: { sortOrder: 'asc' } });
        res.json({ success: true, data: images });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /api/vehicles/:id/images/:imageId – Remove a vehicle image (admin).
   * Deleting the primary image promotes the next one (by order) to primary.
   */
  router.delete(
    '/:id/images/:imageId',
    auth,
    fleetEdit,
    audit('vehicle', 'delete-image', describeVehicle),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id, imageId } = req.params;
        const image = await container.prisma.vehicleImage.findUnique({ where: { id: imageId } });
        if (!image || image.vehicleId !== id) {
          res.status(404).json({ success: false, error: 'Image not found' });
          return;
        }

        await container.imageService.delete(image.url);
        await container.prisma.vehicleImage.delete({ where: { id: imageId } });
        // Closes the gap in the order and promotes the next image when the primary one was removed.
        await normaliseImages(id);
        await container.cacheService.deleteByPattern('vehicles:*');

        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

function mapVehicle(v: any, availableNow: boolean, options: { locale?: AppLocale | null; admin?: boolean } = {}) {
  const images: any[] = [...(v.images ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const primary = images.find((i) => i.isPrimary) ?? images[0];

  // Public output: the description in the requested language (German when missing).
  let description: string | null = v.description ?? null;
  if (!options.admin && options.locale && options.locale !== 'de') {
    const translated = v.translations?.[options.locale]?.description;
    if (typeof translated === 'string' && translated.trim()) description = translated;
  }

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
    // Main image first (also correct for cached vehicles, where the entity getter is gone)
    thumbnailUrl: primary?.url ?? null,
    images,
    description,
    /** Normalised plate (e.g. ZH123456). */
    licensePlate: v.licensePlate ?? null,
    isAvailable: v.isAvailable,
    availableNow,
    ...(options.admin ? { translations: v.translations ?? null } : {}),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}
