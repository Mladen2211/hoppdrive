import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

export function notificationRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  // Notifications are personal: every role, but not removed accounts.
  const anyRole = createPermissionMiddleware(container.prisma).requireAnyRole();

  /** GET /api/notifications – List notifications for current admin */
  router.get('/', auth, anyRole, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { unreadOnly } = req.query;
      const where: any = { adminId: req.adminId! };
      if (unreadOnly === 'true') {
        where.readAt = null;
      }

      const [items, unreadCount] = await Promise.all([
        container.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        container.prisma.notification.count({
          where: { adminId: req.adminId!, readAt: null },
        }),
      ]);

      res.json({ success: true, data: { items, unreadCount } });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/notifications/:id/read – Mark notification as read */
  router.patch('/:id/read', auth, anyRole, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const notification = await container.prisma.notification.update({
        where: { id: req.params.id },
        data: { readAt: new Date() },
      });
      res.json({ success: true, data: notification });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/notifications/read-all – Mark all notifications as read */
  router.patch('/read-all', auth, anyRole, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await container.prisma.notification.updateMany({
        where: { adminId: req.adminId!, readAt: null },
        data: { readAt: new Date() },
      });
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
