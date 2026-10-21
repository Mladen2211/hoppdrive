// ─── Round 2 features: DTOs shared by the API and the apps ──────
//
// Languages, currency, discount codes & marketing, e-mail log, invoices with line items & QR bill,
// contract templates, damages & inspections, fines. Dates travel as ISO strings.

import type { AppLocale } from './index';

// ─── Currency ───────────────────────────────────────────────────

export type CurrencyCode = 'CHF' | 'EUR';
export const CURRENCY_CODES: readonly CurrencyCode[] = ['CHF', 'EUR'];

/** `currency` setting. Saving it also updates Vehicle.currency of every vehicle. */
export interface CurrencySetting {
  code: CurrencyCode;
}

// ─── Translations ───────────────────────────────────────────────

/** Locales that can carry translations (German lives in the normal fields). */
export type TranslatableLocale = Exclude<AppLocale, 'de'>;

/** `{ en: {...}, fr: {...} }` – per-locale blobs, same field names as the German entity. */
export type Translations<T = Record<string, unknown>> = Partial<Record<TranslatableLocale, Partial<T>>>;

export type FaqTranslation = { question: string; answer: string };
export type TestimonialTranslation = { text: string; location: string };
export type VehicleTranslation = { description: string };

// ─── Settings ───────────────────────────────────────────────────

/** `invoice_settings` (admin only, private). IBAN / QR-IBAN are stored without spaces. */
export interface InvoiceSettings {
  uid?: string;
  iban?: string;
  /** QR-IBAN (Swiss IBAN with institution ID 30000-31999): QR bills then use a QRR reference. */
  qrIban?: string;
  bankName?: string;
  vatRate?: number;
  /** Default of the "Mit QR-Rechnung" checkbox. */
  defaultWithQrBill?: boolean;
  /** Payment term in days (default 30). */
  dueDays?: number;
}

/** `contract` setting: who signs contracts for the company. */
export interface ContractSetting {
  signerAdminId?: string | null;
}

// ─── Customers & marketing ──────────────────────────────────────

export type CustomerFilter = 'all' | 'eligible' | 'consent' | 'customers' | 'unsubscribed';

/** Row of GET /api/customers (deduplicated by e-mail from bookings + inquiries). */
export interface CustomerDto {
  email: string;
  name: string;
  phone: string | null;
  locale: string | null;
  bookingsCount: number;
  inquiriesCount: number;
  lastRentalAt: string | null;
  lastActivityAt: string | null;
  /** Explicit marketing opt-in. */
  marketingConsent: boolean;
  unsubscribed: boolean;
  /** (consent OR at least one booking) AND NOT unsubscribed. Enforced on the server when sending. */
  eligible: boolean;
}

export interface CustomersPageDto {
  items: CustomerDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: Record<CustomerFilter, number>;
}

export type DiscountType = 'PERCENT' | 'FIXED';
export type DiscountStatus = 'active' | 'inactive' | 'scheduled' | 'expired' | 'exhausted';

