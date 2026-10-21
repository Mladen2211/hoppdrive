import { Router, Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';

/**
 * Resource names written by the audit middleware, grouped for the filter chips of the
 * activity log (Alle / Buchungen / Inhalte / Benutzer ...). The UI can combine categories
 * (?category=content,fleet,settings) or filter by raw resource (?resource=vehicle,invoice).
 */
const CATEGORY_RESOURCES = {
  bookings: ['booking', 'contact-request', 'invoice', 'fine'],
  fleet: ['vehicle', 'maintenance', 'pricing-rule', 'vehicle-damage', 'inspection'],
  content: ['homepage-section', 'testimonial', 'faq', 'location'],
  settings: ['setting', 'email', 'fee', 'contract-template', 'legal-document'],
  users: ['admin', 'auth'],
} as const;

type KnownCategory = keyof typeof CATEGORY_RESOURCES;
type Category = KnownCategory | 'other';

const ALL_KNOWN_RESOURCES: string[] = Object.values(CATEGORY_RESOURCES).flat();

function categoryOf(resource: string): Category {
  for (const [category, resources] of Object.entries(CATEGORY_RESOURCES)) {
    if ((resources as readonly string[]).includes(resource)) return category as KnownCategory;
  }
  return 'other';
}

function csvList(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Builds the Prisma filter from ?adminId=&resource=a,b&category=x,y */
function buildWhere(query: Request['query']): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (typeof query.adminId === 'string' && query.adminId) where.adminId = query.adminId;

  const resources = new Set(csvList(query.resource));
  let includeOther = false;
  for (const category of csvList(query.category)) {
    if (category === 'other') includeOther = true;
    else if (category in CATEGORY_RESOURCES) {
      for (const r of CATEGORY_RESOURCES[category as KnownCategory]) resources.add(r);
    }
  }

  if (resources.size > 0 && includeOther) {
    where.OR = [{ resource: { in: Array.from(resources) } }, { resource: { notIn: ALL_KNOWN_RESOURCES } }];
  } else if (resources.size > 0) {
    where.resource = { in: Array.from(resources) };
  } else if (includeOther) {
    where.resource = { notIn: ALL_KNOWN_RESOURCES };
  }
  return where;
}

function parseDetails(details: string | null): Record<string, unknown> | string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : details;
  } catch {
    return details;
  }
}

const adminSelect = { id: true, name: true, firstName: true, lastName: true, email: true } as const;

/** Prevents spreadsheet formula injection: values that start like a formula are prefixed with '. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function auditLogRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const users = access.requirePermission('users'); // activity log is part of "Benutzer und Rollen"

  /**
   * GET /api/audit-logs?resource=&category=&adminId=&page=&pageSize=
   * → { items: [{ id, action, resource, resourceId, category, details, createdAt, admin }], total, page, pageSize, totalPages }
   */
  router.get('/', auth, users, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
      const where = buildWhere(req.query);

      const [rows, total] = await Promise.all([
        container.prisma.auditLog.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: { admin: { select: adminSelect } },
        }),
        container.prisma.auditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          items: rows.map((r) => ({
            id: r.id,
            action: r.action,
            resource: r.resource,
            resourceId: r.resourceId,
            category: categoryOf(r.resource),
            details: parseDetails(r.details),
            createdAt: r.createdAt,
            admin: r.admin,
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/audit-logs/export.csv – same filters, newest first (max 10'000 rows).
   * `;` separated, UTF-8 with BOM so Excel opens umlauts correctly, German headers.
   */
  router.get('/export.csv', auth, users, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.auditLog.findMany({
        where: buildWhere(req.query),
        take: 10_000,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: adminSelect } },
      });

      const timeZone = process.env.APP_TIMEZONE || 'Europe/Zurich';
      const fmt = new Intl.DateTimeFormat('de-CH', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const header = ['Zeitpunkt', 'Benutzer', 'E-Mail', 'Aktion', 'Bereich', 'Objekt-ID', 'Details'];
      const lines = [header.map(csvCell).join(';')];
      for (const r of rows) {
        lines.push(
          [
            fmt.format(r.createdAt),
            r.admin.name,
            r.admin.email,
            r.action,
            r.resource,
            r.resourceId ?? '',
            r.details ?? '',
          ]
            .map(csvCell)
            .join(';'),
        );
      }

      const today = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aktivitaetsprotokoll-${today}.csv"`);
      res.send('﻿' + lines.join('\r\n') + '\r\n');
    } catch (err) {
      next(err);
    }
  });

  return router;
}
