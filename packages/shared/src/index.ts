import type { AdminRole } from './permissions';
import type { Translations, VehicleTranslation } from './features';

// ─── Vehicle ────────────────────────────────────────────────────

export interface VehicleDto {
  id: string;
  brand: string;
  model: string;
  type: VehicleType;
  year: number;
  basePricePerDay: number;
  currency: string;
  specs: VehicleSpecsDto;
  thumbnailUrl: string | null;
  images: VehicleImageDto[];
  /** Optional marketing/detail text (Flotte → "Beschreibung"). With ?locale= it is the translated text. */
  description?: string | null;
  /** Normalised plate (uppercase, no spaces / dots / dashes), e.g. ZH123456. */
  licensePlate?: string | null;
  /** Per-locale content. ONLY in the admin endpoints (GET /vehicles/admin/all, POST, PATCH). */
  translations?: Translations<VehicleTranslation> | null;
  /** Manually switched on/off on the website (Flotte → "Auf Website"). */
  isAvailable: boolean;
  /**
   * Computed live: false when a reserved/active booking or a maintenance
   * period overlaps today. Drives the B2C "Verfügbar / Reserviert" badge.
   */
  availableNow: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleSpecsDto {
  horsepower: number;
  transmission: 'automatic' | 'manual';
  seats: number;
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
  range?: string;
}

export interface VehicleImageDto {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

export type VehicleType =
  | 'sedan'
  | 'suv'
  | 'estate'
  | 'coupe'
  | 'convertible'
  | 'electric'
  | 'van';

export interface CreateVehicleRequest {
  brand: string;
  model: string;
  type: VehicleType;
  year: number;
  basePricePerDay: number;
  specs: VehicleSpecsDto;
  /** Optional free text; empty string / null clears it. */
  description?: string | null;
  /** Free input ("ZH 123 456"), stored normalised; '' or null clears it. 409 when taken. */
  licensePlate?: string | null;
  /** { en: { description }, fr: {...} } – replaces the stored translations; null clears them. */
  translations?: Translations<VehicleTranslation> | null;
}

export interface UpdateVehicleRequest extends Partial<CreateVehicleRequest> {}

// ─── Pricing ────────────────────────────────────────────────────

export interface PricingBreakpointDto {
  id: string;
  fromDay: number;
  toDay: number | null;
  discountPercent: number;
}

/** Public tier (GET /api/pricing/tiers), sorted by fromDay. Mirrors PricingService. */
export interface PricingTierDto {
  fromDay: number;
  /** null = open-ended (e.g. "31+") */
  toDay: number | null;
  discountPercent: number;
}

export interface PricingCalculation {
  baseDaily: number;
  effectiveDaily: number;
  totalDays: number;
  totalPrice: number;
  discountPercent: number;
  currency: string;
}

// ─── Contact Request ────────────────────────────────────────────

export interface ContactRequestDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  vehicleOfInterest: string | null;
  message: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  /** Code typed into the inquiry form (uppercase). Applied when the inquiry is approved. */
  discountCode?: string | null;
  /** Website language of the visitor. */
  locale?: AppLocale | null;
  status: ContactRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export type ContactRequestStatus =
  | 'pending'
  | 'reviewed'
  | 'responded'
  | 'converted'
  | 'denied'
  | 'archived';

/** GET /api/contact response. statusCounts covers ALL requests, not just the page. */
export interface ContactRequestsPageDto extends PaginatedResponse<ContactRequestDto> {
  statusCounts: Record<ContactRequestStatus, number>;
}

export interface CreateContactRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  vehicleOfInterest?: string;
  message: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  /** Website language of the visitor. */
  locale?: AppLocale;
  /** Optional discount code (validate it live with GET /api/discount-codes/validate). */
  discountCode?: string;
}

// ─── Auth ───────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** UI languages (website + admin). German is the authoritative source language. */
export type AppLocale = 'de' | 'en' | 'fr' | 'it' | 'hr';
export const APP_LOCALES: readonly AppLocale[] = ['de', 'en', 'fr', 'it', 'hr'];
export type AdminLocale = AppLocale;
export type AdminTheme = 'light' | 'dark' | 'system';

export interface AdminDto {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  mustResetPassword: boolean;
  role: AdminRole;
  /** UI language of this admin (default 'de'). */
  locale: AdminLocale;
  /** Colour theme preference (default 'system'). */
  theme: AdminTheme;
}

/** Row of GET /api/admins (Benutzer und Rollen). */
export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  role: AdminRole;
  lastActiveAt: string | null;
  /** Invite sent but not accepted yet (cannot log in). */
  pending: boolean;
  /** Pending invite whose link has expired (re-invite to send a new one). */
  inviteExpired: boolean;
  /** A company signature is stored (needed to sign contracts as the company). */
  hasSignature: boolean;
  createdAt: string;
}

