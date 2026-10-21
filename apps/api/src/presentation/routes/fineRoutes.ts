import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import {
  validate,
  createFineSchema,
  updateFineSchema,
  assignFineSchema,
  notifyFineSchema,
  fineInvoiceSchema,
} from '../validators';
import { AppError } from '../../application/errors';
import { TimeUtils } from '../../domain';
import { formatLicensePlate, isValidLicensePlate, normalizeLicensePlate } from '../../domain/services/LicensePlate';
import { PrivateStorageService } from '../../infrastructure/services/PrivateStorageService';
import { InvoiceService, mapInvoice } from '../../infrastructure/services/InvoiceService';
import { fmtDateMaybeTime, hasTimeOfDay } from '../../infrastructure/format';
import { dateOnlyString } from '../helpers/dates';
import { fileNameOf, singleUpload } from '../helpers/uploads';

const MAX_DOCUMENT_MB = 10;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const fineInclude = {
  vehicle: { select: { id: true, brand: true, model: true, licensePlate: true } },
  booking: { select: { id: true, customerName: true, customerEmail: true, startDate: true, endDate: true } },
  invoiceItems: { select: { invoice: { select: { id: true, invoiceNumber: true, status: true, total: true, currency: true, createdAt: true } } } },
} as const satisfies Prisma.FineInclude;
type FineRow = Prisma.FineGetPayload<{ include: typeof fineInclude }>;

export function mapFine(f: FineRow) {
  const seen = new Set<string>();
  const invoices = f.invoiceItems
    .map((i) => i.invoice)
    .filter((inv) => (seen.has(inv.id) ? false : (seen.add(inv.id), true)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((inv) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, total: Number(inv.total), currency: inv.currency }));
  return {
    id: f.id,
    licensePlate: f.licensePlate,
    occurredAt: f.occurredAt,
    place: f.place,
    authority: f.authority,
    reference: f.reference,
    amount: Number(f.amount),
    currency: f.currency,
    description: f.description,
    hasDocument: !!f.documentKey,
    documentName: f.documentKey ? path.basename(f.documentKey) : null,
    vehicleId: f.vehicleId,
    bookingId: f.bookingId,
    status: f.status,
    notes: f.notes,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    vehicle: f.vehicle,
    booking: f.booking,
    invoices,
  };
}

