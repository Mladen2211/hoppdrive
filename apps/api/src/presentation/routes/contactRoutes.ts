import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import type { Container } from '../../infrastructure/config/container';
import { validate, createContactRequestSchema } from '../validators';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';
import { eventBus } from '../../infrastructure/services/EventBus';

export function contactRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);

  /** POST /api/contact – Submit new contact request (public) */
  router.post(
    '/',
    validate(createContactRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const request = await container.createContactRequest.execute(req.body);

        // Notify connected admin clients in real-time
        eventBus.broadcast('new-inquiry', { id: request.id });

        // Create notification for all admins
        try {
          const admins = await container.prisma.admin.findMany({ select: { id: true } });
          await container.prisma.notification.createMany({
            data: admins.map((a: { id: string }) => ({
              adminId: a.id,
              type: 'NEW_INQUIRY' as const,
              title: 'Neue Anfrage',
              body: `${req.body.fullName} hat eine neue Anfrage gesendet.`,
              refId: request.id,
            })),
          });
        } catch (notifErr) {
          console.error('[Contact] Failed to create notifications:', notifErr);
        }

        res.status(201).json({
          success: true,
          data: { id: request.id },
          message: 'Your inquiry has been submitted. We will respond within 24 hours.',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/contact – List all requests (admin) */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, pageSize } = req.query;
      const result = await container.getContactRequests.execute({
        status: status as any,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      res.json({
        success: true,
        data: {
          items: result.items.map(mapContact),
          total: result.total,
          page: Number(page) || 1,
          pageSize: Number(pageSize) || 20,
          totalPages: Math.ceil(result.total / (Number(pageSize) || 20)),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/contact/:id/status – Update status (admin) */
  router.patch(
    '/:id/status',
    auth,
    audit('contact-request', 'update-status'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const VALID_STATUSES = ['pending', 'reviewed', 'responded', 'converted', 'denied', 'archived'];
        if (!req.body.status || !VALID_STATUSES.includes(req.body.status)) {
          res.status(400).json({
            success: false,
            error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
          });
          return;
        }
        await container.updateContactStatus.execute({
          id: req.params.id,
          status: req.body.status,
        });
        res.json({ success: true, data: null, message: 'Status updated' });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/contact/:id/approve – Assign a vehicle and create the booking
   * in one atomic transaction (fixes the previous non-atomic two-call client
   * flow: create booking, then separately mark the inquiry converted).
   */
  router.post(
    '/:id/approve',
    auth,
    audit('contact-request', 'approve'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { vehicleId, totalPrice } = req.body;

        if (!vehicleId) {
          res.status(400).json({ success: false, error: 'vehicleId is required' });
          return;
        }

        const inquiry = await container.prisma.contactRequest.findUnique({ where: { id } });
        if (!inquiry) {
          res.status(404).json({ success: false, error: 'Contact request not found' });
          return;
        }
        if (!inquiry.desiredStartDate || !inquiry.desiredEndDate) {
          res.status(400).json({ success: false, error: 'Inquiry has no start/end date' });
          return;
        }
        if (inquiry.status === 'converted') {
          res.status(400).json({ success: false, error: 'Inquiry has already been converted' });
          return;
        }

        const vehicle = await container.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle) {
          res.status(404).json({ success: false, error: 'Vehicle not found' });
          return;
        }
        if (!vehicle.isAvailable) {
          res.status(400).json({ success: false, error: 'Vehicle is not available for booking' });
          return;
        }

        const overlap = await container.prisma.booking.findFirst({
          where: {
            vehicleId,
            status: { in: ['reserved', 'active'] },
            startDate: { lt: inquiry.desiredEndDate },
            endDate: { gt: inquiry.desiredStartDate },
          },
        });
        if (overlap) {
          res.status(400).json({ success: false, error: 'Vehicle is already booked for the selected dates' });
          return;
        }

        const days = Math.max(1, Math.ceil(
          (inquiry.desiredEndDate.getTime() - inquiry.desiredStartDate.getTime()) / (1000 * 60 * 60 * 24),
        ));

        let price = totalPrice;
        if (price === undefined || price === null) {
          const pricing = await container.calculatePricing.execute({ vehicleId, totalDays: days });
          price = pricing.totalPrice.amount;
        }

        const bookingId = uuid();
        const [booking] = await container.prisma.$transaction([
          container.prisma.booking.create({
            data: {
              id: bookingId,
              vehicleId,
              customerName: inquiry.fullName,
              customerEmail: inquiry.email,
              startDate: inquiry.desiredStartDate,
              endDate: inquiry.desiredEndDate,
              totalPrice: price,
              status: 'reserved',
              notes: `Aus Anfrage übernommen (${inquiry.email})`,
            },
            include: { vehicle: true },
          }),
          container.prisma.contactRequest.update({
            where: { id },
            data: { status: 'converted' },
          }),
        ], { isolationLevel: 'Serializable' });

        res.status(201).json({ success: true, data: mapBooking(booking) });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/contact/:id/deny – Decline a request and let the customer know.
   */
  router.post(
    '/:id/deny',
    auth,
    audit('contact-request', 'deny'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;

        const inquiry = await container.prisma.contactRequest.findUnique({ where: { id } });
        if (!inquiry) {
          res.status(404).json({ success: false, error: 'Contact request not found' });
          return;
        }

        await container.updateContactStatus.execute({ id, status: 'denied' });

        try {
          await container.emailService.sendDeclineEmail({
            to: inquiry.email,
            customerName: inquiry.fullName,
            reason: reason || undefined,
          });
        } catch (emailErr) {
          console.error('[Contact] Failed to send decline email:', emailErr);
        }

        res.json({ success: true, data: null });
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
    customerEmail: b.customerEmail ?? null,
    startDate: b.startDate,
    endDate: b.endDate,
    totalPrice: Number(b.totalPrice),
    currency: b.currency,
    status: b.status,
    notes: b.notes,
    contractStatus: b.contractStatus ?? 'PENDING',
    createdAt: b.createdAt,
    vehicle: b.vehicle ? { brand: b.vehicle.brand, model: b.vehicle.model } : null,
  };
}

function mapContact(c: any) {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email?.value ?? c.email,
    phone: c.phone?.value ?? c.phone,
    vehicleOfInterest: c.vehicleOfInterest,
    desiredStartDate: c.desiredStartDate,
    desiredEndDate: c.desiredEndDate,
    message: c.message,
    privacyConsent: c.privacyConsent,
    marketingConsent: c.marketingConsent,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
