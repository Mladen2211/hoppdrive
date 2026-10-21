import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import type { Container } from '../../infrastructure/config/container';
import {
  validate,
  createBookingSchema,
  updateBookingSchema,
  finalizeContractSchema,
  transitionBookingStatusSchema,
} from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { describeBooking, vehicleLabelById } from '../middleware/auditDescribers';
import { AuditLog, DateRange, Money, PricingService } from '../../domain';
import { AppError } from '../../application/errors';
import { CONTRACT_CLAUSES, renderClause } from '../../infrastructure/services/contractTemplate';
import { DiscountService } from '../../infrastructure/services/DiscountService';
import { hasTimeOfDay } from '../../infrastructure/format';
import { invoiceInclude } from '../../infrastructure/services/InvoiceService';
import { dateOnlyString, parseDateOnly } from '../helpers/dates';
import { BookingStatus } from '@prisma/client';

export function bookingRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  // Contract work needs "contracts"; the booking LIST/CREATE are shared with the calendar.
  const contracts = access.requirePermission('contracts');
  const contractsOrCalendar = access.requireAnyPermission([{ area: 'contracts' }, { area: 'calendar' }]);
  const prisma = container.prisma;

  const bookingInclude = { vehicle: true, discountCode: { select: { id: true, code: true } } } as const;

  /** GET /api/bookings – List bookings (contracts or calendar: view) */
  router.get('/', auth, contractsOrCalendar, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, pageSize } = req.query;
      const p = page ? Number(page) : 1;
      const ps = pageSize ? Number(pageSize) : 20;
      const where = status ? { status: status as BookingStatus } : {};

      const [rows, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip: (p - 1) * ps,
          take: ps,
          orderBy: { createdAt: 'desc' },
          include: bookingInclude,
        }),
        prisma.booking.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          items: rows.map(mapBooking),
          total,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/bookings – Create booking (contracts or calendar: edit) */
  router.post(
    '/',
    auth,
    contractsOrCalendar,
    validate(createBookingSchema),
    audit('booking', 'create', async (req) => ({
      customerName: req.body?.customerName,
      vehicle: await vehicleLabelById(container, req.body?.vehicleId),
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
    })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const b = req.body;
        const { booking, discountAmount } = await container.createBooking.execute({
          ...b,
          driverBirthDate: parseDateOnly(b.driverBirthDate),
        });
        setAuditDetails(res, discountAmount > 0 ? { discount: discountAmount, discountCode: b.discountCode } : {}, booking.id);

        const row = await prisma.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });

        if (b.customerEmail && row) {
          try {
            await container.emailService.sendBookingConfirmation({
              to: b.customerEmail,
              customerName: row.customerName,
              vehicleName: `${row.vehicle.brand} ${row.vehicle.model}`,
              startDate: row.startDate,
              endDate: row.endDate,
              totalPrice: Number(row.totalPrice),
              currency: row.currency,
              discountAmount: Number(row.discountAmount),
              bookingRef: row.id.substring(0, 8).toUpperCase(),
              related: { type: 'booking', id: row.id },
            });
          } catch (emailErr) {
            console.error('[Booking] Failed to queue booking confirmation email:', emailErr);
          }
        }

        res.status(201).json({ success: true, data: mapBooking(row) });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /api/bookings/:id – Update customer / driver details, notes and the pickup / return times.
   * Body (all optional): customerName, customerEmail, customerPhone, customerLocale, notes, locationId,
   *   startDate, endDate (ISO date-times), totalPrice (final price override), recalculatePrice (bool),
   *   driverStreet, driverZip, driverCity, driverCountry, driverBirthDate (YYYY-MM-DD),
   *   driverLicenseNumber, driverLicenseCountry. null / '' clears a field.
   * Changing the times re-checks availability (other bookings, maintenance); closed bookings keep their dates.
   * The price is only recomputed with recalculatePrice:true (an existing discount is re-applied).
   */
  router.patch(
    '/:id',
    auth,
    contracts,
    validate(updateBookingSchema),
    audit('booking', 'update', describeBooking(container, (req) => ({ fields: Object.keys(req.body ?? {}) }))),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const b = req.body;

        const booking = await prisma.booking.findUnique({
          where: { id },
          include: { vehicle: true, discountCode: true },
        });
        if (!booking) {
          res.status(404).json({ success: false, error: 'Booking not found' });
          return;
        }

        const blank = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() ? v.trim() : null);
        const data: Record<string, unknown> = {};
        if (b.customerName !== undefined) data.customerName = b.customerName;
        if (b.customerEmail !== undefined) data.customerEmail = blank(b.customerEmail)?.toLowerCase() ?? null;
        if (b.notes !== undefined) data.notes = b.notes;
        if (b.locationId !== undefined) data.locationId = b.locationId;
        if (b.customerLocale !== undefined) data.customerLocale = b.customerLocale;
        for (const key of [
          'customerPhone', 'driverStreet', 'driverZip', 'driverCity', 'driverCountry',
          'driverLicenseNumber', 'driverLicenseCountry',
        ] as const) {
          if (b[key] !== undefined) data[key] = blank(b[key]);
        }
        if (b.driverBirthDate !== undefined) data.driverBirthDate = parseDateOnly(b.driverBirthDate);

        // ── Pickup / return times ──
        const datesChange = b.startDate !== undefined || b.endDate !== undefined;
        if (datesChange) {
          if (booking.status === 'completed' || booking.status === 'cancelled') {
            throw new AppError('Abgeschlossene oder stornierte Buchungen können nicht mehr verschoben werden.', 409, 'booking_closed');
          }
          const start = b.startDate ? new Date(b.startDate) : booking.startDate;
          const end = b.endDate ? new Date(b.endDate) : booking.endDate;
          if (end <= start) {
            throw new AppError('Die Rückgabe muss nach der Übergabe liegen.', 422, 'invalid_period', undefined, {
              endDate: ['Die Rückgabe muss nach der Übergabe liegen.'],
            });
          }
          const range = DateRange.create(start, end);

          const clash = await prisma.booking.findFirst({
            where: {
              vehicleId: booking.vehicleId,
              id: { not: id },
              status: { in: ['reserved', 'active'] },
              startDate: { lt: end },
              endDate: { gt: start },
            },
            select: { id: true },
          });
          if (clash) throw new AppError('Das Fahrzeug ist in diesem Zeitraum bereits gebucht.', 409, 'booking_overlap');
          const maintenance = await container.prisma.vehicleMaintenance.findFirst({
            where: { vehicleId: booking.vehicleId, startDate: { lt: end }, endDate: { gt: start } },
            select: { id: true },
          });
          if (maintenance) throw new AppError('Das Fahrzeug ist in diesem Zeitraum in Wartung.', 409, 'maintenance_overlap');

          data.startDate = start;
          data.endDate = end;

          if (b.totalPrice === undefined && b.recalculatePrice === true) {
            const rules = await container.pricingRuleRepo.findAll();
            const base = PricingService.calculate(
              Money.create(Number(booking.vehicle.basePricePerDay), booking.vehicle.currency),
              range.totalDays,
              rules,
            ).totalPrice.amount;
            const discount = booking.discountCode ? DiscountService.computeAmount(booking.discountCode, base) : 0;
            data.totalPrice = Math.max(0, Math.round((base - discount) * 100) / 100);
            data.discountAmount = discount;
          }
        }
        if (b.totalPrice !== undefined) data.totalPrice = b.totalPrice;

        const updated = await prisma.booking.update({ where: { id }, data, include: bookingInclude });
        setAuditDetails(res, datesChange ? { startDate: updated.startDate, endDate: updated.endDate } : {});
        res.json({ success: true, data: mapBooking(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /api/bookings/:id/status – Transition reserved → active → completed,
   * or cancel. Drives Booking.activate()/complete()/cancel(), which existed
   * in the domain entity but had no use-case or route calling them before.
   */
  router.patch(
    '/:id/status',
    auth,
    contracts,
    validate(transitionBookingStatusSchema),
    audit('booking', 'update-status', describeBooking(container, (req) => ({ status: req.body?.status }))),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.transitionBookingStatus.execute({
          id: req.params.id,
          status: req.body.status,
        });

        // Re-fetch the full row — the domain Booking entity returned by the
        // use case doesn't carry customerEmail/contractStatus/signedAt/vehicle,
        // and mapping it directly would show those as reset in the response.
        const updated = await prisma.booking.findUnique({
          where: { id: req.params.id },
          include: bookingInclude,
        });
        res.json({ success: true, data: mapBooking(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/bookings/report – Earnings report by vehicle for a date range */
  router.get('/report', auth, access.requirePermission('reports', 'view'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        res.status(400).json({ success: false, error: 'from and to query params are required' });
        return;
      }
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        res.status(400).json({ success: false, error: 'from and to must be valid ISO date strings' });
        return;
      }
      if (fromDate >= toDate) {
        res.status(400).json({ success: false, error: 'from must be before to' });
        return;
      }
      toDate.setHours(23, 59, 59, 999);

      // Fetch all non-cancelled bookings that overlap the range
      const allBookings = await prisma.booking.findMany({
        where: {
          status: { not: 'cancelled' },
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
        },
        include: { vehicle: true },
        orderBy: { startDate: 'asc' },
      });

      // Group by vehicle
      const vehicleMap = new Map<string, {
        vehicleId: string;
        brand: string;
        model: string;
        bookings: any[];
        totalEarnings: number;
        totalDays: number;
      }>();

      for (const b of allBookings) {
        const key = b.vehicleId;
        if (!vehicleMap.has(key)) {
          vehicleMap.set(key, {
            vehicleId: key,
            brand: b.vehicle.brand,
            model: b.vehicle.model,
            bookings: [],
            totalEarnings: 0,
            totalDays: 0,
          });
        }
        const entry = vehicleMap.get(key)!;
        const price = Number(b.totalPrice);
        const days = Math.ceil(
          (b.endDate.getTime() - b.startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        entry.bookings.push({
          id: b.id,
          customerName: b.customerName,
          startDate: b.startDate,
          endDate: b.endDate,
          totalPrice: price,
          currency: b.currency,
          status: b.status,
          days,
        });
        entry.totalEarnings += price;
        entry.totalDays += days;
      }

      const vehicles = Array.from(vehicleMap.values()).sort(
        (a, b) => b.totalEarnings - a.totalEarnings,
      );

      const grandTotal = vehicles.reduce((sum, v) => sum + v.totalEarnings, 0);
      const grandDays = vehicles.reduce((sum, v) => sum + v.totalDays, 0);

      res.json({
        success: true,
        data: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          vehicles,
          grandTotal,
          grandDays,
          totalBookings: allBookings.length,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/bookings/:id – one booking incl. driver details (contracts or calendar: view) */
  router.get('/:id', auth, contractsOrCalendar, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: bookingInclude });
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found' });
        return;
      }
      res.json({ success: true, data: mapBooking(booking) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Mails the contract package of a SIGNED booking: the signed contract + the latest pick-up damage report (when one
   * exists) + the rental invoice (when one exists, with its QR bill). Never throws for delivery problems.
   */
  async function sendContractPackage(
    booking: { id: string; customerName: string; startDate: Date; endDate: Date; contractPdfPath: string | null; vehicle: { brand: string; model: string } },
    to: string,
  ) {
    if (!booking.contractPdfPath) throw new AppError('Der Vertrag wurde noch nicht erstellt.', 409, 'contract_not_signed');
    const ref = booking.id.substring(0, 8).toUpperCase();
    const attachments: { filename: string; storageKey?: string; bytes?: Uint8Array; contentType?: string }[] = [
      { filename: `HoppDrive_Mietvertrag_${ref}.pdf`, storageKey: booking.contractPdfPath, contentType: 'application/pdf' },
    ];
    const pickup = await prisma.bookingInspection.findFirst({
      where: { bookingId: booking.id, type: 'PICKUP', reportStorageKey: { not: null } },
      orderBy: [{ at: 'desc' }, { createdAt: 'desc' }],
    });
    let damageReport = false;
    if (pickup?.reportStorageKey && (await container.privateStorage.exists(pickup.reportStorageKey))) {
      attachments.push({ filename: `HoppDrive_Uebergabeprotokoll_${ref}.pdf`, storageKey: pickup.reportStorageKey, contentType: 'application/pdf' });
      damageReport = true;
    }
    let hasInvoice = false;
    const invoice = await prisma.invoice.findFirst({
      where: { bookingId: booking.id, type: 'RENTAL' },
      orderBy: { createdAt: 'desc' },
      include: invoiceInclude,
    });
    if (invoice) {
      try {
        const invoiceBytes = await container.invoiceService.renderPdf(invoice);
        attachments.push({ filename: `HoppDrive_Rechnung_${invoice.invoiceNumber}.pdf`, bytes: invoiceBytes, contentType: 'application/pdf' });
        hasInvoice = true;
      } catch (invoiceErr) {
        console.error('[Booking] Invoice not attached to the contract package:', invoiceErr);
      }
    }
    const result = await container.emailService.sendContractPackage({
      to,
      customerName: booking.customerName,
      bookingRef: ref,
      vehicleName: `${booking.vehicle.brand} ${booking.vehicle.model}`,
      startDate: booking.startDate,
      endDate: booking.endDate,
      attachments,
      includes: { contract: true, damageReport, invoice: hasInvoice },
      related: { type: 'booking', id: booking.id },
    });
    return { ...result, includes: { contract: true, damageReport, invoice: hasInvoice } };
  }

  /**
   * GET /api/bookings/:id/contract-preview – Contract data for the iPad signing view: the booking and company data,
   * the clauses of the built-in contract, the active template, the open damages and who signs for the company.
   * Server-sourced so the on-screen data can never drift from what ends up in the PDF.
   * `pdfUrl` (GET <api>/bookings/:id/contract-draft.pdf) is the pre-filled contract, signed by the company, with the
   * renter's signature still empty: show it to the renter before they sign.
   */
  router.get('/:id/contract-preview', auth, contracts, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { vehicle: true, location: true },
      });
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found' });
        return;
      }

      const company = await container.settingsService.getCompany();
      const companyName = company.name;
      const clauses = CONTRACT_CLAUSES.map((c) => ({
        id: c.id,
        heading: c.heading,
        body: renderClause(c.body, { companyName }),
      }));
      const template = await container.contractService.activeTemplate();
      const signer = await container.contractService.resolveSigner(req.adminId, booking.companySignerId);
      const damages = await container.contractService.openDamages(booking.vehicleId);

      res.json({
        success: true,
        data: {
          booking: {
            id: booking.id,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            driverStreet: booking.driverStreet,
            driverZip: booking.driverZip,
            driverCity: booking.driverCity,
            driverCountry: booking.driverCountry,
            driverBirthDate: dateOnlyString(booking.driverBirthDate),
            driverLicenseNumber: booking.driverLicenseNumber,
            driverLicenseCountry: booking.driverLicenseCountry,
            vehicleBrand: booking.vehicle.brand,
            vehicleModel: booking.vehicle.model,
            licensePlate: booking.vehicle.licensePlate,
            startDate: booking.startDate,
            endDate: booking.endDate,
            hasTimes: hasTimeOfDay(booking.startDate) || hasTimeOfDay(booking.endDate),
            totalPrice: Number(booking.totalPrice),
            discountAmount: Number(booking.discountAmount),
            currency: booking.currency,
            locationName: booking.location?.name ?? null,
          },
          company: {
            name: company.name,
            street: company.street,
            zip: company.zip,
            city: company.city,
            country: company.country,
            phone: company.phone,
            email: company.email,
            uid: company.uid,
          },
          clauses,
          templateId: template?.id ?? null,
          templateName: template?.name ?? null,
          pdfUrl: `/bookings/${booking.id}/contract-draft.pdf`,
          existingDamages: damages.map((d, i) => ({
            number: i + 1,
            zone: d.zone,
            type: d.type,
            severity: d.severity,
            description: d.description,
          })),
          companySigner: { id: signer.adminId, name: signer.name, hasSignature: !!signer.signatureData },
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/bookings/:id/contract-draft.pdf – the contract pre-filled from the booking and signed by the company,
   * the renter's signature still empty (active template, else the built-in contract; AGB attached).
   * 422 company_signature_missing when the signing admin has no signature on file.
   */
  router.get('/:id/contract-draft.pdf', auth, contracts, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { vehicle: true, location: true },
      });
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found' });
        return;
      }
      const signer = await container.contractService.requireSigner(req.adminId, booking.companySignerId);
      const { bytes } = await container.contractService.render(booking, { signer });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="HoppDrive-Vertrag-Entwurf-${booking.id.substring(0, 8).toUpperCase()}.pdf"`);
      res.setHeader('Content-Length', bytes.length);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(Buffer.from(bytes));
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/bookings/:id/finalize-contract – the renter signs: renders the final contract (active template, else the
   * built-in one; company signature of the resolved signer + the renter's signature; AGB attached), stores it privately,
   * records template / signer / SHA-256 on the booking and mails the contract package to the renter
   * (signed contract + the latest pick-up damage report + the rental invoice, whatever exists).
   * 422 company_signature_missing when the signer has no signature on file (nothing is changed then).
   */
  router.post(
    '/:id/finalize-contract',
    auth,
    contracts,
    validate(finalizeContractSchema),
    audit('booking', 'sign_contract', describeBooking(container)),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { signature, customerEmail } = req.body;

        const booking = await prisma.booking.findUnique({
          where: { id },
          include: { vehicle: true, location: true },
        });
        if (!booking) {
          res.status(404).json({ success: false, error: 'Booking not found' });
          return;
        }

        const signedAt = new Date();
        const signeeIp = req.ip || req.socket.remoteAddress || 'unknown';
        const emailToUse = customerEmail || booking.customerEmail;

        // The company side is signed by the configured signer (or the acting admin). Passed per call, never kept in the
        // PdfService, so it cannot leak into another contract. Blocks with 422 when the signer has no signature.
        const signer = await container.contractService.requireSigner(req.adminId, booking.companySignerId);

        // Render BEFORE touching the booking: a failing PDF must not leave a "signed" booking without a contract.
        const { bytes: pdfBytes, templateId } = await container.contractService.render(
          { ...booking, signatureData: signature, signedAt },
          { signer, customerSignatureData: signature, signedAt },
        );

        // Persist the signed PDF as an immutable artifact: subsequent downloads stream this exact file rather than
        // regenerating from (mutable) DB state.
        const pdfSha256 = crypto.createHash('sha256').update(Buffer.from(pdfBytes)).digest('hex');
        const contractPdfPath = await container.contractStorage.save(booking.id, pdfBytes);

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            signatureData: signature,
            signedAt,
            signeeIp,
            contractStatus: 'SIGNED',
            companySignerId: signer.adminId,
            contractTemplateId: templateId,
            contractPdfPath,
            contractSha256: pdfSha256,
            ...(emailToUse && { customerEmail: emailToUse }),
          },
          include: { vehicle: true, location: true },
        });

        // Explicit audit entry capturing exactly which bytes were signed —
        // the generic audit middleware always redacts the body.
        try {
          await container.auditLogRepo.save(
            AuditLog.create({
              id: uuid(),
              adminId: req.adminId!,
              action: 'sign_contract_persisted',
              resource: 'booking',
              resourceId: updated.id,
              details: JSON.stringify({ pdfSha256, contractPdfPath, signedAt, templateId, signerId: signer.adminId }),
            }),
          );
        } catch (auditErr) {
          console.error('[Booking] Failed to write contract audit entry:', auditErr);
        }

        // Contract package: the signed contract + the latest pick-up damage report + the rental invoice (if any).
        let emailSent = false;
        if (updated.customerEmail) {
          try {
            emailSent = (await sendContractPackage(updated, updated.customerEmail)).status === 'SENT';
          } catch (emailErr) {
            console.error('[Booking] Failed to queue contract package email:', emailErr);
            // Don't fail the request if email fails
          }
        }

        const fresh = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
        setAuditDetails(res, { templateId, signer: signer.name ?? undefined, emailed: emailSent });
        res.json({
          success: true,
          data: {
            ...mapBooking(fresh),
            contractStatus: updated.contractStatus,
            signedAt: updated.signedAt,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/bookings/:id/send-contract-package { email? } – (re)sends the contract package ("Vertragspaket senden"):
   * the signed contract + the latest pick-up damage report + the rental invoice, whatever exists. `email` overrides the
   * booking's address. 409 contract_not_signed, 422 no_recipient. Resolves { emailSent, status, includes, emailMessageId }.
   */
  router.post(
    '/:id/send-contract-package',
    auth,
    contracts,
    audit('booking', 'send_contract_package', describeBooking(container)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
        if (!booking) {
          res.status(404).json({ success: false, error: 'Booking not found' });
          return;
        }
        if (booking.contractStatus !== 'SIGNED') {
          throw new AppError('Der Vertrag wurde noch nicht unterzeichnet.', 409, 'contract_not_signed');
        }
        const requested = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (requested && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requested)) {
          throw new AppError('Gültige E-Mail-Adresse erforderlich.', 422, 'invalid_email', undefined, { email: ['Ungültige E-Mail-Adresse'] });
        }
        const to = requested || booking.customerEmail;
        if (!to) throw new AppError('Der Mieter hat keine E-Mail-Adresse.', 422, 'no_recipient');

        const result = await sendContractPackage(booking, to);
        setAuditDetails(res, { to, emailed: result.status === 'SENT', includes: result.includes });
        res.json({
          success: true,
          data: { emailSent: result.status === 'SENT', status: result.status, emailMessageId: result.id, includes: result.includes, ...(result.error ? { error: result.error } : {}) },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/bookings/:id/download-contract – Download contract PDF (read from the private storage) */
  router.get('/:id/download-contract', auth, contracts, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { vehicle: true, location: true },
      });
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found' });
        return;
      }

      if (booking.contractStatus !== 'SIGNED') {
        res.status(400).json({ success: false, error: 'Contract has not been signed yet' });
        return;
      }

      const filename = `HoppDrive-Vertrag-${booking.id.substring(0, 8).toUpperCase()}.pdf`;

      // Prefer the immutable artifact persisted at signing time — a re-download
      // must return the exact document the customer saw, not one rebuilt from
      // whatever the company's data happens to be now.
      if (booking.contractPdfPath) {
        try {
          const persisted = await container.contractStorage.read(booking.contractPdfPath);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Length', persisted.length);
          res.setHeader('Cache-Control', 'private, no-store');
          res.send(persisted);
          return;
        } catch (readErr) {
          console.error('[Booking] Failed to read persisted contract, falling back to regeneration:', readErr);
        }
      }

      // Fallback: bookings signed before contractPdfPath existed, or a missing file.
      const signer = await container.contractService.resolveSigner(req.adminId, booking.companySignerId);
      const { bytes: pdfBytes } = await container.contractService.render(booking, {
        signer,
        customerSignatureData: booking.signatureData,
        signedAt: booking.signedAt,
        // The template the contract was created from; the built-in layout for contracts without one.
        template: booking.contractTemplateId ?? null,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function mapBooking(b: any) {
  return {
    id: b.id,
    vehicleId: b.vehicleId,
    customerName: b.customerName,
    customerEmail: b.customerEmail ?? null,
    customerPhone: b.customerPhone ?? null,
    customerLocale: b.customerLocale ?? null,
    /** Pickup / return. Rows at exactly 00:00 (local) are legacy whole-day bookings. */
    startDate: b.startDate,
    endDate: b.endDate,
    hasTimes: !!(b.startDate && b.endDate) && (hasTimeOfDay(new Date(b.startDate)) || hasTimeOfDay(new Date(b.endDate))),
    driverStreet: b.driverStreet ?? null,
    driverZip: b.driverZip ?? null,
    driverCity: b.driverCity ?? null,
    driverCountry: b.driverCountry ?? null,
    /** YYYY-MM-DD */
    driverBirthDate: dateOnlyString(b.driverBirthDate),
    driverLicenseNumber: b.driverLicenseNumber ?? null,
    driverLicenseCountry: b.driverLicenseCountry ?? null,
    /** Final price (after discountAmount). */
    totalPrice: Number(b.totalPrice),
    discountAmount: Number(b.discountAmount ?? 0),
    discountCode: b.discountCode ? { id: b.discountCode.id, code: b.discountCode.code } : null,
    currency: b.currency ?? 'CHF',
    status: b.status,
    notes: b.notes,
    contractStatus: b.contractStatus ?? 'PENDING',
    signedAt: b.signedAt ?? null,
    contractTemplateId: b.contractTemplateId ?? null,
    contractSha256: b.contractSha256 ?? null,
    companySignerId: b.companySignerId ?? null,
    locationId: b.locationId ?? null,
    createdAt: b.createdAt,
    vehicle: b.vehicle
      ? { brand: b.vehicle.brand, model: b.vehicle.model, licensePlate: b.vehicle.licensePlate ?? null }
      : null,
  };
}

