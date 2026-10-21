import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { localizeSetting, parseLocale, sanitizeTranslations } from '../../application/i18n/localeMerge';
import { isQrIban, isValidIban, normalizeIban } from '../../domain/services/Iban';
import { CURRENCY_CODES } from '../../infrastructure/services/SettingsService';

/**
 * Keys that are NOT served by the public GET /settings/:key unless the caller sends a valid
 * admin token. Everything else (seo, pricing, features, location, company, notifications,
 * maintenance_mode, currency, ...) stays publicly readable exactly as before.
 */
const PRIVATE_SETTING_KEYS = new Set(['invoice_settings']);

function isPrivateSettingKey(key: string): boolean {
  return PRIVATE_SETTING_KEYS.has(key) || key.startsWith('private_') || key.startsWith('secret_');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Light shape checks for the keys the backend itself reads or the website acts on.
 * Returns per-field messages, or null when the value is acceptable. Other keys are unchecked
 * (except the shared `i18n` sub-key, which every object-valued setting may carry).
 */
function validateSettingValue(key: string, value: any): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  const add = (field: string, message: string) => {
    (errors[`value.${field}`] ??= []).push(message);
  };
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const optionalString = (field: string, max: number, label = field) => {
    if (value[field] !== undefined && (typeof value[field] !== 'string' || value[field].length > max)) {
      add(field, `${label} must be a string (max ${max} characters)`);
    }
  };

  if (key === 'company') {
    if (!isObject) return { value: ['company must be an object'] };
    optionalString('name', 200);
    optionalString('phone', 50);
    optionalString('street', 120);
    optionalString('zip', 20);
    optionalString('city', 80);
    optionalString('country', 60);
    optionalString('uid', 40);
    if (value.inquiryEmail !== undefined) {
      const mail = typeof value.inquiryEmail === 'string' ? value.inquiryEmail.trim() : null;
      if (mail === null || (mail !== '' && !EMAIL_RE.test(mail))) {
        add('inquiryEmail', 'inquiryEmail must be empty or a valid email address');
      }
    }
  } else if (key === 'invoice_settings') {
    if (!isObject) return { value: ['invoice_settings must be an object'] };
    optionalString('uid', 40);
    optionalString('bankName', 120);
    if (value.vatRate !== undefined && (typeof value.vatRate !== 'number' || value.vatRate < 0 || value.vatRate > 100)) {
      add('vatRate', 'vatRate must be a number between 0 and 100');
    }
    if (value.dueDays !== undefined && (!Number.isInteger(value.dueDays) || value.dueDays < 1 || value.dueDays > 365)) {
      add('dueDays', 'dueDays must be a whole number between 1 and 365');
    }
    if (value.defaultWithQrBill !== undefined && typeof value.defaultWithQrBill !== 'boolean') {
      add('defaultWithQrBill', 'defaultWithQrBill must be a boolean');
    }
    if (value.iban !== undefined) {
      if (typeof value.iban !== 'string' || (value.iban.trim() !== '' && !isValidIban(value.iban))) {
        add('iban', 'IBAN ist ungültig');
      }
    }
    if (value.qrIban !== undefined) {
      if (typeof value.qrIban !== 'string' || (value.qrIban.trim() !== '' && !isQrIban(value.qrIban))) {
        add('qrIban', 'QR-IBAN ist ungültig (Schweizer IBAN mit Institutsnummer 30000-31999)');
      }
    }
  } else if (key === 'currency') {
    if (!isObject) return { value: ['currency must be an object like { "code": "CHF" }'] };
    if (typeof value.code !== 'string' || !(CURRENCY_CODES as readonly string[]).includes(value.code)) {
      add('code', `code must be one of: ${CURRENCY_CODES.join(', ')}`);
    }
  } else if (key === 'contract') {
    if (!isObject) return { value: ['contract must be an object'] };
    if (value.signerAdminId !== undefined && value.signerAdminId !== null && typeof value.signerAdminId !== 'string') {
      add('signerAdminId', 'signerAdminId must be an admin id or null');
    }
  } else if (key === 'notifications') {
    if (!isObject) return { value: ['notifications must be an object'] };
    if (value.emailOnInquiry !== undefined && typeof value.emailOnInquiry !== 'boolean') {
      add('emailOnInquiry', 'emailOnInquiry must be a boolean');
    }
  } else if (key === 'maintenance_mode') {
    if (!isObject) return { value: ['maintenance_mode must be an object'] };
    if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
      add('enabled', 'enabled must be a boolean');
    }
    if (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > 1000)) {
      add('message', 'message must be a string (max 1000 characters)');
    }
  }

  // Translations of the German texts: { i18n: { en: {...}, fr: {...} } }
  if (isObject && value.i18n !== undefined) {
    const result = sanitizeTranslations(value.i18n);
    if ('error' in result) add('i18n', result.error);
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function settingsRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);

  /**
   * GET /api/settings/:key[?locale=de|en|fr|it|hr] – Public: read a single setting (private keys need an admin token).
   * Without `locale` the stored value is returned as is (incl. the `i18n` sub-key, which the admin editor needs).
   * With `locale` the `i18n[locale]` texts are merged over the German value (German is the fallback) and `i18n` is removed.
   */
  router.get('/:key', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;

      if (isPrivateSettingKey(key)) {
        const header = req.headers.authorization;
        const isAdmin =
          !!header?.startsWith('Bearer ') && !!container.tokenService.verifyAccessToken(header.substring(7));
        if (!isAdmin) {
          res.json({ success: true, data: null });
          return;
        }
      }

      const row = await container.prisma.siteSetting.findUnique({
        where: { key },
      });
      const locale = parseLocale(req.query.locale);
      res.json({
        success: true,
        data: row ? (locale ? localizeSetting(row.value, locale) : row.value) : null,
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/settings – Admin: list all settings (any authenticated role) */
  router.get('/', auth, access.requireAnyRole(), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await container.prisma.siteSetting.findMany();
      const map: Record<string, any> = {};
      for (const r of rows) {
        map[r.key] = r.value;
      }
      res.json({ success: true, data: map });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PUT /api/settings/:key – Admin (websiteSettings: edit): upsert a setting.
   * Saving `currency` ({ code: 'CHF' | 'EUR' }) also sets Vehicle.currency of EVERY vehicle; existing
   * bookings and invoices keep their own currency, new ones use the active one.
   */
  router.put(
    '/:key',
    auth,
    access.requirePermission('websiteSettings', 'edit'),
    // Logs which key changed (never the value, which can be large); a few switches add their state.
    audit('setting', 'update', (req) => {
      const value = req.body?.value;
      const details: Record<string, unknown> = { key: req.params.key };
      if (req.params.key === 'maintenance_mode' && typeof value?.enabled === 'boolean') {
        details.enabled = value.enabled;
      }
      if (req.params.key === 'notifications' && typeof value?.emailOnInquiry === 'boolean') {
        details.emailOnInquiry = value.emailOnInquiry;
      }
      if (req.params.key === 'currency' && typeof value?.code === 'string') {
        details.currency = value.code;
      }
      if (value && typeof value === 'object' && value.i18n !== undefined) {
        details.translationsChanged = true;
      }
      return details;
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;
        const { value } = req.body;
        if (value === undefined) {
          res.status(400).json({ success: false, error: 'value is required' });
          return;
        }
        const invalid = validateSettingValue(key, value);
        if (invalid) {
          res.status(422).json({ success: false, error: 'Validation failed', details: invalid });
          return;
        }

        // Store IBANs normalised (no spaces, upper case).
        let stored = value;
        if (key === 'invoice_settings') {
          stored = { ...value };
          if (typeof stored.iban === 'string') stored.iban = normalizeIban(stored.iban);
          if (typeof stored.qrIban === 'string') stored.qrIban = normalizeIban(stored.qrIban);
        }
        if (key === 'currency') stored = { code: value.code };

        const row = await container.prisma.siteSetting.upsert({
          where: { key },
          update: { value: stored },
          create: { key, value: stored },
        });

        if (key === 'currency') {
          const updated = await container.prisma.vehicle.updateMany({ data: { currency: value.code } });
          await container.cacheService.deleteByPattern('vehicles:*');
          setAuditDetails(res, { vehiclesUpdated: updated.count }, key);
        } else {
          setAuditDetails(res, {}, key);
        }
        res.json({ success: true, data: row.value });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
