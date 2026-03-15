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
