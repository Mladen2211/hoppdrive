import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { AuditLog } from '../../domain';
import type { Container } from '../../infrastructure/config/container';
import { AccountLockedError } from '../../application/errors';
import { assertPasswordAcceptable } from '../../application/use-cases/auth';
import {
  validate,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updatePreferencesSchema,
  forgotPasswordSchema,
  resetPasswordWithTokenSchema,
  acceptInviteSchema,
} from '../validators';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Always answers 200, so successful requests must count too (unlike the login limiter).
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in 15 minutes.' },
});

// Invite / reset links are 256-bit random, this only stops hammering of the endpoints.
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

async function logAuthAction(
  container: Container,
  adminId: string,
  action: string,
  details?: string | Record<string, unknown>,
) {
  try {
    await container.auditLogRepo.save(
      AuditLog.create({
        id: uuid(),
        adminId,
        action,
        resource: 'auth',
        resourceId: adminId,
        details: details === undefined ? null : typeof details === 'string' ? details : JSON.stringify(details),
      }),
    );
  } catch { /* audit failure must never break the request */ }
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  // Allow cross-subdomain use via COOKIE_DOMAIN; HttpOnly so scripts never see the token.
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  const cookieSameSite = (process.env.COOKIE_SAMESITE as any) || 'none';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: cookieSameSite as any,
    domain: cookieDomain,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
}

function mapProfile(admin: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  signatureData: string | null;
  mustResetPassword: boolean;
  role: string;
  locale: string;
  theme: string;
}) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    firstName: admin.firstName,
    lastName: admin.lastName,
    phone: admin.phone,
    signatureData: admin.signatureData ?? null,
    mustResetPassword: admin.mustResetPassword,
    role: admin.role,
    locale: admin.locale,
    theme: admin.theme,
  };
}