export interface DiscountCodeDto {
  id: string;
  code: string;
  label: string | null;
  type: DiscountType;
  /** PERCENT: 0-100, FIXED: amount in `currency`. */
  value: number;
  currency: string | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  perEmailLimit: number;
  minDays: number | null;
  active: boolean;
  campaignId: string | null;
  /** Personal code: only this address may redeem it. */
  recipientEmail: string | null;
  isPersonal: boolean;
  redemptionCount: number;
  status: DiscountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountRedemptionDto {
  id: string;
  email: string;
  amount: number;
  createdAt: string;
  bookingId: string | null;
  bookingStatus: string | null;
  contactRequestId: string | null;
  customerName: string | null;
}

export interface DiscountCodeDetailDto extends DiscountCodeDto {
  redemptions: DiscountRedemptionDto[];
}

/** Body of POST /api/discount-codes. `code` is generated (HD-XXXX-XXXX) when omitted. */
export interface CreateDiscountCodeRequest {
  code?: string;
  label?: string | null;
  type: DiscountType;
  value: number;
  currency?: CurrencyCode | null;
  /** YYYY-MM-DD (business day) or ISO date-time. */
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  perEmailLimit?: number;
  minDays?: number | null;
  active?: boolean;
  recipientEmail?: string | null;
}
export type UpdateDiscountCodeRequest = Partial<CreateDiscountCodeRequest>;

export type DiscountInvalidReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'email_limit'
  | 'min_days'
  | 'wrong_recipient'
  | 'email_required'
  | 'currency_mismatch';

/** Response of the public GET /api/discount-codes/validate?code&email&vehicleId&days */
export type DiscountValidationDto =
  | {
      valid: true;
      type: DiscountType;
      value: number;
      currency: string | null;
      /** Amount deducted (null without vehicleId + days). */
      discount: number | null;
      total: number | null;
      totalAfterDiscount: number | null;
      minDays: number | null;
      validUntil: string | null;
    }
  | { valid: false; reason: DiscountInvalidReason; message: string };

export type CampaignCodeMode = 'NONE' | 'SHARED' | 'PERSONAL';
export type RecipientStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface CampaignCodeInput {
  /** SHARED: use this existing code. */
  id?: string;
  /** SHARED (new): optional custom code text. */
  code?: string;
  label?: string | null;
  type?: DiscountType;
  value?: number;
  currency?: CurrencyCode | null;
  validFrom?: string | null;
  validUntil?: string | null;
  minDays?: number | null;
  /** SHARED (new) only; personal codes are single-use. */
  maxRedemptions?: number | null;
  perEmailLimit?: number;
}

/** Body of POST /api/marketing/campaigns (and /campaigns/preview). */
export interface CreateCampaignRequest {
  subject: string;
  message: string;
  recipients: { mode: 'all' } | { mode: 'selected'; emails: string[] };
  codeMode: CampaignCodeMode;
  code?: CampaignCodeInput;
}

export interface CampaignRecipientDto {
  id: string;
  email: string;
  name: string;
  status: RecipientStatus;
  error: string | null;
  /** The code this recipient received (shared or personal). */
  code: string | null;
  sentAt: string | null;
  emailMessageId: string | null;
}

export interface CampaignDto {
  id: string;
  subject: string;
  message: string;
  codeMode: CampaignCodeMode;
  createdAt: string;
  /** Set once every recipient was processed. */
  sentAt: string | null;
  createdBy: { id: string; name: string } | null;
  counts: { total: number; queued: number; sent: number; failed: number };
  redemptions: number;
  code: { id: string; code: string | null; type: DiscountType; value: number; currency: string | null } | null;
  /** Only on GET /campaigns/:id and after creating. */
  recipients?: CampaignRecipientDto[];
}

export interface CampaignPreviewDto {
  recipientCount: number;
  /** Selected addresses that are not eligible and were dropped. */
  skipped: string[];
  sampleCode: string | null;
  discountText: string | null;
  validUntil: string | null;
  sampleRecipient: { email: string; name: string } | null;
}

// ─── E-mail outbox + log ────────────────────────────────────────

export type EmailStatus = 'QUEUED' | 'SENT' | 'FAILED';
export type EmailProvider = 'brevo' | 'smtp' | 'listmonk' | 'log';

export type EmailTemplateKey =
  | 'admin_invite'
  | 'admin_invite_accepted'
  | 'password_reset'
  | 'inquiry_received'
  | 'admin_notification'
  | 'inquiry_declined'
  | 'booking_confirmation'
  | 'contract'
  | 'contract_package'
  | 'invoice'
  | 'dunning'
  | 'damage_invoice'
  | 'fine_notice'
  | 'fine_invoice'
  | 'discount_campaign'
  | 'unsubscribe_confirmation'
  | 'test';

export interface EmailMessageDto {
  id: string;
  to: string;
  toName: string | null;
  subject: string;
  template: EmailTemplateKey | string;
  templateLabel: string;
  status: EmailStatus;
  attempts: number;
  nextAttemptAt: string | null;
  provider: string | null;
  providerMessageId: string | null;
  error: string | null;
  related: { type: string; id: string | null } | null;
  attachments: { filename: string }[];
  sentAt: string | null;
  createdAt: string;
  /** false for invite / password-reset mails (one-time links are wiped after sending). */
  resendable: boolean;
}

/** GET /api/email/messages/:id */
export interface EmailMessageDetailDto extends EmailMessageDto {
  /** The rendered HTML, null when it was wiped (one-time-link mails). */
  html: string | null;
}

/** GET /api/email/status */
export interface EmailStatusDto {
  provider: EmailProvider;
  /** Credentials / URLs complete. */
  configured: boolean;
  /** false for the log provider (mails are only printed to the API console). */
  deliversExternally: boolean;
  from: { email: string; name: string };
  /** Non-secret facts: host, port, URL, template id ... */
  details: Record<string, string | number | boolean>;
  queue: {
    queued: number;
    failed: number;
    sent: number;
    sentLast24h: number;
    failedLast24h: number;
    oldestQueuedAt: string | null;
    lastSentAt: string | null;
  };
  maxAttempts: number;
  workerRunning: boolean;
  templates: { key: EmailTemplateKey; label: string }[];
}

/** Result of POST /api/email/test and POST /api/email/messages/:id/resend */
export interface EmailSendResultDto {
  id: string;
  status: EmailStatus;
  error?: string;
  provider?: string;
}

// ─── Bookings: driver details ───────────────────────────────────

/** Driver / renter details stored with a booking. '' or null clears a field on update. */
export interface DriverDetails {
  customerPhone?: string | null;
  driverStreet?: string | null;
  driverZip?: string | null;
  driverCity?: string | null;
  driverCountry?: string | null;
  /** YYYY-MM-DD */
  driverBirthDate?: string | null;
  driverLicenseNumber?: string | null;
  driverLicenseCountry?: string | null;
}

/** Booking as returned by GET /bookings, GET /bookings/:id, POST/PATCH ... */
export interface BookingDetailDto extends DriverDetails {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail: string | null;
  customerLocale: string | null;
  /** Pickup / return. Rows at exactly 00:00 (business time zone) are legacy whole-day bookings. */
  startDate: string;
  endDate: string;
  hasTimes: boolean;
  /** Final price (after discountAmount). */
  totalPrice: number;
  discountAmount: number;
  discountCode: { id: string; code: string } | null;
  currency: string;
  status: 'reserved' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  contractStatus: 'PENDING' | 'SIGNED' | 'VOIDED';
  signedAt: string | null;
  contractTemplateId: string | null;
  contractSha256: string | null;
  companySignerId: string | null;
  locationId: string | null;
  createdAt: string;
  vehicle: { brand: string; model: string; licensePlate: string | null } | null;
}

export interface CreateBookingDetailRequest extends DriverDetails {
  vehicleId: string;
  customerName: string;
  customerEmail?: string;
  customerLocale?: AppLocale;
  /** ISO date-times with the real pickup / return time. */
  startDate: string;
  endDate: string;
  /** Price BEFORE the discount (computed when omitted). */
  totalPrice?: number;
  notes?: string;
  locationId?: string;
  discountCode?: string;
}

export interface UpdateBookingRequest extends DriverDetails {
  customerName?: string;
  customerEmail?: string | null;
  customerLocale?: AppLocale | null;
  notes?: string | null;
  startDate?: string;
  endDate?: string;
  /** Final price override. */
  totalPrice?: number;
  /** Recompute the price for the new dates (ignored when totalPrice is given). */
  recalculatePrice?: boolean;
  locationId?: string | null;
}

// ─── Fees, invoices (line items + QR bill) ──────────────────────

export type FeeCategory = 'DAMAGE' | 'FINE_ADMIN' | 'CLEANING' | 'FUEL' | 'LATE_RETURN' | 'OTHER';

export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  DAMAGE: 'Schaden',
  FINE_ADMIN: 'Bearbeitung Busse',
  CLEANING: 'Reinigung',
  FUEL: 'Tank / Laden',
  LATE_RETURN: 'Verspätete Rückgabe',
  OTHER: 'Sonstiges',
};

