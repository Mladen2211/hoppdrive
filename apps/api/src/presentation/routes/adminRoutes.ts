import { Router, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, inviteAdminSchema, updateAdminRoleSchema } from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware, invalidateAdminAccess } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';

/**
 * User management (Settings → Benutzer und Rollen). Everything here needs the `users` area,
 * i.e. the ADMIN role. Guards (no self role change / self delete, last ADMIN protected) live
 * in ManageAdminsUseCase and answer 409 with a German message and a machine-readable code.
 */
export function adminRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const users = access.requirePermission('users');

  /** GET /api/admins – list users incl. pending invites */
  router.get('/', auth, users, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await container.manageAdmins.list() });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/admins/invite { email, role } – creates (or re-invites) a pending user and mails
   * the accept-invite link. Response: the user row plus emailSent (false when the mail failed;
   * the user can then be re-invited).
   */
  router.post(
    '/invite',
    auth,
    users,
    validate(inviteAdminSchema),
    audit('admin', 'invite'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await container.manageAdmins.invite({
          email: req.body.email,
          role: req.body.role,
          invitedByAdminId: req.adminId!,
        });
        setAuditDetails(res, { targetEmail: result.target.email, role: result.target.role }, result.admin.id);
        res.status(201).json({ success: true, data: { ...result.admin, emailSent: result.emailSent } });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/admins/:id { role } – change a user's role */
  router.patch(
    '/:id',
    auth,
    users,
    validate(updateAdminRoleSchema),
    audit('admin', 'change_role'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await container.manageAdmins.changeRole({
          id: req.params.id,
          role: req.body.role,
          actingAdminId: req.adminId!,
        });
        invalidateAdminAccess(req.params.id); // takes effect immediately in this process
        setAuditDetails(res, {
          targetEmail: result.admin.email,
          targetName: result.admin.name,
          from: result.previousRole,
          to: result.admin.role,
        });
        res.json({ success: true, data: result.admin });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/admins/:id – remove a user (soft delete, history stays) */
  router.delete(
    '/:id',
    auth,
    users,
    audit('admin', 'delete'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const removed = await container.manageAdmins.remove({
          id: req.params.id,
          actingAdminId: req.adminId!,
        });
        invalidateAdminAccess(req.params.id);
        setAuditDetails(res, {
          targetEmail: removed.email,
          targetName: removed.name,
          role: removed.role,
        });
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