export function authRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  // Profile and password routes are open to every role, but not to removed accounts.
  const anyRole = access.requireAnyRole();

  /** POST /api/auth/login — 401 invalid_credentials | 423 locked (code, lockedUntil) */
  router.post(
    '/login',
    loginLimiter,
    validate(loginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await container.login.execute(req.body);

        setRefreshCookie(res, result.refreshToken);

        await logAuthAction(container, result.admin.id, 'login');
        res.json({
          success: true,
          data: {
            accessToken: result.accessToken,
            admin: result.admin,
          },
        });
      } catch (err) {
        if (err instanceof AccountLockedError && err.justLocked && err.adminId) {
          await logAuthAction(container, err.adminId, 'account_locked', {
            lockedUntil: err.lockedUntil.toISOString(),
          });
        }
        next(err);
      }
    },
  );

  /** POST /api/auth/refresh — rolls the refresh cookie, returns a new access token + admin */
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ success: false, error: 'No refresh token' });
        return;
      }

      const result = await container.refreshToken.execute(refreshToken);
      setRefreshCookie(res, result.refreshToken);

      res.json({
        success: true,
        data: { accessToken: result.accessToken, admin: result.admin },
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/auth/reset-password — forced / voluntary change for the signed-in admin */
  router.post(
    '/reset-password',
    auth,
    anyRole,
    validate(resetPasswordSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        await container.resetPassword.execute({
          adminId: req.adminId!,
          newPassword: req.body.newPassword,
        });
        await logAuthAction(container, req.adminId!, 'reset_password');
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

  /**
   * POST /api/auth/forgot-password { email } — ALWAYS 200, whether or not the address belongs
   * to an account. The work happens after the response so timing does not leak it either.
   */
  router.post(
    '/forgot-password',
    forgotPasswordLimiter,
    validate(forgotPasswordSchema),
    (req: Request, res: Response) => {
      res.json({
        success: true,
        data: null,
        message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.',
      });
      container.forgotPassword.execute(req.body.email).catch((err) => {
        console.error('[Auth] forgot-password failed:', err);
      });
    },
  );

  /** GET /api/auth/reset-token/:token → { valid, expiresInMinutes } */
  router.get(
    '/reset-token/:token',
    tokenLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const info = await container.getResetTokenInfo.execute(req.params.token);
        res.json({ success: true, data: info });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/auth/reset-password-token { token, newPassword }
   * Sets the password, burns the token, clears lockout + forced-reset flag and signs the
   * admin in (same response shape as login) — "Danach werden Sie automatisch angemeldet".
   */
  router.post(
    '/reset-password-token',
    tokenLimiter,
    validate(resetPasswordWithTokenSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await container.resetPasswordWithToken.execute(req.body);
        setRefreshCookie(res, result.refreshToken);
        await logAuthAction(container, result.admin.id, 'reset_password_via_token');
        res.json({
          success: true,
          data: { accessToken: result.accessToken, admin: result.admin },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/auth/invite/:token → { valid, email, role } */
  router.get(
    '/invite/:token',
    tokenLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const info = await container.getInviteInfo.execute(req.params.token);
        res.json({ success: true, data: info });
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /api/auth/accept-invite { token, firstName, lastName, password } → login-shaped response */
  router.post(
    '/accept-invite',
    tokenLimiter,
    validate(acceptInviteSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await container.acceptInvite.execute(req.body);
        setRefreshCookie(res, result.refreshToken);
        await logAuthAction(container, result.admin.id, 'accept_invite', { role: result.admin.role });
        // Confirmation to the new user (also tells them if somebody else used their invite). Never blocks the login.
        container.emailService
          .sendAdminInviteAccepted({ to: result.admin.email, name: result.admin.name, role: result.admin.role })
          .catch((err) => console.error('[Auth] Failed to send invite-accepted mail:', err));
        res.json({
          success: true,
          data: { accessToken: result.accessToken, admin: result.admin },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /api/auth/profile – get current admin profile (includes role) */
  router.get(
    '/profile',
    auth,
    anyRole,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const admin = await container.prisma.admin.findUnique({
          where: { id: req.adminId! },
        });
        if (!admin) {
          res.status(404).json({ success: false, error: 'Admin not found' });
          return;
        }
        res.json({ success: true, data: mapProfile(admin) });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PUT /api/auth/profile/signature – set the admin's company signature.
   * Accepts either JSON { signatureData: 'data:image/png;base64,...' } (drawn on the signature pad)
   * or multipart/form-data with an image file in the field `signature` (PNG or JPG upload).
   * Either way the image is normalised: background removed (transparent PNG), cropped to the ink,
   * at most 1200 px wide and stored as a PNG data URL of at most 150 KB.
   * Responds with the updated profile (incl. signatureData).
   */
  router.put(
    '/profile/signature',
    auth,
    anyRole,
    signatureUpload.single('signature'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        let normalised: string;
        if (req.file) {
          if (!/^image\/(png|jpe?g)$/i.test(req.file.mimetype)) {
            res.status(415).json({ success: false, error: 'Nur PNG- oder JPG-Dateien sind erlaubt.' });
            return;
          }
          normalised = await container.signatureImages.normalise(req.file.buffer);
        } else {
          const { signatureData } = req.body ?? {};
          if (typeof signatureData !== 'string' || !signatureData) {
            res.status(400).json({ success: false, error: 'signatureData (base64) or an image file is required' });
            return;
          }
          // Cheap guard before decoding anything: the raw input is limited to 8 MB of base64 text.
          if (signatureData.length > 11 * 1024 * 1024) {
            res.status(413).json({ success: false, error: 'Signature data exceeds maximum allowed size' });
            return;
          }
          normalised = await container.signatureImages.normalise(signatureData);
        }

        const updated = await container.prisma.admin.update({
          where: { id: req.adminId! },
          data: { signatureData: normalised },
        });
        await logAuthAction(container, req.adminId!, 'update_signature', { uploaded: !!req.file });
        res.json({ success: true, data: mapProfile(updated), message: 'Signature saved' });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PUT /api/auth/profile/preferences { locale?, theme? } – UI language ('de'|'en'|'fr'|'it'|'hr')
   * and theme ('light'|'dark'|'system') of the signed-in admin. Responds with the updated profile.
   */
  router.put(
    '/profile/preferences',
    auth,
    anyRole,
    validate(updatePreferencesSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { locale, theme } = req.body as { locale?: string; theme?: string };
        const updated = await container.prisma.admin.update({
          where: { id: req.adminId! },
          data: {
            ...(locale !== undefined && { locale }),
            ...(theme !== undefined && { theme }),
          },
        });
        await logAuthAction(container, req.adminId!, 'update_preferences', {
          ...(locale !== undefined ? { locale } : {}),
          ...(theme !== undefined ? { theme } : {}),
        });
        res.json({ success: true, data: mapProfile(updated) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PUT /api/auth/profile – update current admin profile */
  router.put(
    '/profile',
    auth,
    anyRole,
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
          const isValid = await container.passwordHasher.compare(currentPassword, admin.passwordHash);
          if (!isValid) {
            res.status(400).json({ success: false, error: 'Current password is incorrect' });
            return;
          }
          // The shared rules were enforced by the zod schema; this adds "differs from current".
          await assertPasswordAcceptable(container.passwordHasher, newPassword, {
            currentHash: admin.passwordHash,
          });
          updateData.passwordHash = await container.passwordHasher.hash(newPassword);
          updateData.mustResetPassword = false;
        }

        const updated = await container.prisma.admin.update({
          where: { id: req.adminId! },
          data: updateData,
        });

        await logAuthAction(container, req.adminId!, 'update_profile', {
          ...(email !== undefined ? { emailChanged: true } : {}),
          ...(newPassword ? { passwordChanged: true } : {}),
        });

        res.json({ success: true, data: mapProfile(updated) });
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
