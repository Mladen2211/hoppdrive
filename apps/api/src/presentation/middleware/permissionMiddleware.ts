/**
 * Role-based access control for the admin API.
 *
 * Authentication (Bearer JWT -> req.adminId) is done by authMiddleware; this module adds
 * authorisation on top. The matrix lives in @hoppdrive/shared (PERMISSIONS) and is shared
 * with the admin UI. Each request loads the admin's role from the DB through a ~30 s
 * in-memory cache, so a role change or removal takes effect within 30 s (immediately in
 * this process, because the admin routes call invalidateAdminAccess()).
 *
 * HTTP method -> required level: GET/HEAD/OPTIONS = 'view', everything else = 'edit'.
 * Denied: 403 { success:false, error:'forbidden' }. Unknown/deleted admin: 401.
 *
 * ROUTE -> AREA MAPPING
 *   any authenticated admin (no area):
 *     GET  /dashboard                    stats only (counts and revenue)
 *     GET  /notifications, PATCH /notifications/*   (own notifications)
 *     GET  /auth/profile, PUT /auth/profile, PUT /auth/profile/signature (draw or upload),
 *          PUT /auth/profile/preferences (language + theme), POST /auth/reset-password
 *     GET  /search                       result groups are filtered per role (vehicles: fleet,
 *                                        bookings: contracts|calendar, inquiries: inquiries,
 *                                        invoices: contracts, locations: content)
 *     GET  /pricing/rules                (read-only tiers; mutations need websiteSettings)
 *     GET  /settings                     (list; the public GET /settings/:key stays open)
 *     SSE  /events?token=                (token query auth, unchanged)
 *   inquiries        /contact (GET, PATCH :id/status, POST :id/approve, POST :id/deny)
 *   contracts        /invoices/**, /bookings/:id/contract-preview, /bookings/:id/download-contract,
 *                    PATCH /bookings/:id, PATCH /bookings/:id/status, POST /bookings/:id/finalize-contract
 *   contracts|calendar  GET /bookings (list: the calendar renders bookings),
 *                       POST /bookings (create: needs edit on either)
 *   calendar|fleet   GET /maintenance, GET /vehicles/admin/all (view on either)
 *   fleet            POST/PATCH/DELETE /vehicles/**, POST/DELETE /maintenance
 *   reports          GET /reports/summary, GET /bookings/report
 *   content          GET /faq/all, /testimonials/all, /homepage-sections/all, GET /locations/**
 *                    and all their mutations (faq, testimonials, homepage-sections, locations)
 *   websiteSettings  PUT /settings/:key, POST/PATCH/DELETE /pricing/rules/**
 *   users            /admins/**, /audit-logs/** (incl. the CSV export)
 *   websiteSettings  also /email/** (status, log, resend, test), /contract-templates/** (upload, starter, preview,
 *                    activate, delete), PUT|DELETE /legal/agb, GET /legal/agb/info, /fees mutations
 *   contracts|websiteSettings|fines  GET /fees (the catalog is read where invoices / fines are created)
 *   marketing        /customers, /discount-codes (CRUD), /marketing/campaigns/** (GET = view, POST = edit)
 *   damages          /vehicles/:vehicleId/damages/**, /damages/:id/photos, GET /damages/photos/:photoId (also ?token=),
 *                    /bookings/:id/inspections, GET /inspections/:id/report.pdf
 *   fines            /fines/** (lookup, CRUD, document, assign, driver-export.pdf, notify, invoice)
 *   contracts        also POST /bookings/:id/send-contract-package, GET /bookings/:id/contract-draft.pdf
 *   fleet            also PATCH /vehicles/:id/images/:imageId/primary, PUT /vehicles/:id/images/order
 *   contracts|calendar  also GET /bookings/:id
 *
 * Public (no auth): GET /vehicles, /vehicles/:id, /pricing, /pricing/tiers, /locations/public,
 *   /faq, /testimonials, /homepage-sections, /settings/:key (all with ?locale=), /legal/*, POST /contact,
 *   GET /discount-codes/validate (rate limited), GET|POST /marketing/unsubscribe,
 *   /auth/login|refresh|logout|forgot-password|accept-invite|reset-password-token and the
 *   GET token lookups under /auth.
 */
import type { PrismaClient } from '@prisma/client';
import type { Response, NextFunction } from 'express';
import { can, type AdminRole, type PermissionArea, type PermissionLevel } from '@hoppdrive/shared';
import type { AuthenticatedRequest } from './authMiddleware';

const CACHE_TTL_MS = 30_000;

interface AccessEntry {
  role: AdminRole;
  active: boolean;
  expiresAt: number;
}

const cache = new Map<string, AccessEntry>();

/** Drops the cached role of an admin (call after role change / removal). */
export function invalidateAdminAccess(adminId?: string): void {
  if (adminId) cache.delete(adminId);
  else cache.clear();
}

export function levelForMethod(method: string): PermissionLevel {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'view' : 'edit';
}

export interface AreaRequirement {
  area: PermissionArea;
  /** Defaults to the level implied by the HTTP method. */
  level?: PermissionLevel;
}

export function createPermissionMiddleware(prisma: PrismaClient) {
  async function loadAccess(adminId: string): Promise<AccessEntry | null> {
    const hit = cache.get(adminId);
    if (hit && hit.expiresAt > Date.now()) return hit;

    const row = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { role: true, deletedAt: true, inviteTokenHash: true },
    });
    if (!row) {
      cache.delete(adminId);
      return null;
    }
    const entry: AccessEntry = {
      role: row.role as AdminRole,
      active: row.deletedAt === null && row.inviteTokenHash === null,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    cache.set(adminId, entry);
    return entry;
  }

  /** Resolves the caller's role, or answers 401 and returns null. */
  async function resolveRole(req: AuthenticatedRequest, res: Response): Promise<AdminRole | null> {
    if (!req.adminId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return null;
    }
    const access = await loadAccess(req.adminId);
    if (!access || !access.active) {
      res.status(401).json({ success: false, error: 'Account disabled' });
      return null;
    }
    return access.role;
  }

  const forbidden = (res: Response) =>
    res.status(403).json({ success: false, error: 'forbidden' });

  /** Allows when the caller has at least `level` on ANY of the given areas. */
  function requireAnyPermission(requirements: AreaRequirement[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const role = await resolveRole(req, res);
        if (!role) return;
        const fallback = levelForMethod(req.method);
        const allowed = requirements.some((r) => can(role, r.area, r.level ?? fallback));
        if (!allowed) {
          forbidden(res);
          return;
        }
        (req as AuthenticatedRequest & { adminRole?: AdminRole }).adminRole = role;
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /** Allows when the caller has at least `level` (default: by HTTP method) on `area`. */
  function requirePermission(area: PermissionArea, level?: PermissionLevel) {
    return requireAnyPermission([{ area, level }]);
  }

  /** Any authenticated, active admin of any role. */
  function requireAnyRole() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const role = await resolveRole(req, res);
        if (!role) return;
        (req as AuthenticatedRequest & { adminRole?: AdminRole }).adminRole = role;
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /** For handlers that filter their output by role (e.g. global search). */
  async function roleOf(adminId: string): Promise<AdminRole | null> {
    const access = await loadAccess(adminId);
    return access && access.active ? access.role : null;
  }

  return { requirePermission, requireAnyPermission, requireAnyRole, roleOf };
}

export type PermissionMiddleware = ReturnType<typeof createPermissionMiddleware>;
