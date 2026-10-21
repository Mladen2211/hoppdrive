import { Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { AuditLog } from '../../domain';
import type { IAuditLogRepository } from '../../domain';
import type { AuthenticatedRequest } from './authMiddleware';

/** Free-form, JSON-serialisable summary shown in the activity log. Never put secrets in it. */
export type AuditDetails = Record<string, unknown>;

/**
 * Computes structured details BEFORE the handler runs, so it can still read the old state
 * (e.g. the vehicle's previous price). May return undefined for "nothing to add".
 */
export type AuditDescriber = (req: AuthenticatedRequest) => Promise<AuditDetails | undefined> | AuditDetails | undefined;

/**
 * Handlers can add information that is only known after the work is done
 * (id of a created row, an invoice number, ...) via setAuditDetails(res, ...).
 */
export function setAuditDetails(res: Response, details: AuditDetails, resourceId?: string): void {
  res.locals.auditDetails = { ...(res.locals.auditDetails ?? {}), ...details };
  if (resourceId) res.locals.auditResourceId = resourceId;
}

/**
 * Creates middleware that logs admin actions for FADP compliance.
 *
 * The entry is written when the response has been sent and only for successful (< 400)
 * requests, so the activity log never shows actions that did not actually happen.
 * `details` is a small JSON object: { method, path, ...describe(req), ...setAuditDetails() }.
 * Request bodies are deliberately never logged (passwords, signatures, ...).
 */
export function createAuditMiddleware(auditLogRepo: IAuditLogRepository) {
  return (resource: string, action: string, describe?: AuditDescriber) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      const adminId = req.adminId;
      if (!adminId) {
        next();
        return;
      }

      let before: AuditDetails = {};
      if (describe) {
        try {
          before = (await describe(req)) ?? {};
        } catch (err) {
          console.error('[Audit] Failed to describe action:', err);
        }
      }

      const resourceIdFromRoute = req.params.id || null;

      res.on('finish', () => {
        if (res.statusCode >= 400) return;
        const after = (res.locals.auditDetails ?? {}) as AuditDetails;
        const resourceId = (res.locals.auditResourceId as string | undefined) ?? resourceIdFromRoute;
        void auditLogRepo
          .save(
            AuditLog.create({
              id: uuid(),
              adminId,
              action,
              resource,
              resourceId,
              details: JSON.stringify({
                method: req.method,
                path: req.originalUrl.split('?')[0],
                ...before,
                ...after,
              }),
            }),
          )
          .catch((err) => console.error('[Audit] Failed to log:', err));
      });

      next();
    };
  };
}

export type AuditMiddlewareFactory = ReturnType<typeof createAuditMiddleware>;

/** Display label used in audit details, e.g. "Škoda Kodiaq". */
export function vehicleLabel(v: { brand?: string | null; model?: string | null } | null | undefined): string | undefined {
  if (!v) return undefined;
  return [v.brand, v.model].filter(Boolean).join(' ') || undefined;
}

/**
 * Compares old and new values and returns only the fields that changed:
 * [{ field: 'basePricePerDay', from: 79, to: 89 }]. Used for "hat Preise ... geändert (79.00 → 89.00)".
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { field: string; from: unknown; to: unknown }[] {
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const field of Object.keys(after)) {
    if (after[field] === undefined) continue;
    const from = normalise(before[field]);
    const to = normalise(after[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, from, to });
  }
  return changes;
}

function normalise(value: unknown): unknown {
  // Prisma Decimal / Money-like values arrive as objects with toString or amount
  if (value && typeof value === 'object') {
    const v = value as { amount?: unknown; toNumber?: () => number };
    if (typeof v.toNumber === 'function') return v.toNumber();
    if (typeof v.amount === 'number') return v.amount;
  }
  if (typeof value === 'string') return value.trim();
  return value ?? null;
}

