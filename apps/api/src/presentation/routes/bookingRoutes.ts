import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, createBookingSchema } from '../validators';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';

export function bookingRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);

  /** GET /api/bookings – List bookings (admin) */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, pageSize } = req.query;
      const result = await container.getBookings.execute({
        status: status as any,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      res.json({
        success: true,
        data: {
          items: result.items.map(mapBooking),
          total: result.total,
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

  return router;
}

function mapBooking(b: any) {
  return {
    id: b.id,
    vehicleId: b.vehicleId,
    customerName: b.customerName,
    startDate: b.dateRange?.startDate ?? b.startDate,
    endDate: b.dateRange?.endDate ?? b.endDate,
    totalPrice: b.totalPrice?.amount ?? b.totalPrice,
    currency: b.totalPrice?.currency ?? 'CHF',
    status: b.status,
    notes: b.notes,
    createdAt: b.createdAt,
  };
}
