import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, createBookingSchema, finalizeContractSchema } from '../validators';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';
import { BookingStatus } from '@prisma/client';

export function bookingRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);

  /** GET /api/bookings – List bookings (admin) */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, pageSize } = req.query;
      const p = page ? Number(page) : 1;
      const ps = pageSize ? Number(pageSize) : 20;
      const where = status ? { status: status as BookingStatus } : {};

      const [rows, total] = await Promise.all([
        container.prisma.booking.findMany({
          where,
          skip: (p - 1) * ps,
          take: ps,
          orderBy: { createdAt: 'desc' },
          include: { vehicle: true },
        }),
        container.prisma.booking.count({ where }),
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

  /** POST /api/bookings – Create booking (admin) */
  router.post(
    '/',
    auth,
    validate(createBookingSchema),
    audit('booking', 'create'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const booking = await container.createBooking.execute(req.body);
        res.status(201).json({ success: true, data: mapBooking(booking) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/bookings/:id – Update booking fields (customerEmail, notes) */
  router.patch(
    '/:id',
    auth,
    audit('booking', 'update'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { customerEmail, notes } = req.body;

        const booking = await container.prisma.booking.findUnique({ where: { id } });
        if (!booking) {
          res.status(404).json({ success: false, error: 'Booking not found' });
          return;
        }

        const updated = await container.prisma.booking.update({
          where: { id },
          data: {
            ...(customerEmail !== undefined && { customerEmail }),
            ...(notes !== undefined && { notes }),
          },
        });

        res.json({ success: true, data: mapBooking(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/bookings/report – Earnings report by vehicle for a date range */
  router.get('/report', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        res.status(400).json({ success: false, error: 'from and to query params are required' });
        return;
      }
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);

      // Fetch all non-cancelled bookings that overlap the range
      const allBookings = await container.prisma.booking.findMany({
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

  /** POST /api/bookings/:id/finalize-contract – Sign and generate contract */
  router.post(
    '/:id/finalize-contract',
    auth,
    validate(finalizeContractSchema),
    audit('booking', 'sign_contract'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { signature, customerEmail } = req.body;

        // Fetch booking with vehicle
        const booking = await container.prisma.booking.findUnique({
          where: { id },
          include: { vehicle: true },
        });
        if (!booking) {
          res.status(404).json({ success: false, error: 'Booking not found' });
          return;
        }

        // Update booking with signature data
        const signedAt = new Date();
        const signeeIp = req.ip || req.socket.remoteAddress || 'unknown';
        const emailToUse = customerEmail || booking.customerEmail;

        const updated = await container.prisma.booking.update({
          where: { id },
          data: {
            signatureData: signature,
            signedAt,
            signeeIp,
            contractStatus: 'SIGNED',
            ...(emailToUse && { customerEmail: emailToUse }),
          },
          include: { vehicle: true, location: true },
        });

        // Fetch admin signature for company side of contract
        const admin = await container.prisma.admin.findFirst({ select: { signatureData: true } });
        if (admin?.signatureData) {
          container.pdfService.updateCompany({ signatureData: admin.signatureData });
        }

        // Generate PDF using new PdfService
        const pdfBytes = await container.pdfService.generateContract({
          id: updated.id,
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          vehicleBrand: updated.vehicle.brand,
          vehicleModel: updated.vehicle.model,
          startDate: updated.startDate,
          endDate: updated.endDate,
          totalPrice: Number(updated.totalPrice),
          currency: updated.currency,
          signatureData: updated.signatureData,
          signedAt: updated.signedAt,
          notes: updated.notes,
          locationName: updated.location?.name ?? null,
        });

        // Send email if customer email is available
        if (updated.customerEmail) {
          try {
            await container.emailService.sendContractEmail({
              to: updated.customerEmail,
              customerName: updated.customerName,
              bookingId: updated.id,
              pdfBytes: new Uint8Array(pdfBytes),
            });
          } catch (emailErr) {
            console.error('[Booking] Failed to send contract email:', emailErr);
            // Don't fail the request if email fails
          }
        }

        res.json({
          success: true,
          data: {
            ...mapBooking(updated),
            contractStatus: updated.contractStatus,
            signedAt: updated.signedAt,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/bookings/:id/download-contract – Download contract PDF */
  router.get('/:id/download-contract', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const booking = await container.prisma.booking.findUnique({
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

      // Fetch admin signature for company side of contract
      const admin = await container.prisma.admin.findFirst({ select: { signatureData: true } });
      if (admin?.signatureData) {
        container.pdfService.updateCompany({ signatureData: admin.signatureData });
      }

      // Re-generate PDF from stored data
      const pdfBytes = await container.pdfService.generateContract({
        id: booking.id,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        vehicleBrand: booking.vehicle.brand,
        vehicleModel: booking.vehicle.model,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPrice: Number(booking.totalPrice),
        currency: booking.currency,
        signatureData: booking.signatureData,
        signedAt: booking.signedAt,
        notes: booking.notes,
        locationName: booking.location?.name ?? null,
      });

      const filename = `HoppDrive-Vertrag-${booking.id.substring(0, 8).toUpperCase()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function mapBooking(b: any) {
  return {
    id: b.id,
    vehicleId: b.vehicleId,
    customerName: b.customerName,
    customerEmail: b.customerEmail ?? null,
    startDate: b.dateRange?.startDate ?? b.startDate,
    endDate: b.dateRange?.endDate ?? b.endDate,
    totalPrice: b.totalPrice?.amount ?? b.totalPrice,
    currency: b.totalPrice?.currency ?? 'CHF',
    status: b.status,
    notes: b.notes,
    contractStatus: b.contractStatus ?? 'PENDING',
    signedAt: b.signedAt ?? null,
    createdAt: b.createdAt,
    vehicle: b.vehicle
      ? { brand: b.vehicle.brand, model: b.vehicle.model, licensePlate: b.vehicle.licensePlate }
      : null,
  };
}
