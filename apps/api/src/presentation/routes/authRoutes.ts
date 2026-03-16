import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, loginSchema, resetPasswordSchema, updateProfileSchema } from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';

export function authRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** POST /api/auth/login */
  router.post(
    '/login',
    validate(loginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await container.login.execute(req.body);

        // Set refresh token as HTTP-only cookie (allow cross-subdomain use)
        const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
        const cookieSameSite = (process.env.COOKIE_SAMESITE as any) || 'none';
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: cookieSameSite as any,
          domain: cookieDomain,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/api/auth',
        });

        res.json({
          success: true,
          data: {
            accessToken: result.accessToken,
            admin: result.admin,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /api/auth/refresh */
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ success: false, error: 'No refresh token' });
        return;
      }

      const result = await container.refreshToken.execute(refreshToken);

      const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
      const cookieSameSite = (process.env.COOKIE_SAMESITE as any) || 'none';
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: cookieSameSite as any,
        domain: cookieDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.json({
        success: true,
        data: { accessToken: result.accessToken },
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/auth/reset-password */
  router.post(
    '/reset-password',
    auth,
    validate(resetPasswordSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        await container.resetPassword.execute({
          adminId: req.adminId!,
          newPassword: req.body.newPassword,
        });
        res.json({
          success: true,
          data: null,
          message: 'Password updated successfully',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/auth/profile – get current admin profile */
  router.get(
    '/profile',
    auth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const admin = await container.prisma.admin.findUnique({
          where: { id: req.adminId! },
        });
        if (!admin) {
          res.status(404).json({ success: false, error: 'Admin not found' });
          return;
        }
        res.json({
          success: true,
          data: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            firstName: admin.firstName,
            lastName: admin.lastName,
            phone: admin.phone,
            mustResetPassword: admin.mustResetPassword,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PUT /api/auth/profile – update current admin profile */
  router.put(
    '/profile',
    auth,
    validate(updateProfileSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { firstName, lastName, email, phone, currentPassword, newPassword } = req.body;

        // Build update data
        const updateData: any = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (phone !== undefined) updateData.phone = phone;
        if (email !== undefined) updateData.email = email.toLowerCase().trim();

        // Derive name from first+last
        if (firstName !== undefined || lastName !== undefined) {
          const current = await container.prisma.admin.findUnique({ where: { id: req.adminId! } });
          const fn = firstName ?? current?.firstName ?? '';
          const ln = lastName ?? current?.lastName ?? '';
          updateData.name = [fn, ln].filter(Boolean).join(' ') || current?.name || 'Admin';
        }

        // Password change requires current password verification
        if (newPassword) {
          if (!currentPassword) {
            res.status(400).json({ success: false, error: 'Current password required to change password' });
            return;
          }
          const admin = await container.prisma.admin.findUnique({ where: { id: req.adminId! } });
          if (!admin) {
            res.status(404).json({ success: false, error: 'Admin not found' });
            return;
          }
          const bcrypt = await import('bcryptjs');
          const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
          if (!isValid) {
            res.status(400).json({ success: false, error: 'Current password is incorrect' });
            return;
          }
          updateData.passwordHash = await bcrypt.hash(newPassword, 12);
        }

        const updated = await container.prisma.admin.update({
          where: { id: req.adminId! },
          data: updateData,
        });

        res.json({
          success: true,
          data: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone,
            mustResetPassword: updated.mustResetPassword,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /api/auth/logout */
  router.post('/logout', (_req: Request, res: Response) => {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    res.clearCookie('refreshToken', { path: '/api/auth', domain: cookieDomain });
    res.json({ success: true, data: null, message: 'Logged out' });
  });

  return router;
}
