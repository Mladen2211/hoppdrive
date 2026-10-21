import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ADMIN_ROLES, APP_LOCALES, evaluatePassword } from '@hoppdrive/shared';

/**
 * Generic Zod validation middleware factory.
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!details[path]) details[path] = [];
        details[path].push(issue.message);
      });

      res.status(422).json({
        success: false,
        error: 'Validation failed',
        details,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// ─── Schemas ────────────────────────────────────────────────────

/**
 * Password rules shared with the admin UI (packages/shared): min 12 chars, upper + lower
 * case, digit. Each failed rule becomes one German message under the field.
 * "Different from the current password" needs the stored hash and is checked in the use cases.
 */
export const passwordSchema = z
  .string({ required_error: 'Passwort ist erforderlich' })
  .superRefine((value, ctx) => {
    for (const message of evaluatePassword(value).errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

const adminRoleSchema = z.enum(ADMIN_ROLES as unknown as [string, ...string[]]);

export const localeSchema = z.enum(APP_LOCALES as unknown as [string, ...string[]]);

/** Per-locale blobs for content with translations: { en: {...}, fr: {...} } (German lives in the columns). */
export const translationsSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .refine((v) => Object.keys(v).every((k) => ['en', 'fr', 'it', 'hr'].includes(k)), {
    message: 'Only en, fr, it and hr can be translated',
  })
  .refine((v) => JSON.stringify(v).length <= 200_000, { message: 'translations are too large' });

export const createVehicleSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  type: z.enum(['sedan', 'suv', 'estate', 'coupe', 'convertible', 'electric', 'van']),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 2),
  basePricePerDay: z.number().positive('Price must be positive'),
  description: z.string().max(5000).nullable().optional(),
  /** Free input, stored normalised (uppercase, no spaces / dots / dashes). '' or null clears it. */
  licensePlate: z.string().trim().max(20).nullable().optional(),
  translations: translationsSchema.nullable().optional(),
  specs: z.object({
    horsepower: z.number().int().min(0),
    transmission: z.enum(['automatic', 'manual']),
    seats: z.number().int().min(1).max(12),
    fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid']),
    range: z.string().optional(),
  }),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});

export const createContactRequestSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  vehicleOfInterest: z.string().optional(),
  desiredStartDate: z.string().datetime().optional(),
  desiredEndDate: z.string().datetime().optional(),
  message: z.string().min(1, 'Message is required'),
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: 'Privacy consent is required' }),
  }),
  marketingConsent: z.boolean().default(false),
  /** Website language of the visitor. */
  locale: localeSchema.optional(),
  /** Code from the inquiry form; validated live by GET /discount-codes/validate, applied on approval. */
  discountCode: z.string().trim().max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

export const resetPasswordWithTokenSchema = z.object({
  token: z.string().min(16).max(200),
  newPassword: passwordSchema,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(200),
  firstName: z.string().trim().min(1, 'Vorname ist erforderlich').max(80),
  lastName: z.string().trim().min(1, 'Nachname ist erforderlich').max(80),
  password: passwordSchema,
});

export const inviteAdminSchema = z.object({
  email: z.string().trim().email('Valid email is required').max(254),
  role: adminRoleSchema,
});

export const updateAdminRoleSchema = z.object({
  role: adminRoleSchema,
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});

export const updatePreferencesSchema = z
  .object({
    locale: localeSchema.optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  })
  .refine((v) => v.locale !== undefined || v.theme !== undefined, {
    message: 'locale or theme is required',
  });

/** Driver / renter details stored with a booking (contract + authority requests). '' or null clears a field. */
const driverFields = {
  customerPhone: z.string().trim().max(40).nullable().optional(),
  driverStreet: z.string().trim().max(120).nullable().optional(),
  driverZip: z.string().trim().max(20).nullable().optional(),
  driverCity: z.string().trim().max(80).nullable().optional(),
  driverCountry: z.string().trim().max(60).nullable().optional(),
  /** Calendar day, YYYY-MM-DD. */
  driverBirthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT')
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
    }, 'Ungültiges Geburtsdatum')
    .nullable()
    .optional(),
  driverLicenseNumber: z.string().trim().max(40).nullable().optional(),
  driverLicenseCountry: z.string().trim().max(60).nullable().optional(),
};

