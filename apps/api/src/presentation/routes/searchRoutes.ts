import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { can } from '@hoppdrive/shared';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

export function searchRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);

  /**
   * GET /api/search?q=... – Global search across all entities (any authenticated role).
   * Each result group is only searched when the caller's role may see that area, so search
   * can never reveal data the role has no access to (e.g. inquiries for the editor role).
   */
  router.get('/', auth, access.requireAnyRole(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const role = await access.roleOf(req.adminId!);
      const canVehicles = can(role, 'fleet', 'view') || can(role, 'calendar', 'view');
      const canBookings = can(role, 'contracts', 'view') || can(role, 'calendar', 'view');
      const canInquiries = can(role, 'inquiries', 'view');
      const canLocations = can(role, 'content', 'view');
      const canInvoices = can(role, 'contracts', 'view');
      const none = Promise.resolve([] as any[]);

      const q = (req.query.q as string || '').trim();
      if (!q || q.length < 2) {
        res.json({ success: true, data: { vehicles: [], bookings: [], inquiries: [], locations: [], invoices: [] } });
        return;
      }

      const like = `%${q}%`;

      // Run all searches in parallel
      const [vehicles, bookings, inquiries, locations, invoices] = await Promise.all([
        canVehicles ? container.prisma.vehicle.findMany({
          where: {
            OR: [
              { brand: { contains: q, mode: 'insensitive' } },
              { model: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
          select: { id: true, brand: true, model: true, type: true, isAvailable: true },
        }) : none,
        canBookings ? container.prisma.booking.findMany({
          where: {
            OR: [
              { customerName: { contains: q, mode: 'insensitive' } },
              { id: { startsWith: q } },
            ],
          },
          take: 5,
          include: { vehicle: { select: { brand: true, model: true } } },
          orderBy: { createdAt: 'desc' },
        }) : none,
        canInquiries ? container.prisma.contactRequest.findMany({
          where: {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { message: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
          select: { id: true, fullName: true, email: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }) : none,
        canLocations ? container.prisma.location.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { address: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
          select: { id: true, name: true, city: true, isActive: true },
        }) as Promise<any> : none,
        canInvoices ? container.prisma.invoice.findMany({
          where: {
            OR: [
              { invoiceNumber: { contains: q, mode: 'insensitive' } },
              { customerName: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
          select: { id: true, invoiceNumber: true, customerName: true, total: true, currency: true, status: true },
          orderBy: { createdAt: 'desc' },
        }) as Promise<any> : none,
      ]);

      res.json({
        success: true,
        data: {
          vehicles: vehicles.map((v: any) => ({
            id: v.id,
            label: `${v.brand} ${v.model}`,
            type: v.type,
            available: v.isAvailable,
            category: 'vehicle',
          })),
          bookings: bookings.map((b: any) => ({
            id: b.id,
            label: b.customerName,
            vehicle: b.vehicle ? `${b.vehicle.brand} ${b.vehicle.model}` : null,
            status: b.status,
            category: 'booking',
          })),
          inquiries: inquiries.map((c: any) => ({
            id: c.id,
            label: c.fullName,
            email: c.email,
            status: c.status,
            category: 'inquiry',
          })),
          locations: (locations as any[]).map((l: any) => ({
            id: l.id,
            label: l.name,
            city: l.city,
            active: l.isActive,
            category: 'location',
          })),
          invoices: (invoices as any[]).map((i: any) => ({
            id: i.id,
            label: i.invoiceNumber,
            customer: i.customerName,
            total: Number(i.total),
            currency: i.currency,
            status: i.status,
            category: 'invoice',
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