export interface FeeDto {
  id: string;
  name: string;
  category: FeeCategory;
  defaultAmount: number;
  /** null = invoice default */
  vatRate: number | null;
  active: boolean;
}

/** Body of POST /api/fees (PATCH /api/fees/:id accepts any subset). */
export interface CreateFeeRequest {
  name: string;
  category?: FeeCategory;
  defaultAmount: number;
  /** null = use the VAT rate of the invoice (Settings → Rechnungsinfos). */
  vatRate?: number | null;
  active?: boolean;
}
export type UpdateFeeRequest = Partial<CreateFeeRequest>;

export type InvoiceType = 'RENTAL' | 'DAMAGE' | 'FINE' | 'OTHER';
export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  RENTAL: 'Miete',
  DAMAGE: 'Schaden',
  FINE: 'Busse',
  OTHER: 'Sonstiges',
};

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** null = the invoice's own rate. */
  vatRate: number | null;
  total: number;
  sortOrder: number;
  feeId: string | null;
  damageId: string | null;
  fineId: string | null;
}

/** Invoice as returned by GET /api/invoices and the create / status / reissue endpoints. */
export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  bookingId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerAddress: string | null;
  customerStreet: string | null;
  customerZip: string | null;
  customerCity: string | null;
  customerCountry: string | null;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  /** Default / dominant VAT rate; the items may carry their own (see InvoiceItemDto.vatRate). */
  vatRate: number;
  vatAmount: number;
  penalty: number;
  total: number;
  currency: string;
  status: 'PENDING' | 'PAID';
  isOverdue: boolean;
  parentInvoiceId: string | null;
  notes: string | null;
  /** The PDF contains the Swiss QR payment slip. */
  withQrBill: boolean;
  /** QRR (27 digits, QR-IBAN) or SCOR (RF..., normal IBAN) reference. */
  qrReference: string | null;
  items: InvoiceItemDto[];
  createdAt: string;
  booking: {
    id: string;
    customerName: string;
    startDate: string;
    endDate: string;
    vehicle: { brand: string; model: string } | null;
  } | null;
}

