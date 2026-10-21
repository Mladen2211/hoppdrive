import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, diffFields, setAuditDetails } from '../middleware/auditMiddleware';

const PUBLIC_CACHE_KEY = 'locations:public';
const PUBLIC_CACHE_TTL_SECONDS = 300;

/** Trims free text; empty string becomes null so a field can be cleared. */
function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function locationRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const contentView = access.requirePermission('content', 'view');
  const contentEdit = access.requirePermission('content', 'edit');

  const invalidatePublic = () => container.cacheService.deleteByPattern('locations:*');

  /**
   * GET /api/locations/public – Public: active locations only, no booking counts.
   * Declared BEFORE '/:id' so "public" is never captured as an id.
   */
  router.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await container.cacheService.get<unknown[]>(PUBLIC_CACHE_KEY);
      if (cached) {
        res.json({ success: true, data: cached });
        return;
      }

      const rows = await container.prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          address: true,
          zip: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          openingHours: true,
        },
      });
      await container.cacheService.set(PUBLIC_CACHE_KEY, rows, PUBLIC_CACHE_TTL_SECONDS);
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/locations – List all locations (content: view) */
  router.get('/', auth, contentView, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const locations = await container.prisma.location.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { bookings: true } },
        },
      });
      res.json({ success: true, data: locations });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/locations/:id – Get single location (content: view) */
  router.get('/:id', auth, contentView, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const location = await container.prisma.location.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { bookings: true } } },
      });
      if (!location) {
        res.status(404).json({ success: false, error: 'Location not found' });
        return;
      }
      res.json({ success: true, data: location });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/locations – Create location (content: edit) */
  router.post(
    '/',
    auth,
    contentEdit,
    audit('location', 'create', (req) => ({ name: req.body?.name })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, address, zip, city, country, phone, email, openingHours } = req.body;
        if (!name || !address || !zip || !city) {
          res.status(400).json({ success: false, error: 'name, address, zip, city are required' });
          return;
        }
        const location = await container.prisma.location.create({
          data: {
            name,
            address,
            zip,
            city,
            country: country || 'CH',
            phone,
            email,
            openingHours: nullableText(openingHours) ?? null,
          },
        });
        await invalidatePublic();
        setAuditDetails(res, { name: location.name }, location.id);
        res.status(201).json({ success: true, data: location });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/locations/:id – Update location (content: edit) */
  router.patch(
    '/:id',
    auth,
    contentEdit,
    audit('location', 'update', async (req) => {
      const before = await container.prisma.location.findUnique({ where: { id: req.params.id } });
      if (!before) return undefined;
      const body = req.body ?? {};
      const changes = diffFields(before as unknown as Record<string, unknown>, {
        name: body.name,
        address: body.address,
        zip: body.zip,
        city: body.city,
        country: body.country,
        phone: body.phone,
        email: body.email,
        openingHours: nullableText(body.openingHours),
        isActive: body.isActive,
      });
      return { name: before.name, changes: changes.map((c) => c.field) };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, address, zip, city, country, phone, email, openingHours, isActive } = req.body;
        const hours = nullableText(openingHours);
        const location = await container.prisma.location.update({
          where: { id: req.params.id },
          data: {
            ...(name !== undefined && { name }),
            ...(address !== undefined && { address }),
            ...(zip !== undefined && { zip }),
            ...(city !== undefined && { city }),
            ...(country !== undefined && { country }),
            ...(phone !== undefined && { phone }),
            ...(email !== undefined && { email }),
            ...(hours !== undefined && { openingHours: hours }),
            ...(isActive !== undefined && { isActive }),
          },
        });
        await invalidatePublic();
        res.json({ success: true, data: location });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/locations/:id – Delete location (content: edit) */
  router.delete(
    '/:id',
    auth,
    contentEdit,
    audit('location', 'delete', async (req) => {
      const before = await container.prisma.location.findUnique({
        where: { id: req.params.id },
        select: { name: true },
      });
      return { name: before?.name };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await container.prisma.location.delete({ where: { id: req.params.id } });
        await invalidatePublic();
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