/** Response of login / accept-invite / reset-password-token. */
export interface AuthSessionDto {
  accessToken: string;
  admin: AdminDto;
}

export interface InviteInfoDto {
  valid: boolean;
  email: string | null;
  role: AdminRole | null;
}

export interface ResetTokenInfoDto {
  valid: boolean;
  expiresInMinutes: number;
}

/** Error body of a locked account (HTTP 423). */
export interface AccountLockedErrorResponse extends ApiErrorResponse {
  code: 'locked';
  lockedUntil: string;
}

// ─── Booking / Availability ─────────────────────────────────────

/** Minimal booking. The full shape (driver details, discount, times) is BookingDetailDto. */
export interface BookingDto {
  id: string;
  vehicleId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  totalPrice: number;
  currency: string;
  notes: string | null;
  createdAt: string;
}

export type BookingStatus = 'reserved' | 'active' | 'completed' | 'cancelled';

export interface CreateBookingRequest {
  vehicleId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

// ─── Dashboard / Stats ──────────────────────────────────────────

export interface DashboardStatsDto {
  activeRentals: number;
  pendingReturns: number;
  /** Non-cancelled booking revenue prorated by the days inside the current calendar month. */
  monthlyRevenue: number;
  /** Percent change of monthlyRevenue vs the previous calendar month (rounded). */
  revenueChangePercent: number;
  fleetUtilization: number;
  totalVehicles: number;
  bookedVehicles: number;
  pendingInquiries: number;
  /** Inquiries created since Monday 00:00 (Europe/Zurich). */
  newInquiriesThisWeek: number;
  /** contractStatus PENDING on non-cancelled bookings. */
  pendingContracts: number;
  /** Invoices with status PENDING and dueDate in the past. */
  overdueInvoices: number;
}

// ─── Audit Log ──────────────────────────────────────────────────

export interface AuditLogDto {
  id: string;
  adminId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  timestamp: string;
}

export type AuditCategory = 'bookings' | 'fleet' | 'content' | 'settings' | 'users' | 'other';

/** Item of GET /api/audit-logs. `details` is parsed JSON when possible, else the raw string. */
export interface AuditLogEntryDto {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  category: AuditCategory;
  details: Record<string, unknown> | string | null;
  createdAt: string;
  admin: { id: string; name: string; firstName: string | null; lastName: string | null; email: string };
}

// ─── Reports ────────────────────────────────────────────────────

export interface ReportKpisDto {
  revenue: number;
  bookings: number;
  avgDurationDays: number;
  utilizationPercent: number;
}

/** Response of GET /api/reports/summary?from&to */
export interface ReportSummaryDto extends ReportKpisDto {
  from: string;
  to: string;
  /** Same range shifted one year back. */
  previous: ReportKpisDto;
  monthly: { month: string; revenue: number; prevRevenue: number }[];
  /** share is a percentage (0-100) of total revenue in the range. */
  byCategory: { type: VehicleType; revenue: number; share: number }[];
  byVehicle: {
    vehicleId: string;
    name: string;
    bookings: number;
    days: number;
    utilizationPercent: number;
    revenue: number;
  }[];
}

// ─── Settings (CMS key/value) ───────────────────────────────────

export interface CompanySetting {
  name?: string;
  phone?: string;
  /** Recipient of new-inquiry notification mails (falls back to ADMIN_NOTIFICATION_EMAIL). */
  inquiryEmail?: string;
  /** Address of the company (contracts, invoices, QR bill creditor, e-mail footer). */
  street?: string;
  zip?: string;
  city?: string;
  /** "Schweiz" or an ISO code ("CH"). */
  country?: string;
  /** Swiss UID / VAT number, e.g. "CHE-123.456.789 MWST". */
  uid?: string;
}

export interface NotificationsSetting {
  /** false disables the admin notification mail for new inquiries (default true). */
  emailOnInquiry?: boolean;
}

export interface MaintenanceModeSetting {
  enabled?: boolean;
  message?: string;
}

// ─── Locations ──────────────────────────────────────────────────

/** Item of the public GET /api/locations/public (active locations only). */
export interface PublicLocationDto {
  id: string;
  name: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string | null;
  email: string | null;
  /** Multi-line plain text, one weekday range per line (e.g. "Mo-Fr 08:00-18:00"). */
  openingHours: string | null;
}

// ─── API Response Envelope ──────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Roles, permissions & password rules ───────────────────────

export * from './permissions';
export * from './password';
export * from './features';
export * from './carDiagram';