/** Billing address of an invoice. name is required; the rest defaults from the booking's driver details. */
export interface InvoiceDebtor {
  name: string;
  email?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface CreateInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Omit / null = the default rate of the invoice settings. Pass-through items (fines) use 0. */
  vatRate?: number | null;
  feeId?: string | null;
  damageId?: string | null;
  fineId?: string | null;
}

/** POST /api/invoices, rental variant (the original flow): prorated from the booking, saved as one line item. */
export interface CreateRentalInvoiceRequest {
  type?: 'RENTAL';
  bookingId: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
  vatRate?: number;
  dueDays?: number;
  /** Default: the "Mit QR-Rechnung" default of the invoice settings. */
  withQrBill?: boolean;
  /** Default true for RENTAL invoices (mailed on issuance when the booking has an e-mail address). */
  sendEmail?: boolean;
}

/** POST /api/invoices, custom variant: free lines / fees / damages / fines. */
export interface CreateCustomInvoiceRequest {
  type: 'DAMAGE' | 'FINE' | 'OTHER';
  /** When given, the debtor fields default from the booking's driver details. */
  bookingId?: string | null;
  debtor?: InvoiceDebtor;
  items: CreateInvoiceItemInput[];
  dueDays?: number;
  notes?: string;
  /** Rate for items without their own vatRate (default: invoice settings). */
  vatRate?: number;
  withQrBill?: boolean;
  /** Default false for custom invoices. */
  sendEmail?: boolean;
}

export type CreateInvoiceRequest = CreateRentalInvoiceRequest | CreateCustomInvoiceRequest;

/** Create / reissue responses carry the e-mail outcome when a mail was requested. */
export type InvoiceWithMailDto = InvoiceDto & {
  emailSent?: boolean;
  /** Set when a mail was requested but not delivered: 'no_recipient' | 'send_failed'. */
  emailError?: 'no_recipient' | 'send_failed';
};

/** 422 body of every endpoint that renders a QR bill when the creditor / currency data is incomplete. */
export interface QrBillUnavailableError {
  success: false;
  code: 'qr_bill_unavailable';
  error: string;
  /** Which settings are missing: 'iban' | 'name' | 'street' | 'zip' | 'city' | 'country' | 'currency' | 'amount'. */
  missing: string[];
}

// ─── Contract templates ─────────────────────────────────────────

export interface ContractTemplateFieldDef {
  /** AcroForm field name in the PDF. */
  key: string;
  label: string;
  /** The template should have this field (reported as missingRecommended when absent). */
  recommended: boolean;
  /** Use a multi-line text field in the PDF. */
  multiline?: boolean;
}

