import { Router, Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { suggestDamageZone, type DamageView } from '@hoppdrive/shared';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails, vehicleLabel } from '../middleware/auditMiddleware';
import { describeBooking } from '../middleware/auditDescribers';
import {
  validate,
  createDamageSchema,
  updateDamageSchema,
  repairDamageSchema,
  createInspectionSchema,
} from '../validators';
import { AppError } from '../../application/errors';
import { PrivateStorageService } from '../../infrastructure/services/PrivateStorageService';
import { areaLabel, typeLabel, severityLabel } from '../../infrastructure/services/damageText';
import { multiUpload } from '../helpers/uploads';

const MAX_PHOTO_MB = 10;
const MAX_PHOTOS_PER_DAMAGE = 20;
const PHOTO_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif', 'heif']);

const damageInclude = { photos: { orderBy: { createdAt: 'asc' } } } as const;

export function mapDamage(d: any) {
  return {
    id: d.id,
    vehicleId: d.vehicleId,
    view: d.view,
    x: d.x,
    y: d.y,
    zone: d.zone,
    type: d.type,
    severity: d.severity,
    description: d.description,
    status: d.status,
    repairedAt: d.repairedAt ?? null,
    discoveredBookingId: d.discoveredBookingId ?? null,
    reportedById: d.reportedById,
    photos: (d.photos ?? []).map((p: any) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      url: `/damages/photos/${p.id}`,
      createdAt: p.createdAt,
    })),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/**
 * Vehicle damages (diagram pins + photos) and the pick-up / return inspections of bookings with their PDF report.
 * Permission: damages (GET = view, everything else = edit). Mounted at /api, the paths are absolute:
 *
 *   GET    /vehicles/:vehicleId/damages?status=OPEN|REPAIRED|all   (default: all)
 *   POST   /vehicles/:vehicleId/damages                            { view, x, y, zone?, type?, severity?, description? }
 *   PATCH  /vehicles/:vehicleId/damages/:id                        any subset; status REPAIRED sets repairedAt
 *   POST   /vehicles/:vehicleId/damages/:id/repair                 { repairedAt? }
 *   DELETE /vehicles/:vehicleId/damages/:id
 *   POST   /damages/:id/photos                                     multipart, any field name, <= 10 files of <= 10 MB
 *   DELETE /damages/:id/photos/:photoId
 *   GET    /damages/photos/:photoId                                image/jpeg; Bearer header OR ?token=<access token> (<img src>)
 *   GET    /bookings/:id/inspections
 *   POST   /bookings/:id/inspections                               { type, at?, mileage?, fuelLevel?, notes?, newDamageIds? }
 *   GET    /inspections/:id/report.pdf[?inline=1]
 */
