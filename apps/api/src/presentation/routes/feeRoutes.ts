import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { validate, createFeeSchema, updateFeeSchema } from '../validators';
import { AppError } from '../../application/errors';

export function mapFee(f: any) {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    defaultAmount: Number(f.defaultAmount),
    vatRate: f.vatRate === null || f.vatRate === undefined ? null : Number(f.vatRate),
    active: f.active,
  };
}

/** Fees every installation starts with (amounts in the active currency; editable under Einstellungen → Gebühren). */
const DEFAULT_FEES = [
  { name: 'Bearbeitungsgebühr Busse', category: 'FINE_ADMIN', defaultAmount: 50 },
  { name: 'Reinigung', category: 'CLEANING', defaultAmount: 80 },
  { name: 'Tankservice', category: 'FUEL', defaultAmount: 30 },
  { name: 'Verspätete Rückgabe', category: 'LATE_RETURN', defaultAmount: 50 },
  { name: 'Schadenpauschale', category: 'DAMAGE', defaultAmount: 150 },
  { name: 'Selbstbehalt (Schadenfall)', category: 'DAMAGE', defaultAmount: 500 },
] as const;

/**
 * Seeds the default fee catalog once: only when the catalog is empty, so fees an admin deleted or renamed are never
 * brought back. Idempotent (safe to run on every start). Returns the number of fees created.
 */
export async function ensureDefaultFees(prisma: PrismaClient): Promise<number> {
  if ((await prisma.fee.count()) > 0) return 0;
  const result = await prisma.fee.createMany({ data: DEFAULT_FEES.map((f) => ({ ...f })) });
  return result.count;
}

/**
 * Fee catalog (Gebühren): reusable invoice lines such as "Reinigung" or "Bearbeitungsgebühr Busse".
 *   GET    /fees[?active=1]   websiteSettings, contracts or fines (view)
 *   POST   /fees              websiteSettings (edit)   { name, category?, defaultAmount, vatRate?, active? }
 *   PATCH  /fees/:id          websiteSettings (edit)   any subset
 *   DELETE /fees/:id          websiteSettings (edit)   invoice lines keep their text (the link is cleared)
 */
export function feeRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const prisma = container.prisma;
  // Reading the catalog is needed wherever invoices / fines are created; changing it is a settings task.
  const readFees = access.requireAnyPermission([
    { area: 'websiteSettings', level: 'view' },
    { area: 'contracts', level: 'view' },
    { area: 'fines', level: 'view' },
  ]);
  const editFees = access.requirePermission('websiteSettings', 'edit');

  const describeFee = async (req: Request) => {
    const fee = await prisma.fee.findUnique({ where: { id: req.params.id }, select: { name: true, defaultAmount: true } });
    return { fee: fee?.name, amount: fee ? Number(fee.defaultAmount) : undefined };
  };

  router.get('/', auth, readFees, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const onlyActive = req.query.active === '1' || req.query.active === 'true';
      const rows = await prisma.fee.findMany({
        where: onlyActive ? { active: true } : {},
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      res.json({ success: true, data: rows.map(mapFee) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', auth, editFees, validate(createFeeSchema), audit('fee', 'create'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const fee = await prisma.fee.create({
        data: {
          name: b.name,
          category: b.category ?? 'OTHER',
          defaultAmount: b.defaultAmount,
          vatRate: b.vatRate ?? null,
          active: b.active ?? true,
        },
      });
      setAuditDetails(res, { fee: fee.name, amount: Number(fee.defaultAmount) }, fee.id);
      res.status(201).json({ success: true, data: mapFee(fee) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', auth, editFees, validate(updateFeeSchema), audit('fee', 'update', describeFee), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.fee.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError('Fee not found', 404);
      const b = req.body;
      const data: Record<string, unknown> = {};
      for (const key of ['name', 'category', 'defaultAmount', 'vatRate', 'active'] as const) {
        if (b[key] !== undefined) data[key] = b[key];
      }
      const fee = await prisma.fee.update({ where: { id: existing.id }, data });
      setAuditDetails(res, { fields: Object.keys(b), newAmount: Number(fee.defaultAmount) });
      res.json({ success: true, data: mapFee(fee) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', auth, editFees, audit('fee', 'delete', describeFee), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.fee.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!existing) throw new AppError('Fee not found', 404);
      await prisma.fee.delete({ where: { id: existing.id } });
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