/** Text fields the contract fill engine knows. Every other AcroForm field of an uploaded template is left empty. */
export const CONTRACT_TEMPLATE_FIELDS: readonly ContractTemplateFieldDef[] = [
  { key: 'contractNumber', label: 'Vertragsnummer', recommended: true },
  { key: 'issueDate', label: 'Vertragsdatum', recommended: false },
  { key: 'companyName', label: 'Vermieter: Firma', recommended: true },
  { key: 'companyAddress', label: 'Vermieter: Adresse', recommended: false },
  { key: 'companyUid', label: 'Vermieter: UID / MwSt-Nr.', recommended: false },
  { key: 'customerName', label: 'Mieter: Name', recommended: true },
  { key: 'customerEmail', label: 'Mieter: E-Mail', recommended: false },
  { key: 'customerPhone', label: 'Mieter: Telefon', recommended: false },
  { key: 'driverAddress', label: 'Mieter: Adresse', recommended: false, multiline: true },
  { key: 'driverBirthDate', label: 'Mieter: Geburtsdatum', recommended: false },
  { key: 'driverLicenseNumber', label: 'Mieter: Führerausweis-Nr.', recommended: false },
  { key: 'vehicleName', label: 'Fahrzeug (Marke und Modell)', recommended: true },
  { key: 'vehicleBrand', label: 'Fahrzeug: Marke', recommended: false },
  { key: 'vehicleModel', label: 'Fahrzeug: Modell', recommended: false },
  { key: 'vehicleYear', label: 'Fahrzeug: Baujahr', recommended: false },
  { key: 'licensePlate', label: 'Kontrollschild', recommended: true },
  { key: 'pickupAt', label: 'Übergabe (Datum, Zeit)', recommended: true },
  { key: 'returnAt', label: 'Rückgabe (Datum, Zeit)', recommended: true },
  { key: 'rentalDays', label: 'Mietdauer in Tagen', recommended: false },
  { key: 'pricePerDay', label: 'Preis pro Tag', recommended: false },
  { key: 'discount', label: 'Rabatt', recommended: false },
  { key: 'totalPrice', label: 'Gesamtpreis', recommended: true },
  { key: 'currency', label: 'Währung', recommended: false },
  { key: 'location', label: 'Standort', recommended: false },
  { key: 'notes', label: 'Bemerkungen', recommended: false, multiline: true },
  { key: 'existingDamages', label: 'Bestehende Schäden (nummerierte Liste)', recommended: true, multiline: true },
  { key: 'signedAt', label: 'Unterzeichnet am', recommended: false },
  { key: 'signedPlace', label: 'Unterzeichnet in (Ort)', recommended: false },
];

/** Fields into which the signature images are drawn (their widget rectangles). */
export const CONTRACT_SIGNATURE_FIELDS: readonly ContractTemplateFieldDef[] = [
  { key: 'companySignature', label: 'Unterschrift Vermieter', recommended: true },
  { key: 'customerSignature', label: 'Unterschrift Mieter', recommended: true },
];

/** Result of the AcroForm analysis of an uploaded contract template. */
export interface ContractTemplateFieldReport {
  /** Every AcroForm field of the PDF. */
  fields: string[];
  /** Fields the fill engine fills (CONTRACT_TEMPLATE_FIELDS). */
  known: string[];
  /** Fields the engine does not know: they stay empty (typos show up here). */
  unknown: string[];
  /** Found signature fields (companySignature / customerSignature). */
  signatureFields: string[];
  /** Recommended fields (and signature fields) the PDF lacks. */
  missingRecommended: string[];
}

export interface ContractTemplateDto {
  id: string;
  name: string;
  originalFileName: string | null;
  fields: ContractTemplateFieldReport;
  isActive: boolean;
  uploadedById: string;
  uploadedByName: string | null;
  /** Bookings whose contract was created from this template (delete is refused while > 0). */
  bookingCount: number;
  createdAt: string;
}