/** Time of the fine: an ISO date-time as is, "YYYY-MM-DD" = that day at 00:00 business time ("time unknown"). */
function parseOccurredAt(value: string): Date {
  const m = DATE_ONLY.exec(value);
  if (m) return TimeUtils.zonedTimeToUtc(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError('Ungültiges Datum.', 422, 'invalid_date', undefined, { at: ['Ungültiges Datum'] });
  return d;
}

/** Detects the real type of an uploaded document by its first bytes (the declared MIME type is not trusted). */
function detectDocumentType(buffer: Buffer): { ext: string; contentType: string } | null {
  if (buffer.subarray(0, 1024).includes('%PDF-')) return { ext: 'pdf', contentType: 'application/pdf' };
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  return null;
}

const contentTypeOfKey = (key: string) =>
  /\.pdf$/i.test(key) ? 'application/pdf' : /\.png$/i.test(key) ? 'image/png' : 'image/jpeg';

/**
 * Fines (Bussen). Permission: fines (GET = view). READONLY has no access (fines hold personal data).
 *
 *   GET    /fines/lookup?plate=&at=          who had the vehicle at that time (see below)
 *   GET    /fines?status=&q=&plate=&bookingId=&page=&pageSize=
 *   POST   /fines                            JSON or multipart (+ optional `document` file)
 *   GET    /fines/:id
 *   PATCH  /fines/:id                        any subset incl. status, bookingId (null = unassign)
 *   DELETE /fines/:id                        409 fine_has_invoice when invoiced
 *   POST   /fines/:id/document               multipart `document` (PDF / JPG / PNG, <= 10 MB), replaces the old one
 *   GET    /fines/:id/document[?inline=1]    authenticated download
 *   DELETE /fines/:id/document
 *   POST   /fines/:id/assign                 { bookingId } -> status ASSIGNED
 *   GET    /fines/:id/driver-export.pdf      Fahrerangaben for the authority (needs an assigned booking)
 *   POST   /fines/:id/notify                 { note? } mails the renter (fine document attached), ASSIGNED -> FORWARDED
 *   POST   /fines/:id/invoice                { feeIds?, sendEmail?, withQrBill?, dueDays?, notes? } FINE invoice, status INVOICED
 *
 * LOOKUP: the plate is normalised and matched to the vehicle. Bookings (not cancelled) whose period contains `at`
 * (start <= at <= end) are the candidates. Legacy bookings stored at exactly 00:00 count as whole days, and an `at`
 * without a time (YYYY-MM-DD or 00:00) means "time unknown": every booking touching that day matches. Candidates carry
 * matchType 'exact' or 'whole_day'. warning: 'no_vehicle' | 'none' (nobody had the car) | 'multiple' | null (exactly one).
 */
export function fineRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const fines = access.requirePermission('fines');
  const prisma = container.prisma;
  const storage = container.privateStorage;

  const fineOr404 = async (id: string): Promise<FineRow> => {
    const fine = await prisma.fine.findUnique({ where: { id }, include: fineInclude });
    if (!fine) throw new AppError('Fine not found', 404);
    return fine;
  };

  const vehicleByPlate = (plate: string) =>
    prisma.vehicle.findUnique({ where: { licensePlate: plate }, select: { id: true, brand: true, model: true, licensePlate: true } });

  const normalisePlate = (input: string): string => {
    const plate = normalizeLicensePlate(input);
    if (!isValidLicensePlate(plate)) {
      throw new AppError('Ungültiges Kontrollschild.', 422, 'invalid_plate', undefined, { licensePlate: ['Ungültiges Kontrollschild'] });
    }
    return plate;
  };

  /** { reference, plate } of the fine in :id for the activity log. */
  const describeFine = async (req: Request) => {
    const f = await prisma.fine.findUnique({ where: { id: req.params.id }, select: { reference: true, licensePlate: true, authority: true, amount: true, currency: true } });
    return {
      fine: f ? [f.reference, formatLicensePlate(f.licensePlate)].filter(Boolean).join(' · ') : undefined,
      authority: f?.authority || undefined,
      amount: f ? Number(f.amount) : undefined,
      currency: f?.currency,
    };
  };

  /* ──────────────────────────────────────────────────────────── *
   *  Lookup: who had the vehicle?                                *
   * ──────────────────────────────────────────────────────────── */

  router.get('/lookup', auth, fines, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (typeof req.query.plate !== 'string' || typeof req.query.at !== 'string') {
        throw new AppError('plate und at (ISO-Datum) sind erforderlich.', 400, 'invalid_query');
      }
      const plate = normalisePlate(req.query.plate);
      const at = parseOccurredAt(req.query.at.trim());
      const dayOnly = DATE_ONLY.test(req.query.at.trim()) || !hasTimeOfDay(at);
      const queryStart = dayOnly ? TimeUtils.startOfDay(at) : at;
      const queryEnd = dayOnly ? TimeUtils.startOfNextDay(at) : at;

      const vehicle = await vehicleByPlate(plate);
      if (!vehicle) {
        res.json({ success: true, data: { plate, at: at.toISOString(), vehicle: null, candidates: [], warning: 'no_vehicle' } });
        return;
      }

      // Prefilter in the database (a legacy whole-day end reaches up to 24 h past the stored 00:00), exact check below.
      const dayMs = 24 * 60 * 60 * 1000;
      const rows = await prisma.booking.findMany({
        where: {
          vehicleId: vehicle.id,
          status: { not: 'cancelled' },
          startDate: { lte: queryEnd },
          endDate: { gte: new Date(queryStart.getTime() - dayMs - 3_600_000) },
        },
        orderBy: { startDate: 'asc' },
      });

      const candidates = rows
        .map((b) => {
          const legacyEnd = !hasTimeOfDay(b.endDate);
          const effectiveEnd = legacyEnd ? TimeUtils.startOfNextDay(b.endDate) : b.endDate;
          // A whole-day end is exclusive at the next midnight; a timed end is inclusive.
          const startsBefore = b.startDate.getTime() <= queryEnd.getTime();
          const endsAfter = legacyEnd ? effectiveEnd.getTime() > queryStart.getTime() : effectiveEnd.getTime() >= queryStart.getTime();
          if (!startsBefore || !endsAfter) return null;
          const exact = !dayOnly && at.getTime() <= b.endDate.getTime() && at.getTime() >= b.startDate.getTime();
          return {
            bookingId: b.id,
            matchType: exact ? ('exact' as const) : ('whole_day' as const),
            status: b.status,
            startDate: b.startDate,
            endDate: b.endDate,
            hasTimes: hasTimeOfDay(b.startDate) || hasTimeOfDay(b.endDate),
            customerName: b.customerName,
            customerEmail: b.customerEmail,
            customerPhone: b.customerPhone,
            customerLocale: b.customerLocale,
            driverStreet: b.driverStreet,
            driverZip: b.driverZip,
            driverCity: b.driverCity,
            driverCountry: b.driverCountry,
            driverBirthDate: dateOnlyString(b.driverBirthDate),
            driverLicenseNumber: b.driverLicenseNumber,
            driverLicenseCountry: b.driverLicenseCountry,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => (a.matchType === b.matchType ? 0 : a.matchType === 'exact' ? -1 : 1));

      res.json({
        success: true,
        data: {
          plate,
          at: at.toISOString(),
          vehicle,
          candidates,
          warning: candidates.length === 0 ? 'none' : candidates.length > 1 ? 'multiple' : null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /* ──────────────────────────────────────────────────────────── *
   *  CRUD                                                        *
   * ──────────────────────────────────────────────────────────── */

  router.get('/', auth, fines, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 200);
      const where: Prisma.FineWhereInput = {};
      if (typeof req.query.status === 'string' && ['NEW', 'ASSIGNED', 'FORWARDED', 'INVOICED', 'CLOSED'].includes(req.query.status)) {
        where.status = req.query.status as never;
      }
      if (typeof req.query.plate === 'string' && req.query.plate.trim()) where.licensePlate = normalizeLicensePlate(req.query.plate);
      if (typeof req.query.bookingId === 'string' && req.query.bookingId) where.bookingId = req.query.bookingId;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q) {
        const plateQ = normalizeLicensePlate(q);
        where.OR = [
          { reference: { contains: q, mode: 'insensitive' } },
          { authority: { contains: q, mode: 'insensitive' } },
          { place: { contains: q, mode: 'insensitive' } },
          ...(plateQ ? [{ licensePlate: { contains: plateQ } }] : []),
          { booking: { customerName: { contains: q, mode: 'insensitive' as const } } },
        ];
      }

      const [rows, total, grouped] = await Promise.all([
        prisma.fine.findMany({ where, orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, include: fineInclude }),
        prisma.fine.count({ where }),
        prisma.fine.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);
      const statusCounts = { NEW: 0, ASSIGNED: 0, FORWARDED: 0, INVOICED: 0, CLOSED: 0 } as Record<string, number>;
      for (const g of grouped) statusCounts[g.status] = g._count._all;

      res.json({
        success: true,
        data: { items: rows.map(mapFine), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), statusCounts },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/',
    auth,
    fines,
    singleUpload('document', { maxMb: MAX_DOCUMENT_MB }),
    validate(createFineSchema),
    audit('fine', 'create'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      let documentKey: string | null = null;
      try {
        const b = req.body;
        const plate = normalisePlate(b.licensePlate);
        const vehicle = await vehicleByPlate(plate);
        const file = req.file;
        const doc = file ? detectDocumentType(file.buffer) : null;
        if (file && !doc) throw new AppError('Nur PDF-, JPG- oder PNG-Dateien sind erlaubt.', 415, 'unsupported_file');

        const created = await prisma.fine.create({
          data: {
            licensePlate: plate,
            occurredAt: parseOccurredAt(b.occurredAt),
            place: b.place ?? '',
            authority: b.authority ?? '',
            reference: b.reference ?? '',
            amount: b.amount,
            currency: b.currency ?? (await container.settingsService.getCurrency()),
            description: b.description ?? '',
            notes: b.notes ?? '',
            vehicleId: vehicle?.id ?? null,
            createdById: req.adminId!,
          },
        });
        if (file && doc) {
          documentKey = PrivateStorageService.keys.fineDocument(created.id, withExtension(fileNameOf(file), doc.ext));
          await storage.save(documentKey, file.buffer);
          await prisma.fine.update({ where: { id: created.id }, data: { documentKey } });
        }
        const fresh = await fineOr404(created.id);
        setAuditDetails(res, { fine: [fresh.reference, formatLicensePlate(fresh.licensePlate)].filter(Boolean).join(' · '), amount: Number(fresh.amount), vehicleKnown: !!vehicle }, created.id);
        res.status(201).json({ success: true, data: mapFine(fresh) });
      } catch (err) {
        if (documentKey) await storage.delete(documentKey).catch(() => undefined);
        next(err);
      }
    },
  );

  router.get('/:id', auth, fines, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: mapFine(await fineOr404(req.params.id)) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', auth, fines, validate(updateFineSchema), audit('fine', 'update', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await fineOr404(req.params.id);
      const b = req.body;
      const data: Prisma.FineUncheckedUpdateInput = {};
      for (const key of ['place', 'authority', 'reference', 'description', 'notes', 'currency'] as const) {
        if (b[key] !== undefined) data[key] = b[key];
      }
      if (b.amount !== undefined) data.amount = b.amount;
      if (b.status !== undefined) data.status = b.status;
      if (b.occurredAt !== undefined) data.occurredAt = parseOccurredAt(b.occurredAt);

      let vehicleId = existing.vehicleId;
      if (b.licensePlate !== undefined) {
        const plate = normalisePlate(b.licensePlate);
        data.licensePlate = plate;
        vehicleId = (await vehicleByPlate(plate))?.id ?? null;
        data.vehicleId = vehicleId;
      }

      let bookingId = existing.bookingId;
      if (b.bookingId !== undefined) {
        if (b.bookingId === null) {
          bookingId = null;
        } else {
          const booking = await prisma.booking.findUnique({ where: { id: b.bookingId }, select: { id: true, vehicleId: true } });
          if (!booking) throw new AppError('Booking not found', 404);
          if (vehicleId && booking.vehicleId !== vehicleId) {
            throw new AppError('Die Buchung gehört zu einem anderen Fahrzeug als das Kontrollschild der Busse.', 422, 'booking_vehicle_mismatch');
          }
          bookingId = booking.id;
        }
      } else if (b.licensePlate !== undefined && existing.bookingId && vehicleId !== existing.vehicleId) {
        bookingId = null; // plate changed to another vehicle: the old assignment no longer fits
      }
      if (bookingId !== existing.bookingId) {
        data.bookingId = bookingId;
        if (b.status === undefined) {
          if (!bookingId && existing.status === 'ASSIGNED') data.status = 'NEW';
          if (bookingId && existing.status === 'NEW') data.status = 'ASSIGNED';
        }
      }

      const updated = await prisma.fine.update({ where: { id: existing.id }, data, include: fineInclude });
      setAuditDetails(res, { fields: Object.keys(b), status: updated.status });
      res.json({ success: true, data: mapFine(updated) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', auth, fines, audit('fine', 'delete', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await fineOr404(req.params.id);
      if (existing.invoiceItems.length > 0) {
        throw new AppError('Die Busse wurde bereits verrechnet und kann nicht gelöscht werden.', 409, 'fine_has_invoice');
      }
      await prisma.fine.delete({ where: { id: existing.id } });
      await storage.deletePrefix(`fines/${existing.id}`).catch(() => undefined);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  /* ──────────────────────────────────────────────────────────── *
   *  Document                                                    *
   * ──────────────────────────────────────────────────────────── */

  router.post(
    '/:id/document',
    auth,
    fines,
    singleUpload('document', { maxMb: MAX_DOCUMENT_MB }),
    audit('fine', 'upload-document', describeFine),
    async (req: Request, res: Response, next: NextFunction) => {
      let newKey: string | null = null;
      try {
        const existing = await fineOr404(req.params.id);
        const file = req.file;
        if (!file) throw new AppError('Bitte eine Datei auswählen (Feld "document").', 400, 'file_required');
        const doc = detectDocumentType(file.buffer);
        if (!doc) throw new AppError('Nur PDF-, JPG- oder PNG-Dateien sind erlaubt.', 415, 'unsupported_file');

        newKey = PrivateStorageService.keys.fineDocument(existing.id, withExtension(fileNameOf(file), doc.ext));
        await storage.save(newKey, file.buffer);
        const updated = await prisma.fine.update({ where: { id: existing.id }, data: { documentKey: newKey }, include: fineInclude });
        if (existing.documentKey && existing.documentKey !== newKey) await storage.delete(existing.documentKey).catch(() => undefined);
        res.status(201).json({ success: true, data: mapFine(updated) });
      } catch (err) {
        if (newKey) await storage.delete(newKey).catch(() => undefined);
        next(err);
      }
    },
  );

  router.get('/:id/document', auth, fines, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fine = await fineOr404(req.params.id);
      if (!fine.documentKey) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }
      await storage.sendFile(res, fine.documentKey, {
        filename: path.basename(fine.documentKey),
        contentType: contentTypeOfKey(fine.documentKey),
        inline: req.query.inline === '1' || req.query.inline === 'true',
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/document', auth, fines, audit('fine', 'delete-document', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fine = await fineOr404(req.params.id);
      if (fine.documentKey) {
        await prisma.fine.update({ where: { id: fine.id }, data: { documentKey: null } });
        await storage.delete(fine.documentKey).catch(() => undefined);
      }
      res.json({ success: true, data: mapFine(await fineOr404(fine.id)) });
    } catch (err) {
      next(err);
    }
  });

  /* ──────────────────────────────────────────────────────────── *
   *  Workflow: assign, driver export, notify, invoice            *
   * ──────────────────────────────────────────────────────────── */

  router.post('/:id/assign', auth, fines, validate(assignFineSchema), audit('fine', 'assign', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fine = await fineOr404(req.params.id);
      const booking = await prisma.booking.findUnique({ where: { id: req.body.bookingId }, select: { id: true, vehicleId: true, customerName: true } });
      if (!booking) throw new AppError('Booking not found', 404);
      if (fine.vehicleId && booking.vehicleId !== fine.vehicleId) {
        throw new AppError('Die Buchung gehört zu einem anderen Fahrzeug als das Kontrollschild der Busse.', 422, 'booking_vehicle_mismatch');
      }
      const updated = await prisma.fine.update({
        where: { id: fine.id },
        data: {
          bookingId: booking.id,
          vehicleId: fine.vehicleId ?? booking.vehicleId,
          // Later stages (forwarded, invoiced, closed) are not reset by a re-assignment.
          ...(fine.status === 'NEW' ? { status: 'ASSIGNED' as const } : {}),
        },
        include: fineInclude,
      });
      setAuditDetails(res, { customerName: booking.customerName });
      res.json({ success: true, data: mapFine(updated) });
    } catch (err) {
      next(err);
    }
  });

  /** The booking of an assigned fine (with the vehicle) or 409. */
  const assignedBooking = async (fine: FineRow) => {
    if (!fine.bookingId) {
      throw new AppError('Die Busse ist noch keiner Buchung zugeordnet.', 409, 'fine_not_assigned');
    }
    const booking = await prisma.booking.findUnique({ where: { id: fine.bookingId }, include: { vehicle: true } });
    if (!booking) throw new AppError('Die zugeordnete Buchung existiert nicht mehr.', 409, 'fine_not_assigned');
    return booking;
  };

  router.get('/:id/driver-export.pdf', auth, fines, audit('fine', 'driver-export', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fine = await fineOr404(req.params.id);
      const booking = await assignedBooking(fine);
      const bytes = await container.fineDocumentService.generateDriverExport({
        company: await container.settingsService.getCompany(),
        fine: {
          reference: fine.reference,
          authority: fine.authority,
          occurredAt: fine.occurredAt,
          place: fine.place,
          licensePlate: fine.licensePlate,
          amount: Number(fine.amount),
          currency: fine.currency,
          description: fine.description,
        },
        vehicle: booking.vehicle,
        booking,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="HoppDrive-Fahrerangaben-${fine.reference ? fine.reference.replace(/[^\w.-]+/g, '_') : fine.id.substring(0, 8)}.pdf"`,
      );
      res.setHeader('Content-Length', bytes.length);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(Buffer.from(bytes));
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/notify', auth, fines, validate(notifyFineSchema), audit('fine', 'notify', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fine = await fineOr404(req.params.id);
      const booking = await assignedBooking(fine);
      if (!booking.customerEmail) {
        throw new AppError('Der Mieter hat keine E-Mail-Adresse.', 422, 'no_recipient');
      }
      const result = await container.emailService.sendFineNotice({
        to: booking.customerEmail,
        customerName: booking.customerName,
        licensePlate: formatLicensePlate(fine.licensePlate),
        occurredAt: fine.occurredAt,
        place: fine.place || null,
        authority: fine.authority || null,
        reference: fine.reference || null,
        amount: Number(fine.amount),
        currency: fine.currency,
        note: req.body.note || null,
        attachments: fine.documentKey ? [{ filename: path.basename(fine.documentKey), storageKey: fine.documentKey }] : [],
        related: { type: 'fine', id: fine.id },
      });
      // Told the renter: the fine moves on from "assigned" to "forwarded".
      if (result.status !== 'FAILED' && fine.status === 'ASSIGNED') {
        await prisma.fine.update({ where: { id: fine.id }, data: { status: 'FORWARDED' } });
      }
      setAuditDetails(res, { customerName: booking.customerName, emailed: result.status === 'SENT' });
      res.json({
        success: true,
        data: {
          emailSent: result.status === 'SENT',
          status: result.status,
          emailMessageId: result.id,
          ...(result.error ? { error: result.error } : {}),
          fine: mapFine(await fineOr404(fine.id)),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/invoice', auth, fines, validate(fineInvoiceSchema), audit('fine', 'invoice', describeFine), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fine = await fineOr404(req.params.id);
      const booking = await assignedBooking(fine);
      if (fine.invoiceItems.length > 0) {
        const nr = fine.invoiceItems[0].invoice.invoiceNumber;
        throw new AppError(`Für diese Busse existiert bereits die Rechnung ${nr}.`, 409, 'fine_already_invoiced');
      }
      const b = req.body;

      const feeIds: string[] = [...new Set<string>(b.feeIds ?? [])];
      const fees = feeIds.length > 0 ? await prisma.fee.findMany({ where: { id: { in: feeIds } } }) : [];
      if (fees.length !== feeIds.length) throw new AppError('Eine ausgewählte Gebühr existiert nicht (mehr).', 422, 'invalid_reference');

      const description = [
        'Busse',
        fine.reference ? `Nr. ${fine.reference}` : null,
        fine.authority || null,
        `Kontrollschild ${formatLicensePlate(fine.licensePlate)}`,
        fmtDateMaybeTime(fine.occurredAt),
        fine.place || null,
      ]
        .filter(Boolean)
        .join(', ');

      const { invoice, emailSent, emailError } = await container.invoiceService.createCustom({
        type: 'FINE',
        bookingId: booking.id,
        items: [
          // The fine is passed on to the renter at cost: no VAT.
          { description, quantity: 1, unitPrice: Number(fine.amount), vatRate: 0, fineId: fine.id },
          ...fees.map((fee) => ({
            description: fee.name,
            quantity: 1,
            unitPrice: Number(fee.defaultAmount),
            vatRate: fee.vatRate === null ? null : Number(fee.vatRate),
            feeId: fee.id,
          })),
        ],
        currency: fine.currency,
        dueDays: b.dueDays,
        notes: b.notes,
        withQrBill: b.withQrBill,
        sendEmail: b.sendEmail,
      });

      setAuditDetails(res, { ...InvoiceService.auditSummary(invoice), emailed: emailSent }, fine.id);
      res.status(201).json({
        success: true,
        data: {
          invoice: {
            ...mapInvoice(invoice),
            ...(b.sendEmail === true ? { emailSent, ...(emailError ? { emailError } : {}) } : {}),
          },
          fine: mapFine(await fineOr404(fine.id)),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** "Verfügung" -> "Verfügung.pdf" (or the right extension when the name has another one). */
function withExtension(fileName: string, ext: string): string {
  const base = fileName.replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'document';
  return `${base}.${ext}`;
}
