import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import type { Prisma } from '@prisma/client';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { describeDiscountCode } from '../middleware/auditDescribers';
import { validate, createDiscountCodeSchema, updateDiscountCodeSchema } from '../validators';
import { DiscountService, normalizeDiscountCode, DISCOUNT_REASON_MESSAGES } from '../../infrastructure/services/DiscountService';
import { AppError } from '../../application/errors';
import { resolveDateInput } from '../helpers/dates';

// Public validation is a guessing target for codes: limit it per IP.
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

/** Reasons that must not reveal that a personal code exists. */
const PUBLIC_MASKED_REASONS = new Set(['wrong_recipient', 'inactive']);

export function discountCodeRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const marketing = access.requirePermission('marketing');
  const prisma = container.prisma;
  const discounts = container.discountService;

  /**
   * GET /api/discount-codes/validate?code=&email=&vehicleId=&days= – PUBLIC (rate limited).
   * Used live by the inquiry form. With vehicleId + days the discount is computed on the real price.
   * → { valid, type, value, currency, discount, total, totalAfterDiscount, reason, message }
   *   reason (when invalid): not_found | inactive | not_started | expired | exhausted | email_limit |
   *   min_days | wrong_recipient | email_required | currency_mismatch
   * Personal codes answer 'not_found' for other addresses, so existing codes cannot be probed.
   */
  router.get('/validate', validateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = normalizeDiscountCode(String(req.query.code ?? ''));
      const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : '';
      const days = Number(req.query.days);
      if (!code || code.length > 40) {
        res.json({ success: true, data: { valid: false, reason: 'not_found', message: DISCOUNT_REASON_MESSAGES.not_found } });
        return;
      }

      // Price the rental to compute the discount amount.
      let baseTotal = 0;
      let currency = await container.settingsService.getCurrency();
      let priced = false;
      if (vehicleId && Number.isFinite(days) && days >= 1 && days <= 365) {
        try {
          const pricing = await container.calculatePricing.execute({ vehicleId, totalDays: Math.floor(days) });
          baseTotal = pricing.totalPrice.amount;
          currency = pricing.totalPrice.currency as typeof currency;
          priced = true;
        } catch {
          /* unknown vehicle: validate the code without an amount */
        }
      }

      const check = await discounts.check({
        code,
        email: email || null,
        days: Number.isFinite(days) && days >= 1 ? Math.floor(days) : 1,
        baseTotal,
        currency,
      });

      if (!check.valid) {
        // Hide the reason for codes that exist but are not meant for this visitor.
        const reason = PUBLIC_MASKED_REASONS.has(check.reason!) ? 'not_found' : check.reason!;
        res.json({ success: true, data: { valid: false, reason, message: DISCOUNT_REASON_MESSAGES[reason] } });
        return;
      }

      const c = check.code!;
      res.json({
        success: true,
        data: {
          valid: true,
          type: c.type,
          value: Number(c.value),
          currency: c.type === 'FIXED' ? c.currency || currency : null,
          discount: priced ? check.discount : null,
          total: priced ? baseTotal : null,
          totalAfterDiscount: priced ? Math.round((baseTotal - check.discount) * 100) / 100 : null,
          minDays: c.minDays,
          validUntil: c.validUntil,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/discount-codes?q=&status=&campaignId=&page=&pageSize= – list (marketing: view) */
  router.get('/', auth, marketing, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 200);
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const where: Prisma.DiscountCodeWhereInput = {
        ...(q ? { OR: [{ code: { contains: q.toUpperCase() } }, { label: { contains: q, mode: 'insensitive' } }, { recipientEmail: { contains: q.toLowerCase() } }] } : {}),
        ...(typeof req.query.campaignId === 'string' ? { campaignId: req.query.campaignId } : {}),
        // The per-recipient codes generated by PERSONAL campaigns can be thousands: hidden unless asked for
        // (?personal=true shows everything, ?personal=only just those). Manually created codes always show.
        ...(req.query.personal === 'true'
          ? {}
          : req.query.personal === 'only'
            ? { campaignId: { not: null }, recipientEmail: { not: null } }
            : { NOT: { campaignId: { not: null }, recipientEmail: { not: null } } }),
      };
      const [rows, total] = await Promise.all([
        prisma.discountCode.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { _count: { select: { redemptions: true } } },
        }),
        prisma.discountCode.count({ where }),
      ]);
      let items = rows.map((r) => mapCode(r, r._count.redemptions));
      const status = typeof req.query.status === 'string' ? req.query.status : '';
      if (status) items = items.filter((i) => i.status === status);
      res.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/discount-codes/:id – one code incl. its redemptions (marketing: view) */
  router.get('/:id', auth, marketing, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await prisma.discountCode.findUnique({
        where: { id: req.params.id },
        include: {
          _count: { select: { redemptions: true } },
          redemptions: {
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
              booking: { select: { id: true, customerName: true, status: true, totalPrice: true, currency: true } },
              contactRequest: { select: { id: true, fullName: true } },
            },
          },
        },
      });
      if (!row) throw new AppError('Rabattcode nicht gefunden.', 404, 'not_found');
      res.json({
        success: true,
        data: {
          ...mapCode(row, row._count.redemptions),
          redemptions: row.redemptions.map((r) => ({
            id: r.id,
            email: r.email,
            amount: Number(r.amount),
            createdAt: r.createdAt,
            bookingId: r.bookingId,
            bookingStatus: r.booking?.status ?? null,
            contactRequestId: r.contactRequestId,
            customerName: r.booking?.customerName ?? r.contactRequest?.fullName ?? null,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/discount-codes – create (marketing: edit). `code` is generated (HD-XXXX-XXXX) when omitted. */
  router.post(
    '/',
    auth,
    marketing,
    validate(createDiscountCodeSchema),
    audit('discount-code', 'create'),
    async (req: Request & { adminId?: string }, res: Response, next: NextFunction) => {
      try {
        const b = req.body;
        const code = b.code || (await discounts.uniqueCode());
        if (await prisma.discountCode.findUnique({ where: { code }, select: { id: true } })) {
          throw new AppError('Dieser Rabattcode existiert bereits.', 409, 'code_taken');
        }
        const validFrom = resolveDateInput(b.validFrom, 'start');
        const validUntil = resolveDateInput(b.validUntil, 'end');
        if (validFrom && validUntil && validUntil < validFrom) {
          throw new AppError('Das Enddatum liegt vor dem Startdatum.', 422, 'invalid_period', undefined, {
            validUntil: ['Das Enddatum liegt vor dem Startdatum.'],
          });
        }
        const row = await prisma.discountCode.create({
          data: {
            code,
            label: b.label?.trim() || null,
            type: b.type,
            value: b.value,
            currency: b.type === 'FIXED' ? b.currency ?? (await container.settingsService.getCurrency()) : null,
            validFrom: validFrom ?? null,
            validUntil: validUntil ?? null,
            maxRedemptions: b.maxRedemptions ?? null,
            perEmailLimit: b.perEmailLimit ?? 1,
            minDays: b.minDays ?? null,
            active: b.active ?? true,
            recipientEmail: b.recipientEmail ?? null,
            createdById: req.adminId ?? null,
          },
        });
        setAuditDetails(
          res,
          { code: row.code, discount: DiscountService.describe(row), personal: !!row.recipientEmail },
          row.id,
        );
        res.status(201).json({ success: true, data: mapCode(row, 0) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** PATCH /api/discount-codes/:id – edit (marketing: edit). The code text can only change before its first redemption. */
  router.patch(
    '/:id',
    auth,
    marketing,
    validate(updateDiscountCodeSchema),
    audit('discount-code', 'update', describeDiscountCode(container, (req) => ({ fields: Object.keys(req.body ?? {}) }))),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const b = req.body;
        const existing = await prisma.discountCode.findUnique({
          where: { id: req.params.id },
          include: { _count: { select: { redemptions: true } } },
        });
        if (!existing) throw new AppError('Rabattcode nicht gefunden.', 404, 'not_found');

        if (b.code !== undefined && b.code !== existing.code) {
          if (existing._count.redemptions > 0) {
            throw new AppError('Der Code kann nach der ersten Einlösung nicht mehr geändert werden.', 409, 'code_locked');
          }
          if (await prisma.discountCode.findUnique({ where: { code: b.code }, select: { id: true } })) {
            throw new AppError('Dieser Rabattcode existiert bereits.', 409, 'code_taken');
          }
        }
        const validFrom = resolveDateInput(b.validFrom, 'start');
        const validUntil = resolveDateInput(b.validUntil, 'end');
        const nextFrom = validFrom === undefined ? existing.validFrom : validFrom;
        const nextUntil = validUntil === undefined ? existing.validUntil : validUntil;
        if (nextFrom && nextUntil && nextUntil < nextFrom) {
          throw new AppError('Das Enddatum liegt vor dem Startdatum.', 422, 'invalid_period', undefined, {
            validUntil: ['Das Enddatum liegt vor dem Startdatum.'],
          });
        }
        const nextType = b.type ?? existing.type;
        const nextValue = b.value ?? Number(existing.value);
        if (nextType === 'PERCENT' && nextValue > 100) {
          throw new AppError('Ein Prozentrabatt kann höchstens 100 % betragen.', 422, 'invalid_value');
        }

        const row = await prisma.discountCode.update({
          where: { id: existing.id },
          data: {
            ...(b.code !== undefined && { code: b.code }),
            ...(b.label !== undefined && { label: b.label?.trim() || null }),
            ...(b.type !== undefined && { type: b.type }),
            ...(b.value !== undefined && { value: b.value }),
            ...((b.currency !== undefined || b.type !== undefined) && {
              currency: nextType === 'FIXED' ? (b.currency ?? existing.currency ?? (await container.settingsService.getCurrency())) : null,
            }),
            ...(validFrom !== undefined && { validFrom }),
            ...(validUntil !== undefined && { validUntil }),
            ...(b.maxRedemptions !== undefined && { maxRedemptions: b.maxRedemptions }),
            ...(b.perEmailLimit !== undefined && { perEmailLimit: b.perEmailLimit }),
            ...(b.minDays !== undefined && { minDays: b.minDays }),
            ...(b.active !== undefined && { active: b.active }),
            ...(b.recipientEmail !== undefined && { recipientEmail: b.recipientEmail }),
          },
          include: { _count: { select: { redemptions: true } } },
        });
        setAuditDetails(res, { code: row.code, ...(b.active !== undefined ? { active: row.active } : {}) });
        res.json({ success: true, data: mapCode(row, row._count.redemptions) });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /api/discount-codes/:id – only codes without redemptions can be deleted (marketing: edit) */
  router.delete(
    '/:id',
    auth,
    marketing,
    audit('discount-code', 'delete', describeDiscountCode(container)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await prisma.discountCode.findUnique({
          where: { id: req.params.id },
          include: { _count: { select: { redemptions: true } } },
        });
        if (!existing) throw new AppError('Rabattcode nicht gefunden.', 404, 'not_found');
        if (existing._count.redemptions > 0) {
          throw new AppError(
            'Der Code wurde bereits eingelöst und kann nicht gelöscht werden. Deaktivieren Sie ihn stattdessen.',
            409,
            'has_redemptions',
          );
        }
        await prisma.discountCode.delete({ where: { id: existing.id } });
        res.json({ success: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

function mapCode(
  r: {
    id: string;
    code: string;
    label: string | null;
    type: 'PERCENT' | 'FIXED';
    value: Prisma.Decimal;
    currency: string | null;
    validFrom: Date | null;
    validUntil: Date | null;
    maxRedemptions: number | null;
    perEmailLimit: number;
    minDays: number | null;
    active: boolean;
    campaignId: string | null;
    recipientEmail: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  redemptionCount: number,
) {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    type: r.type,
    value: Number(r.value),
    currency: r.currency,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    maxRedemptions: r.maxRedemptions,
    perEmailLimit: r.perEmailLimit,
    minDays: r.minDays,
    active: r.active,
    campaignId: r.campaignId,
    recipientEmail: r.recipientEmail,
    isPersonal: !!r.recipientEmail,
    redemptionCount,
    status: DiscountService.status(r, redemptionCount),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