/** GET /api/bookings/:id/contract-preview */
export interface ContractPreviewDto {
  booking: {
    id: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    driverStreet: string | null;
    driverZip: string | null;
    driverCity: string | null;
    driverCountry: string | null;
    driverBirthDate: string | null;
    driverLicenseNumber: string | null;
    driverLicenseCountry: string | null;
    vehicleBrand: string;
    vehicleModel: string;
    licensePlate: string | null;
    startDate: string;
    endDate: string;
    hasTimes: boolean;
    totalPrice: number;
    discountAmount: number;
    currency: string;
    locationName: string | null;
  };
  company: {
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    uid: string;
  };
  clauses: { id: string; heading: string; body: string }[];
  /** Active contract template, null = the built-in contract is used. */
  templateId: string | null;
  templateName: string | null;
  /** API path of the pre-filled, company-signed contract (customer signature still empty): GET <baseURL><pdfUrl>. */
  pdfUrl: string;
  /** Open damages of the vehicle that are printed in the contract ("Bestehende Schäden"). */
  existingDamages: { number: number; zone: string; type: DamageType; severity: DamageSeverity; description: string }[];
  /** Who signs for the company; hasSignature=false means finalizing is blocked (422 company_signature_missing). */
  companySigner: { id: string | null; name: string | null; hasSignature: boolean };
}

// ─── Damages & inspections ──────────────────────────────────────

export type DamageView = 'top' | 'left' | 'right' | 'front' | 'rear';
export const DAMAGE_VIEWS: readonly DamageView[] = ['top', 'left', 'right', 'front', 'rear'];
export type DamageType =
  | 'KRATZER'
  | 'DELLE'
  | 'STEINSCHLAG'
  | 'RISS'
  | 'LACK'
  | 'FELGE'
  | 'GLAS'
  | 'INNENRAUM'
  | 'SONSTIGES';
export const DAMAGE_TYPES: readonly DamageType[] = [
  'KRATZER',
  'DELLE',
  'STEINSCHLAG',
  'RISS',
  'LACK',
  'FELGE',
  'GLAS',
  'INNENRAUM',
  'SONSTIGES',
];
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  KRATZER: 'Kratzer',
  DELLE: 'Delle',
  STEINSCHLAG: 'Steinschlag',
  RISS: 'Riss',
  LACK: 'Lack',
  FELGE: 'Felge',
  GLAS: 'Glas',
  INNENRAUM: 'Innenraum',
  SONSTIGES: 'Sonstiges',
};
export type DamageSeverity = 'minor' | 'medium' | 'major';
export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  minor: 'Leicht',
  medium: 'Mittel',
  major: 'Schwer',
};
export type DamageStatus = 'OPEN' | 'REPAIRED';
export type InspectionType = 'PICKUP' | 'RETURN';
export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  PICKUP: 'Übergabe',
  RETURN: 'Rückgabe',
};

export interface VehicleDamagePhotoDto {
  id: string;
  width: number;
  height: number;
  /** API path of the image, e.g. /damages/photos/<id>. Authenticated: use Bearer or ?token=<access token> (see api.damagePhotoUrl). */
  url: string;
  createdAt: string;
}

