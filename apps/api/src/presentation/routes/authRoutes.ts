import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { validate, loginSchema, resetPasswordSchema } from '../validators';
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

  /** POST /api/auth/logout */
  router.post('/logout', (_req: Request, res: Response) => {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    res.clearCookie('refreshToken', { path: '/api/auth', domain: cookieDomain });
    res.json({ success: true, data: null, message: 'Logged out' });
  });

  return router;
}
