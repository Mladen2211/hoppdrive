import { Router, Request, Response, NextFunction } from 'express';
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
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