export interface VehicleDamageDto {
  id: string;
  vehicleId: string;
  view: DamageView;
  /** 0..1 from the top-left corner of the view's diagram (CAR_DIAGRAM) */
  x: number;
  y: number;
  zone: string;
  type: DamageType;
  severity: DamageSeverity;
  description: string;
  status: DamageStatus;
  repairedAt: string | null;
  discoveredBookingId: string | null;
  reportedById: string;
  photos: VehicleDamagePhotoDto[];
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /api/vehicles/:vehicleId/damages. zone defaults to suggestDamageZone(view, x, y). */
export interface CreateDamageRequest {
  view: DamageView;
  x: number;
  y: number;
  zone?: string;
  type?: DamageType;
  severity?: DamageSeverity;
  description?: string;
  discoveredBookingId?: string | null;
}

/** Body of PATCH /api/vehicles/:vehicleId/damages/:id (any subset). status REPAIRED sets repairedAt (now), OPEN clears it. */
export interface UpdateDamageRequest extends Partial<CreateDamageRequest> {
  status?: DamageStatus;
}

export interface BookingInspectionDto {
  id: string;
  bookingId: string;
  type: InspectionType;
  at: string;
  mileage: number | null;
  /** percent 0-100 */
  fuelLevel: number | null;
  notes: string;
  /** Snapshot of the OPEN damages of the vehicle at inspection time. */
  damageIds: string[];
  /** Newly found damages (RETURN): damages whose discoveredBookingId is this booking. */
  newDamageIds: string[];
  hasReport: boolean;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

/** Body of POST /api/bookings/:id/inspections. */
export interface CreateInspectionRequest {
  type: InspectionType;
  /** ISO date-time, default now. */
  at?: string;
  mileage?: number | null;
  /** Fuel / charge level in percent (0-100). */
  fuelLevel?: number | null;
  notes?: string;
  /** RETURN only: damages found during this rental (sets their discoveredBookingId). */
  newDamageIds?: string[];
}

// ─── Fines ──────────────────────────────────────────────────────

export type FineStatus = 'NEW' | 'ASSIGNED' | 'FORWARDED' | 'INVOICED' | 'CLOSED';
export const FINE_STATUS_LABELS: Record<FineStatus, string> = {
  NEW: 'Neu',
  ASSIGNED: 'Zugeordnet',
  FORWARDED: 'Weitergeleitet',
  INVOICED: 'Verrechnet',
  CLOSED: 'Abgeschlossen',
};

export interface FineDto {
  id: string;
  /** Normalised plate */
  licensePlate: string;
  occurredAt: string;
  place: string;
  authority: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  hasDocument: boolean;
  /** File name of the uploaded document (GET /fines/:id/document downloads it). */
  documentName: string | null;
  vehicleId: string | null;
  bookingId: string | null;
  status: FineStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  vehicle: { id: string; brand: string; model: string; licensePlate: string | null } | null;
  booking: {
    id: string;
    customerName: string;
    customerEmail: string | null;
    startDate: string;
    endDate: string;
  } | null;
  /** Invoices created from this fine. */
  invoices: { id: string; invoiceNumber: string; status: 'PENDING' | 'PAID'; total: number; currency: string }[];
}

/** GET /api/fines?status=&q=&plate=&bookingId=&page=&pageSize= (statusCounts cover all fines, independent of the filters). */
export interface FinesPageDto {
  items: FineDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<FineStatus, number>;
}

/**
 * Body of POST /api/fines: JSON or multipart/form-data (then with an optional `document` file and string values).
 * The plate is normalised; the vehicle is looked up by it.
 */
export interface CreateFineRequest {
  licensePlate: string;
  /** ISO date-time; a date at 00:00 (local) means "time unknown". */
  occurredAt: string;
  place?: string;
  authority?: string;
  reference?: string;
  amount: number;
  currency?: 'CHF' | 'EUR';
  description?: string;
  notes?: string;
}

/** Body of PATCH /api/fines/:id (any subset). bookingId: null unassigns. */
export interface UpdateFineRequest extends Partial<CreateFineRequest> {
  status?: FineStatus;
  bookingId?: string | null;
}

export type FineLookupWarning = 'none' | 'multiple' | 'no_vehicle' | null;

export interface FineLookupCandidateDto extends DriverDetails {
  bookingId: string;
  /** 'exact': the time lies inside the booked period; 'whole_day': it only matched because a legacy booking (00:00) counts as whole days or the fine has no time. */
  matchType: 'exact' | 'whole_day';
  status: 'reserved' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  hasTimes: boolean;
  customerName: string;
  customerEmail: string | null;
  customerLocale: string | null;
}

/** GET /api/fines/lookup?plate=&at= */
export interface FineLookupDto {
  /** Normalised plate */
  plate: string;
  at: string;
  vehicle: { id: string; brand: string; model: string; licensePlate: string | null } | null;
  candidates: FineLookupCandidateDto[];
  /** 'no_vehicle': plate unknown; 'none': no rental at that time (idle / maintenance); 'multiple': several matches; null: exactly one. */
  warning: FineLookupWarning;
}

/** Result of POST /api/fines/:id/notify. */
export interface FineNotifyResultDto {
  /** The renter's address accepted the mail now; false = queued for retry or failed (see the e-mail log). */
  emailSent: boolean;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  emailMessageId: string;
  error?: string;
  fine: FineDto;
}

/** Result of POST /api/fines/:id/invoice (the invoice carries emailSent / emailError when sendEmail was requested). */
export interface FineInvoiceResultDto {
  invoice: InvoiceWithMailDto;
  fine: FineDto;
}

/** Body of POST /api/fines/:id/invoice. */
export interface CreateFineInvoiceRequest {
  /** Catalog fees added to the fine amount (e.g. the "Bearbeitungsgebühr Busse"). */
  feeIds?: string[];
  sendEmail?: boolean;
  withQrBill?: boolean;
  dueDays?: number;
  notes?: string;
}