export const createBookingSchema = z.object({
  vehicleId: z.string().uuid(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Valid email is required').optional(),
  /** Pickup and return as ISO date-times (real times). */
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  /** Price before the discount; computed from the pricing rules when omitted. */
  totalPrice: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  locationId: z.string().uuid().optional(),
  customerLocale: localeSchema.optional(),
  /** Optional discount code, applied on top of the price. */
  discountCode: z.string().trim().max(40).optional(),
  ...driverFields,
});

export const updateBookingSchema = z.object({
  customerName: z.string().trim().min(1).max(200).optional(),
  customerEmail: z.string().trim().email('Valid email is required').nullable().optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  /** Final price override (e.g. after changing the dates). */
  totalPrice: z.number().nonnegative().optional(),
  /** Recompute the price from the pricing rules for the new dates (ignored when totalPrice is given). */
  recalculatePrice: z.boolean().optional(),
  locationId: z.string().uuid().nullable().optional(),
  customerLocale: localeSchema.nullable().optional(),
  ...driverFields,
});

export const transitionBookingStatusSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled']),
});

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.enum(['repair', 'accident', 'other']).default('other'),
  notes: z.string().optional(),
});

export const finalizeContractSchema = z.object({
  signature: z.string().min(1, 'Signature data is required'),
  customerEmail: z.string().email('Valid email is required').optional(),
});

export const pricingRuleSchema = z.object({
  fromDay: z.number().int().min(1, 'fromDay must be at least 1'),
  toDay: z.number().int().nullable(),
  discountPercent: z.number().min(0).max(100, 'discountPercent must be 0-100'),
});

export const pricingQuerySchema = z.object({
  vehicleId: z.string().uuid(),
  totalDays: z.number().int().positive(),
});

// ─── Discounts, marketing, e-mail ───────────────────────────────

/** YYYY-MM-DD or a full ISO date-time. Date-only input is resolved to the business day by the route. */
const dateInput = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT'),
  z.string().datetime({ offset: true }),
]);

const discountCodeText = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/, 'Nur Buchstaben, Ziffern, - und _ (3-32 Zeichen)');

const discountFields = {
  label: z.string().trim().max(120).nullable().optional(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().positive('Wert muss grösser als 0 sein').max(100000),
  currency: z.enum(['CHF', 'EUR']).nullable().optional(),
  validFrom: dateInput.nullable().optional(),
  validUntil: dateInput.nullable().optional(),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().optional(),
  perEmailLimit: z.number().int().min(1).max(1000).optional(),
  minDays: z.number().int().min(1).max(365).nullable().optional(),
  active: z.boolean().optional(),
  recipientEmail: z.string().trim().toLowerCase().email().nullable().optional(),
};

export const createDiscountCodeSchema = z
  .object({ code: discountCodeText.optional(), ...discountFields })
  .refine((v) => v.type !== 'PERCENT' || v.value <= 100, { path: ['value'], message: 'Ein Prozentrabatt kann höchstens 100 % betragen' });

export const updateDiscountCodeSchema = z
  .object({ code: discountCodeText.optional(), ...discountFields })
  .partial()
  .refine((v) => v.type !== 'PERCENT' || v.value === undefined || v.value <= 100, {
    path: ['value'],
    message: 'Ein Prozentrabatt kann höchstens 100 % betragen',
  });

const campaignCodeSchema = z.object({
  id: z.string().uuid().optional(),
  code: discountCodeText.optional(),
  label: z.string().trim().max(120).nullable().optional(),
  type: z.enum(['PERCENT', 'FIXED']).optional(),
  value: z.number().positive().max(100000).optional(),
  currency: z.enum(['CHF', 'EUR']).nullable().optional(),
  validFrom: dateInput.nullable().optional(),
  validUntil: dateInput.nullable().optional(),
  minDays: z.number().int().min(1).max(365).nullable().optional(),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().optional(),
  perEmailLimit: z.number().int().min(1).max(1000).optional(),
});

export const createCampaignSchema = z.object({
  subject: z.string().trim().min(1, 'Betreff ist erforderlich').max(200),
  message: z.string().trim().min(1, 'Nachricht ist erforderlich').max(5000),
  recipients: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('all') }),
    z.object({ mode: z.literal('selected'), emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(5000) }),
  ]),
  codeMode: z.enum(['NONE', 'SHARED', 'PERSONAL']),
  code: campaignCodeSchema.optional(),
});

export const unsubscribeSchema = z.object({
  token: z.string().min(16).max(100),
});

export const sendTestEmailSchema = z.object({
  to: z.string().trim().email('Gültige E-Mail-Adresse erforderlich').max(254),
});

// ─── Invoices (line items, QR bill) ─────────────────────────────

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Beschreibung ist erforderlich').max(500),
  quantity: z.number().positive('Menge muss grösser als 0 sein').max(100000),
  unitPrice: z.number().min(-1_000_000).max(1_000_000),
  /** Omit / null = the default rate of the invoice settings. Pass-through items (fines) use 0. */
  vatRate: z.number().min(0).max(100).nullable().optional(),
  feeId: z.string().uuid().nullable().optional(),
  damageId: z.string().uuid().nullable().optional(),
  fineId: z.string().uuid().nullable().optional(),
});

const invoiceDebtorSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.union([z.literal(''), z.string().trim().email('Gültige E-Mail-Adresse erforderlich').max(254)]).nullable().optional(),
  street: optionalText(120),
  zip: optionalText(20),
  city: optionalText(80),
  country: optionalText(60),
});

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Ungültiges Datum')
  .transform((v) => new Date(v));

const rentalInvoiceSchema = z.object({
  type: z.literal('RENTAL'),
  bookingId: z.string().uuid(),
  periodStart: dateString,
  periodEnd: dateString,
  notes: z.string().max(2000).nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  dueDays: z.number().int().min(0).max(365).optional(),
  withQrBill: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
});

const customInvoiceSchema = z.object({
  type: z.enum(['DAMAGE', 'FINE', 'OTHER']),
  bookingId: z.string().uuid().nullable().optional(),
  debtor: invoiceDebtorSchema.optional(),
  items: z.array(invoiceItemSchema).min(1, 'Mindestens eine Position ist erforderlich').max(100),
  dueDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(2000).nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  withQrBill: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
});

/** POST /invoices: the original rental body (type omitted = RENTAL) or the custom variant. */
export const createInvoiceSchema = z.preprocess(
  (v) => (v && typeof v === 'object' && !Array.isArray(v) && (v as { type?: unknown }).type === undefined ? { ...v, type: 'RENTAL' } : v),
  z.discriminatedUnion('type', [rentalInvoiceSchema, customInvoiceSchema]),
);

// ─── Fees ───────────────────────────────────────────────────────

const feeCategorySchema = z.enum(['DAMAGE', 'FINE_ADMIN', 'CLEANING', 'FUEL', 'LATE_RETURN', 'OTHER']);

export const createFeeSchema = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich').max(120),
  category: feeCategorySchema.optional(),
  defaultAmount: z.number().min(0, 'Betrag darf nicht negativ sein').max(1_000_000),
  vatRate: z.number().min(0).max(100).nullable().optional(),
  active: z.boolean().optional(),
});
export const updateFeeSchema = createFeeSchema.partial();

// ─── Contract templates ─────────────────────────────────────────

export const renameContractTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich').max(120),
});

// ─── Damages & inspections ──────────────────────────────────────

export const createDamageSchema = z.object({
  view: z.enum(['top', 'left', 'right', 'front', 'rear']),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zone: z.string().trim().max(120).optional(),
  type: z.enum(['KRATZER', 'DELLE', 'STEINSCHLAG', 'RISS', 'LACK', 'FELGE', 'GLAS', 'INNENRAUM', 'SONSTIGES']).optional(),
  severity: z.enum(['minor', 'medium', 'major']).optional(),
  description: z.string().trim().max(2000).optional(),
  discoveredBookingId: z.string().uuid().nullable().optional(),
});
export const updateDamageSchema = createDamageSchema.partial().extend({
  status: z.enum(['OPEN', 'REPAIRED']).optional(),
});
export const repairDamageSchema = z.object({
  /** ISO date-time, default now. */
  repairedAt: z.string().datetime({ offset: true }).optional(),
});

export const createInspectionSchema = z.object({
  type: z.enum(['PICKUP', 'RETURN']),
  at: z.string().datetime({ offset: true }).optional(),
  mileage: z.number().int().min(0).max(5_000_000).nullable().optional(),
  fuelLevel: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(4000).optional(),
  newDamageIds: z.array(z.string().uuid()).max(200).optional(),
});

// ─── Fines ──────────────────────────────────────────────────────

const fineDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Ungültiges Datum')
  .transform((v) => v.trim());

const fineFields = {
  licensePlate: z.string().trim().min(2, 'Kontrollschild ist erforderlich').max(20),
  /** ISO date-time or YYYY-MM-DD (= time unknown). */
  occurredAt: fineDateTime,
  place: z.string().trim().max(200).optional(),
  authority: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(200).optional(),
  /** coerce: multipart/form-data sends strings. */
  amount: z.coerce.number().min(0, 'Betrag darf nicht negativ sein').max(1_000_000),
  currency: z.enum(['CHF', 'EUR']).optional(),
  description: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
};
export const createFineSchema = z.object(fineFields);
export const updateFineSchema = z.object(fineFields).partial().extend({
  status: z.enum(['NEW', 'ASSIGNED', 'FORWARDED', 'INVOICED', 'CLOSED']).optional(),
  bookingId: z.string().uuid().nullable().optional(),
});
export const assignFineSchema = z.object({ bookingId: z.string().uuid() });
export const notifyFineSchema = z.object({ note: z.string().trim().max(2000).optional() });
export const fineInvoiceSchema = z.object({
  feeIds: z.array(z.string().uuid()).max(20).optional(),
  sendEmail: z.boolean().optional(),
  withQrBill: z.boolean().optional(),
  dueDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