export function damageRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const damages = access.requirePermission('damages');
  const prisma = container.prisma;
  const storage = container.privateStorage;

  /** Bearer header, or ?token= for <img src> (like the SSE route). */
  const authHeaderOrQuery = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.substring(7) : typeof req.query.token === 'string' ? req.query.token : '';
    const payload = token ? container.tokenService.verifyAccessToken(token) : null;
    if (!payload) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }
    req.adminId = payload.adminId;
    next();
  };

  const vehicleOr404 = async (vehicleId: string) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, brand: true, model: true, licensePlate: true } });
    if (!vehicle) throw new AppError('Vehicle not found', 404);
    return vehicle;
  };

  const damageOr404 = async (id: string, vehicleId?: string) => {
    const damage = await prisma.vehicleDamage.findUnique({ where: { id }, include: damageInclude });
    if (!damage || (vehicleId && damage.vehicleId !== vehicleId)) throw new AppError('Damage not found', 404);
    return damage;
  };

  /** { vehicle, zone, type } for the activity log. */
  const describeDamage = async (req: Request) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.vehicleId ?? '' }, select: { brand: true, model: true } });
    const damage = req.params.id ? await prisma.vehicleDamage.findUnique({ where: { id: req.params.id }, select: { zone: true, view: true, type: true, severity: true } }) : null;
    return {
      vehicle: vehicleLabel(vehicle),
      damage: damage ? `${typeLabel(damage.type)} – ${areaLabel(damage)}` : undefined,
    };
  };
  /** For /damages/:id/* routes (no vehicleId in the path). */
  const describeDamageById = async (req: Request) => {
    const damage = await prisma.vehicleDamage.findUnique({
      where: { id: req.params.id },
      select: { zone: true, view: true, type: true, vehicle: { select: { brand: true, model: true } } },
    });
    return damage ? { vehicle: vehicleLabel(damage.vehicle), damage: `${typeLabel(damage.type)} – ${areaLabel(damage)}` } : {};
  };

  /* ──────────────────────────────────────────────────────────── *
   *  Damages                                                     *
   * ──────────────────────────────────────────────────────────── */

  router.get('/vehicles/:vehicleId/damages', auth, damages, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await vehicleOr404(req.params.vehicleId);
      const status = req.query.status === 'OPEN' || req.query.status === 'REPAIRED' ? req.query.status : undefined;
      const rows = await prisma.vehicleDamage.findMany({
        where: { vehicleId: req.params.vehicleId, ...(status ? { status } : {}) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: damageInclude,
      });
      res.json({ success: true, data: rows.map(mapDamage) });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/vehicles/:vehicleId/damages',
    auth,
    damages,
    validate(createDamageSchema),
    audit('vehicle-damage', 'create', describeDamage),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const vehicle = await vehicleOr404(req.params.vehicleId);
        const b = req.body;
        if (b.discoveredBookingId) {
          const booking = await prisma.booking.findUnique({ where: { id: b.discoveredBookingId }, select: { vehicleId: true } });
          if (!booking || booking.vehicleId !== vehicle.id) {
            throw new AppError('Die Buchung gehört nicht zu diesem Fahrzeug.', 422, 'invalid_booking', undefined, { discoveredBookingId: ['Buchung passt nicht zum Fahrzeug'] });
          }
        }
        const created = await prisma.vehicleDamage.create({
          data: {
            vehicleId: vehicle.id,
            view: b.view,
            x: b.x,
            y: b.y,
            zone: b.zone?.trim() || suggestDamageZone(b.view as DamageView, b.x, b.y),
            type: b.type ?? 'SONSTIGES',
            severity: b.severity ?? 'minor',
            description: b.description ?? '',
            discoveredBookingId: b.discoveredBookingId ?? null,
            reportedById: req.adminId!,
          },
          include: damageInclude,
        });
        setAuditDetails(
          res,
          { damage: `${typeLabel(created.type)} – ${areaLabel(created)}`, severity: severityLabel(created.severity) },
          created.id,
        );
        res.status(201).json({ success: true, data: mapDamage(created) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/vehicles/:vehicleId/damages/:id',
    auth,
    damages,
    validate(updateDamageSchema),
    audit('vehicle-damage', 'update', describeDamage),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await damageOr404(req.params.id, req.params.vehicleId);
        const b = req.body;
        if (b.discoveredBookingId) {
          const booking = await prisma.booking.findUnique({ where: { id: b.discoveredBookingId }, select: { vehicleId: true } });
          if (!booking || booking.vehicleId !== existing.vehicleId) {
            throw new AppError('Die Buchung gehört nicht zu diesem Fahrzeug.', 422, 'invalid_booking');
          }
        }
        const data: Record<string, unknown> = {};
        for (const key of ['view', 'x', 'y', 'type', 'severity', 'description', 'discoveredBookingId'] as const) {
          if (b[key] !== undefined) data[key] = b[key];
        }
        if (b.zone !== undefined) data.zone = b.zone.trim() || suggestDamageZone((b.view ?? existing.view) as DamageView, b.x ?? existing.x, b.y ?? existing.y);
        if (b.status === 'REPAIRED' && existing.status !== 'REPAIRED') {
          data.status = 'REPAIRED';
          data.repairedAt = new Date();
        } else if (b.status === 'OPEN' && existing.status !== 'OPEN') {
          data.status = 'OPEN';
          data.repairedAt = null;
        }
        const updated = await prisma.vehicleDamage.update({ where: { id: existing.id }, data, include: damageInclude });
        setAuditDetails(res, { fields: Object.keys(b), status: updated.status });
        res.json({ success: true, data: mapDamage(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/vehicles/:vehicleId/damages/:id/repair',
    auth,
    damages,
    validate(repairDamageSchema),
    audit('vehicle-damage', 'repair', describeDamage),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await damageOr404(req.params.id, req.params.vehicleId);
        const updated = await prisma.vehicleDamage.update({
          where: { id: existing.id },
          data: { status: 'REPAIRED', repairedAt: req.body.repairedAt ? new Date(req.body.repairedAt) : (existing.repairedAt ?? new Date()) },
          include: damageInclude,
        });
        res.json({ success: true, data: mapDamage(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/vehicles/:vehicleId/damages/:id',
    auth,
    damages,
    audit('vehicle-damage', 'delete', describeDamage),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await damageOr404(req.params.id, req.params.vehicleId);
        await prisma.vehicleDamage.delete({ where: { id: existing.id } });
        await storage.deletePrefix(`damages/${existing.id}`).catch(() => undefined);
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  /* ──────────────────────────────────────────────────────────── *
   *  Photos                                                      *
   * ──────────────────────────────────────────────────────────── */

  router.post(
    '/damages/:id/photos',
    auth,
    damages,
    multiUpload({ maxMb: MAX_PHOTO_MB, maxFiles: 10 }),
    audit('vehicle-damage', 'upload-photo', describeDamageById),
    async (req: Request, res: Response, next: NextFunction) => {
      const savedKeys: string[] = [];
      try {
        const damage = await damageOr404(req.params.id);
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (files.length === 0) throw new AppError('Bitte mindestens ein Foto auswählen.', 400, 'file_required');
        if (damage.photos.length + files.length > MAX_PHOTOS_PER_DAMAGE) {
          throw new AppError(`Pro Schaden sind höchstens ${MAX_PHOTOS_PER_DAMAGE} Fotos möglich.`, 422, 'too_many_photos');
        }

        const rows: { id: string; damageId: string; storageKey: string; width: number; height: number }[] = [];
        for (const file of files) {
          let processed: { data: Buffer; info: sharp.OutputInfo };
          try {
            const meta = await sharp(file.buffer).metadata();
            if (!meta.format || !PHOTO_FORMATS.has(meta.format)) throw new Error('format');
            processed = await sharp(file.buffer)
              .rotate()
              .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
              .flatten({ background: '#ffffff' })
              .jpeg({ quality: 80 })
              .toBuffer({ resolveWithObject: true });
          } catch {
            throw new AppError(`„${file.originalname}“ ist kein gültiges Bild (JPG, PNG oder WebP).`, 415, 'unsupported_image');
          }
          const key = PrivateStorageService.keys.damagePhoto(damage.id);
          await storage.save(key, processed.data);
          savedKeys.push(key);
          rows.push({ id: uuid(), damageId: damage.id, storageKey: key, width: processed.info.width, height: processed.info.height });
        }
        await prisma.vehicleDamagePhoto.createMany({ data: rows });

        setAuditDetails(res, { photos: rows.length });
        const fresh = await damageOr404(damage.id);
        res.status(201).json({ success: true, data: mapDamage(fresh) });
      } catch (err) {
        // A failed upload leaves no orphan files behind.
        await Promise.all(savedKeys.map((k) => storage.delete(k).catch(() => undefined)));
        next(err);
      }
    },
  );

  router.delete(
    '/damages/:id/photos/:photoId',
    auth,
    damages,
    audit('vehicle-damage', 'delete-photo', describeDamageById),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const photo = await prisma.vehicleDamagePhoto.findUnique({ where: { id: req.params.photoId } });
        if (!photo || photo.damageId !== req.params.id) throw new AppError('Photo not found', 404);
        await prisma.vehicleDamagePhoto.delete({ where: { id: photo.id } });
        await storage.delete(photo.storageKey).catch(() => undefined);
        res.json({ success: true, data: mapDamage(await damageOr404(req.params.id)) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/damages/photos/:photoId', authHeaderOrQuery, damages, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const photo = await prisma.vehicleDamagePhoto.findUnique({ where: { id: req.params.photoId } });
      if (!photo) {
        res.status(404).json({ success: false, error: 'Photo not found' });
        return;
      }
      await storage.sendFile(res, photo.storageKey, { filename: `Schaden-${photo.id.substring(0, 8)}.jpg`, contentType: 'image/jpeg', inline: true });
    } catch (err) {
      next(err);
    }
  });

  /* ──────────────────────────────────────────────────────────── *
   *  Inspections                                                 *
   * ──────────────────────────────────────────────────────────── */

  const inspectionInclude = { createdBy: { select: { name: true } } } as const;

  /** Damages found during this booking (return inspections) among the snapshot. */
  const mapInspection = (i: any, discoveredIds: Set<string>) => {
    const snapshot: string[] = Array.isArray(i.damageIds) ? i.damageIds : [];
    return {
      id: i.id,
      bookingId: i.bookingId,
      type: i.type,
      at: i.at,
      mileage: i.mileage ?? null,
      fuelLevel: i.fuelLevel ?? null,
      notes: i.notes,
      damageIds: snapshot,
      newDamageIds: i.type === 'RETURN' ? snapshot.filter((id) => discoveredIds.has(id)) : [],
      hasReport: !!i.reportStorageKey,
      createdById: i.createdById ?? null,
      createdByName: i.createdBy?.name ?? null,
      createdAt: i.createdAt,
    };
  };
  const discoveredFor = async (bookingId: string) =>
    new Set((await prisma.vehicleDamage.findMany({ where: { discoveredBookingId: bookingId }, select: { id: true } })).map((d) => d.id));

  router.get('/bookings/:id/inspections', auth, damages, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!booking) throw new AppError('Booking not found', 404);
      const rows = await prisma.bookingInspection.findMany({
        where: { bookingId: booking.id },
        orderBy: [{ at: 'desc' }, { createdAt: 'desc' }],
        include: inspectionInclude,
      });
      const discovered = await discoveredFor(booking.id);
      res.json({ success: true, data: rows.map((r) => mapInspection(r, discovered)) });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/bookings/:id/inspections',
    auth,
    damages,
    validate(createInspectionSchema),
    audit('inspection', 'create', describeBooking(container, (req) => ({ inspectionType: req.body?.type }))),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      let reportKey: string | null = null;
      try {
        const b = req.body;
        const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
        if (!booking) throw new AppError('Booking not found', 404);

        const newIds: string[] = [...new Set<string>(b.newDamageIds ?? [])];
        if (newIds.length > 0) {
          if (b.type !== 'RETURN') {
            throw new AppError('Neue Schäden können nur bei der Rückgabe-Kontrolle markiert werden.', 422, 'new_damages_return_only');
          }
          const found = await prisma.vehicleDamage.count({ where: { id: { in: newIds }, vehicleId: booking.vehicleId } });
          if (found !== newIds.length) {
            throw new AppError('Ein markierter Schaden gehört nicht zu diesem Fahrzeug.', 422, 'invalid_damage', undefined, { newDamageIds: ['Schaden unbekannt'] });
          }
        }

        const at = b.at ? new Date(b.at) : new Date();
        const open = await prisma.vehicleDamage.findMany({
          where: { vehicleId: booking.vehicleId, status: 'OPEN' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        });

        const signer = await container.contractService.resolveSigner(req.adminId, booking.companySignerId);
        const inspectionId = uuid();
        const pdf = await container.damageReportService.generate({
          company: await container.settingsService.getCompany(),
          type: b.type,
          at,
          mileage: b.mileage ?? null,
          fuelLevel: b.fuelLevel ?? null,
          notes: b.notes ?? '',
          booking: { id: booking.id, customerName: booking.customerName, startDate: booking.startDate, endDate: booking.endDate },
          vehicle: { brand: booking.vehicle.brand, model: booking.vehicle.model, licensePlate: booking.vehicle.licensePlate },
          damages: open.map((d) => ({
            id: d.id,
            view: d.view,
            x: d.x,
            y: d.y,
            zone: d.zone,
            type: d.type,
            severity: d.severity,
            description: d.description,
            createdAt: d.createdAt,
            photoKeys: d.photos.map((p) => p.storageKey),
          })),
          newDamageIds: new Set(newIds),
          companySignatureData: signer.signatureData,
          signerName: signer.name,
        });
        reportKey = PrivateStorageService.keys.inspectionReport(booking.id, inspectionId);
        await storage.save(reportKey, pdf);

        const created = await prisma.$transaction(async (tx) => {
          if (newIds.length > 0) {
            await tx.vehicleDamage.updateMany({ where: { id: { in: newIds } }, data: { discoveredBookingId: booking.id } });
          }
          return tx.bookingInspection.create({
            data: {
              id: inspectionId,
              bookingId: booking.id,
              type: b.type,
              at,
              mileage: b.mileage ?? null,
              fuelLevel: b.fuelLevel ?? null,
              notes: b.notes ?? '',
              damageIds: open.map((d) => d.id),
              reportStorageKey: reportKey,
              createdById: req.adminId!,
            },
            include: inspectionInclude,
          });
        });

        setAuditDetails(res, { damages: open.length, newDamages: newIds.length }, created.id);
        res.status(201).json({ success: true, data: mapInspection(created, await discoveredFor(booking.id)) });
      } catch (err) {
        if (reportKey) await storage.delete(reportKey).catch(() => undefined);
        next(err);
      }
    },
  );

  router.get('/inspections/:id/report.pdf', auth, damages, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inspection = await prisma.bookingInspection.findUnique({ where: { id: req.params.id } });
      if (!inspection || !inspection.reportStorageKey) {
        res.status(404).json({ success: false, error: 'Report not found' });
        return;
      }
      const ref = inspection.bookingId.substring(0, 8).toUpperCase();
      await storage.sendFile(res, inspection.reportStorageKey, {
        filename: `HoppDrive-Fahrzeugkontrolle-${inspection.type === 'PICKUP' ? 'Uebergabe' : 'Rueckgabe'}-${ref}.pdf`,
        contentType: 'application/pdf',
        inline: req.query.inline === '1' || req.query.inline === 'true',
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
