import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { ADMIN_ROLES, can } from '@hoppdrive/shared';
import type { Container } from '../../infrastructure/config/container';
import { validate, createContactRequestSchema } from '../validators';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { describeInquiry, vehicleLabelById } from '../middleware/auditDescribers';
import { eventBus } from '../../infrastructure/services/EventBus';
import { AppError } from '../../application/errors';
import { normalizeDiscountCode } from '../../infrastructure/services/DiscountService';
import { mapBooking } from './bookingRoutes';

export function contactRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  // The whole admin side of the pipeline is the "inquiries" area (GET = view, mutations = edit).
  const inquiries = access.requirePermission('inquiries');

  /** POST /api/contact – Submit new contact request (public) */
  router.post(
    '/',
    validate(createContactRequestSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const request = await container.createContactRequest.execute(req.body);

        // Notify connected admin clients in real-time
        eventBus.broadcast('new-inquiry', { id: request.id });

        // Create notification for every active admin who may see inquiries
        try {
          const rolesWithAccess = ADMIN_ROLES.filter((role) => can(role, 'inquiries', 'view'));
          const admins = await container.prisma.admin.findMany({
            where: { deletedAt: null, inviteTokenHash: null, role: { in: rolesWithAccess } },
            select: { id: true },
          });
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

  /**
   * GET /api/contact – List requests (inquiries: view).
   * statusCounts covers ALL requests (every status key present), not just the current page/filter,
   * so the pipeline tiles stay correct while a tab or page is selected.
   */
  router.get('/', auth, inquiries, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, pageSize } = req.query;
      const [result, statusCounts] = await Promise.all([
        container.getContactRequests.execute({
          status: status as any,
          page: page ? Number(page) : undefined,
          pageSize: pageSize ? Number(pageSize) : undefined,
        }),
        container.contactRepo.countByStatus(),
      ]);
      res.json({
        success: true,
        data: {
          items: result.items.map(mapContact),
          total: result.total,
          page: Number(page) || 1,
          pageSize: Number(pageSize) || 20,
          totalPages: Math.ceil(result.total / (Number(pageSize) || 20)),
          statusCounts,
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
    inquiries,
    audit('contact-request', 'update-status', describeInquiry(container, (req) => ({ status: req.body?.status }))),
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
   *
   * Body: { vehicleId, totalPrice?, discountCode? }
   *  - totalPrice = price BEFORE the discount (computed from the pricing rules when omitted)
   *  - discountCode: omitted = the code the visitor typed into the inquiry form; null or '' = no discount;
   *    a string = use this code instead. The code is re-validated (window, limits, personal recipient,
   *    minimum days) and redeemed in the same transaction. An invalid code answers 422 code
   *    'discount_invalid' (+ reason): retry with discountCode:null to approve without it.
   * The booking copies name, e-mail, phone and language of the inquiry.
   */
  router.post(
    '/:id/approve',
    auth,
    inquiries,
    audit(
      'contact-request',
      'approve',
      describeInquiry(container, async (req) => ({ vehicle: await vehicleLabelById(container, req.body?.vehicleId) })),
    ),
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

        let basePrice = totalPrice;
        if (basePrice === undefined || basePrice === null) {
          const pricing = await container.calculatePricing.execute({ vehicleId, totalDays: days });
          basePrice = pricing.totalPrice.amount;
        }
        basePrice = Number(basePrice);

        // Which code applies: the override from the admin, else the one the visitor entered.
        const requested =
          req.body.discountCode === undefined ? inquiry.discountCode : (req.body.discountCode as string | null);
        const codeText = requested ? normalizeDiscountCode(requested) : '';

        const bookingId = uuid();
        const booking = await container.prisma.$transaction(
          async (tx) => {
            let discountAmount = 0;
            let discountCodeId: string | null = null;
            if (codeText) {
              const check = await container.discountService.check(
                { code: codeText, email: inquiry.email, days, baseTotal: basePrice, currency: vehicle.currency },
                tx,
              );
              if (!check.valid || !check.code) {
                throw new AppError(
                  check.message ?? 'Der Rabattcode ist ungültig.',
                  422,
                  'discount_invalid',
                  { reason: check.reason },
                );
              }
              discountAmount = check.discount;
              discountCodeId = check.code.id;
            }

            const created = await tx.booking.create({
              data: {
                id: bookingId,
                vehicleId,
                customerName: inquiry.fullName,
                customerEmail: inquiry.email,
                customerPhone: inquiry.phone,
                customerLocale: inquiry.locale,
                startDate: inquiry.desiredStartDate!,
                endDate: inquiry.desiredEndDate!,
                totalPrice: Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100),
                discountCodeId,
                discountAmount,
                currency: vehicle.currency,
                status: 'reserved',
                notes: `Aus Anfrage übernommen (${inquiry.email})`,
              },
              include: { vehicle: true, discountCode: { select: { id: true, code: true } } },
            });
            if (discountCodeId) {
              await container.discountService.redeem(tx, {
                codeId: discountCodeId,
                email: inquiry.email,
                amount: discountAmount,
                bookingId,
                contactRequestId: inquiry.id,
              });
            }
            await tx.contactRequest.update({ where: { id }, data: { status: 'converted' } });
            return created;
          },
          { isolationLevel: 'Serializable' },
        );

        setAuditDetails(res, {
          bookingId: booking.id,
          ...(booking.discountCode ? { discountCode: booking.discountCode.code, discount: Number(booking.discountAmount) } : {}),
        });
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
    inquiries,
    audit('contact-request', 'deny', describeInquiry(container)),
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
    discountCode: c.discountCode ?? null,
    locale: c.locale ?? null,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
