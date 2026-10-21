import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  AdminLocale,
  AdminRole,
  AdminTheme,
  AdminUserDto,
  AuthSessionDto,
  AuditLogEntryDto,
  BookingDetailDto,
  BookingInspectionDto,
  CampaignDto,
  CampaignPreviewDto,
  ContactRequestStatus,
  ContractPreviewDto,
  ContractTemplateDto,
  CreateBookingDetailRequest,
  CreateCampaignRequest,
  CreateDamageRequest,
  CreateDiscountCodeRequest,
  CreateFeeRequest,
  CreateFineInvoiceRequest,
  CreateFineRequest,
  CreateInspectionRequest,
  CreateInvoiceRequest,
  CurrencyCode,
  CustomerFilter,
  CustomersPageDto,
  DiscountCodeDetailDto,
  DiscountCodeDto,
  DiscountValidationDto,
  EmailMessageDetailDto,
  EmailMessageDto,
  EmailSendResultDto,
  EmailStatus,
  EmailStatusDto,
  FeeDto,
  FineDto,
  FineInvoiceResultDto,
  FineLookupDto,
  FineNotifyResultDto,
  FineStatus,
  FinesPageDto,
  InvoiceDto,
  InvoiceWithMailDto,
  InviteInfoDto,
  PaginatedResponse,
  PricingTierDto,
  ReportSummaryDto,
  ResetTokenInfoDto,
  Translations,
  UpdateBookingRequest,
  UpdateDamageRequest,
  UpdateDiscountCodeRequest,
  UpdateFeeRequest,
  UpdateFineRequest,
  VehicleDamageDto,
  VehicleDto,
  VehicleImageDto,
} from '@hoppdrive/shared';

// ─── Types ───────────────────────────────────────────────────
/** The signed-in admin as returned by login / refresh / profile / preferences. */
export interface Admin {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  mustResetPassword: boolean;
  role: AdminRole;
  /** UI language (default 'de'). */
  locale: AdminLocale;
  /** 'light' | 'dark' | 'system' (default 'system'). */
  theme: AdminTheme;
}

export type { AdminLocale, AdminTheme };

// ─── Errors ──────────────────────────────────────────────────
/**
 * Every failed API call rejects with an ApiError (message = the server's `error` text).
 *  - status 403  → the role lacks permission: show the "Keine Berechtigung" state (see isForbidden)
 *  - status 423  → account locked: code 'locked', lockedUntil (ISO) is set
 *  - status 422  → validation: details = { field: [messages] }
 *  - status 401  → session expired and refresh failed (the auth guard redirects to /login)
 */
export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, string[]>;
  /** ISO timestamp, set when the account is locked (status 423, code 'locked'). */
  lockedUntil?: string;
  /** The raw JSON error body, for anything not covered above. */
  data?: any;

  constructor(
    message: string,
    init: { status?: number; code?: string; details?: Record<string, string[]>; data?: any } = {},
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.data = init.data;
    this.lockedUntil = init.data?.lockedUntil;
  }
}

/** True when the error is a 403 from the permission middleware. */
export function isForbidden(err: unknown): boolean {
  return (err as { status?: number } | null | undefined)?.status === 403;
}

// ─── Axios Instance ──────────────────────────────────────────
const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api',
  withCredentials: true, // always send HttpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: attach access token automatically ──
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response Interceptor: transparent 401 refresh ───────────
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post(
    `${client.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const newToken: string = data.data.accessToken;
  sessionStorage.setItem('accessToken', newToken);
  if (data.data.admin) {
    sessionStorage.setItem('admin', JSON.stringify(data.data.admin));
  }
  return newToken;
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ error?: string }>) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    // Only attempt refresh on 401, never retry refresh / login endpoints
    if (
      error.response?.status === 401 &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login') &&
      !(original as any)._retried
    ) {
      (original as any)._retried = true;

      try {
        // Deduplicate concurrent refreshes
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        // Refresh failed — clear session, auth guard will redirect to /login
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('admin');
        return Promise.reject(
          new ApiError(error.response?.data?.error || 'Sitzung abgelaufen', {
            status: 401,
            data: error.response?.data,
          }),
        );
      }
    }

    // Surface the server error message (plus status / code / details for the UI)
    const body = error.response?.data as
      | { error?: string; code?: string; details?: Record<string, string[]> }
      | undefined;
    const message = body?.error || error.message || 'Ein Fehler ist aufgetreten';
    return Promise.reject(
      new ApiError(message, {
        status: error.response?.status,
        code: body?.code,
        details: body?.details,
        data: body,
      }),
    );
  },
);

/** Query for GET /audit-logs and its CSV export. resource / category accept comma-separated lists. */
export interface AuditLogQuery {
  resource?: string;
  category?: string;
  adminId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Payload for vehicle create/update. Deliberately loose (form state is string-typed in the UI);
 * the API validates. See CreateVehicleRequest in @hoppdrive/shared for the exact shape.
 * `description`: free text, '' or null clears it.
 */
export interface VehicleWritePayload {
  description?: string | null;
  /** Free input ("ZH 123 456"); stored normalised, '' or null clears it, 409 code 'license_plate_taken' when used. */
  licensePlate?: string | null;
  /** { en: { description }, fr: {...} } replaces the stored translations; null clears them. */
  translations?: Translations<{ description: string }> | null;
  isAvailable?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ─── Helper: unwrap { success, data } envelope ──────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(res: { data: { data: any } }) {
  return res.data.data;
}

// ─── Public API Object ──────────────────────────────────────
export const api = {
  // ─── Auth (interceptor attaches token automatically) ───────
  /** Rejects with ApiError: 401 code 'invalid_credentials' | 423 code 'locked' (lockedUntil). */
  login: (data: { email: string; password: string }) =>
    client.post('/auth/login', data).then(unwrap) as Promise<any>,
  /** Uses the httpOnly refresh cookie. Resolves { accessToken, admin } (admin incl. role). */
  refreshToken: () =>
    client.post('/auth/refresh').then(unwrap) as Promise<any>,
  logout: () =>
    client.post('/auth/logout').then(unwrap) as Promise<any>,
  resetPassword: (data: { newPassword: string }) =>
    client.post('/auth/reset-password', data).then(unwrap) as Promise<any>,
  getProfile: () =>
    client.get('/auth/profile').then(unwrap) as Promise<any>,
  updateProfile: (data: { firstName?: string; lastName?: string; email?: string; phone?: string; currentPassword?: string; newPassword?: string }) =>
    client.put('/auth/profile', data).then(unwrap) as Promise<any>,
  updateSignature: (signatureData: string) =>
    client.put('/auth/profile/signature', { signatureData }).then(unwrap) as Promise<any>,
  /**
   * Uploads a PNG / JPG signature. The server trims it, makes the background transparent,
   * scales it down and stores it as a data URL. Resolves the updated admin (incl. signatureData).
   */
  uploadSignature: (file: File | Blob) => {
    const formData = new FormData();
    formData.append('signature', file);
    return client
      .put('/auth/profile/signature', formData, { headers: { 'Content-Type': undefined } })
      .then(unwrap) as Promise<any>;
  },
  /** Saves UI language and / or theme. Resolves the updated admin (incl. locale, theme). */
  updatePreferences: (p: { locale?: AdminLocale; theme?: AdminTheme }) =>
    client.put('/auth/profile/preferences', p).then(unwrap) as Promise<Admin>,

  // ─── Password reset & invites (public, no session needed) ──
  /** Always resolves (the API answers 200 whether or not the email exists). */
  forgotPassword: (email: string) =>
    client.post('/auth/forgot-password', { email }).then(unwrap) as Promise<null>,
  /** { valid, expiresInMinutes } for the link from the reset email. */
  checkResetToken: (token: string) =>
    client.get(`/auth/reset-token/${encodeURIComponent(token)}`).then(unwrap) as Promise<ResetTokenInfoDto>,
  /** Sets the new password and signs the user in: resolves { accessToken, admin } like login(). */
  resetPasswordWithToken: (token: string, newPassword: string) =>
    client.post('/auth/reset-password-token', { token, newPassword }).then(unwrap) as Promise<AuthSessionDto>,
  /** { valid, email, role } for the accept-invite page. */
  getInvite: (token: string) =>
    client.get(`/auth/invite/${encodeURIComponent(token)}`).then(unwrap) as Promise<InviteInfoDto>,
  /** Activates the invited account and signs in: resolves { accessToken, admin } like login(). */
  acceptInvite: (data: { token: string; firstName: string; lastName: string; password: string }) =>
    client.post('/auth/accept-invite', data).then(unwrap) as Promise<AuthSessionDto>,

  // ─── Users & roles (users area = Administrator only) ───────
  getAdmins: () =>
    client.get('/admins').then(unwrap) as Promise<AdminUserDto[]>,
  /** Creates or re-invites a pending user. emailSent=false means the mail failed (re-invite to retry). */
  inviteAdmin: (data: { email: string; role: AdminRole }) =>
    client.post('/admins/invite', data).then(unwrap) as Promise<AdminUserDto & { emailSent: boolean }>,
  /** 409 for: own role, last administrator. */
  updateAdminRole: (id: string, role: AdminRole) =>
    client.patch(`/admins/${id}`, { role }).then(unwrap) as Promise<AdminUserDto>,
  /** 409 for: deleting yourself, last administrator. */
  deleteAdmin: (id: string) =>
    client.delete(`/admins/${id}`).then(unwrap) as Promise<null>,

  // ─── Activity log (users area) ─────────────────────────────
  getAuditLogs: (params?: AuditLogQuery) =>
    client.get('/audit-logs', { params }).then(unwrap) as Promise<PaginatedResponse<AuditLogEntryDto>>,
  /** CSV (`;` separated, UTF-8 BOM, German headers) for the same filters. */
  downloadAuditLogsCsv: (params?: Omit<AuditLogQuery, 'page' | 'pageSize'>) =>
    client.get('/audit-logs/export.csv', { params, responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,

  // ─── Dashboard ─────────────────────────────────────────────
  /** Resolves DashboardStatsDto (cast with `as DashboardStatsDto`); left as any for legacy callers. */
  getDashboardStats: () =>
    client.get('/dashboard').then(unwrap) as Promise<any>,

  // ─── Vehicles ──────────────────────────────────────────────
  getVehicles: () =>
    client.get('/vehicles').then(unwrap) as Promise<any[]>,
  getAllVehicles: () =>
    client.get('/vehicles/admin/all').then(unwrap) as Promise<any[]>,
  createVehicle: (data: VehicleWritePayload) =>
    client.post('/vehicles', data).then(unwrap) as Promise<any>,
  updateVehicle: (id: string, data: VehicleWritePayload) =>
    client.patch(`/vehicles/${id}`, data).then(unwrap) as Promise<any>,
  deleteVehicle: (id: string) =>
    client.delete(`/vehicles/${id}`).then(unwrap) as Promise<any>,
  uploadVehicleImage: (vehicleId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    // Let the browser set Content-Type (with the required multipart boundary) —
    // the client's default 'application/json' header must be explicitly cleared.
    return client
      .post(`/vehicles/${vehicleId}/images`, formData, {
        headers: { 'Content-Type': undefined },
      })
      .then(unwrap) as Promise<any>;
  },
  /** Deleting the primary image promotes the next one to primary. */
  deleteVehicleImage: (vehicleId: string, imageId: string) =>
    client.delete(`/vehicles/${vehicleId}/images/${imageId}`).then(unwrap) as Promise<any>,
  /** Makes this the main image ("Hauptbild"); exactly one image is primary afterwards. Resolves the images (sorted). */
  setPrimaryVehicleImage: (vehicleId: string, imageId: string) =>
    client.patch(`/vehicles/${vehicleId}/images/${imageId}/primary`).then(unwrap) as Promise<VehicleImageDto[]>,
  /** imageIds = every image of the vehicle exactly once, in display order. Resolves the images (sorted). */
  reorderVehicleImages: (vehicleId: string, imageIds: string[]) =>
    client.put(`/vehicles/${vehicleId}/images/order`, { imageIds }).then(unwrap) as Promise<VehicleImageDto[]>,

  // ─── Inquiries / Contact ──────────────────────────────────
  /** statusCounts covers ALL inquiries (every status key), independent of page / status filter. */
  getContactRequests: (params?: { page?: number; pageSize?: number; limit?: number; status?: ContactRequestStatus }) =>
    client.get('/contact', { params }).then(unwrap) as Promise<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      statusCounts: Record<ContactRequestStatus, number>;
    }>,
  updateContactStatus: (id: string, status: string) =>
    client.patch(`/contact/${id}/status`, { status }).then(unwrap) as Promise<any>,
  /**
   * totalPrice = price BEFORE the discount. discountCode: omitted = the code the visitor entered, null = approve without
   * a code, string = use this code. An unusable code rejects with ApiError status 422, code 'discount_invalid'
   * (data.reason = expired | exhausted | email_limit | min_days | ...): retry with discountCode: null to approve anyway.
   * Resolves the booking incl. discountAmount, discountCode, customerPhone, customerLocale.
   */
  approveInquiry: (id: string, data: { vehicleId: string; totalPrice?: number; discountCode?: string | null }) =>
    client.post(`/contact/${id}/approve`, data).then(unwrap) as Promise<any>,
  denyInquiry: (id: string, data?: { reason?: string }) =>
    client.post(`/contact/${id}/deny`, data || {}).then(unwrap) as Promise<any>,

  // ─── Bookings ──────────────────────────────────────────────
  getBookings: () =>
    client.get('/bookings').then(unwrap) as Promise<{ items: any[]; total: number }>,
  getBooking: (id: string) =>
    client.get(`/bookings/${id}`).then(unwrap) as Promise<BookingDetailDto>,
  /**
   * startDate / endDate carry the real pickup / return time (ISO date-time). totalPrice = price before the discount;
   * discountCode is applied on top (422 'discount_invalid' when unusable). Driver details: see DriverDetails.
   */
  createBooking: (data: CreateBookingDetailRequest) =>
    client.post('/bookings', data).then(unwrap) as Promise<BookingDetailDto>,
  /**
   * Customer / driver details, notes, times (409 'booking_overlap' | 'maintenance_overlap' | 'booking_closed'),
   * totalPrice override or recalculatePrice. null / '' clears a field.
   */
  updateBooking: (id: string, data: UpdateBookingRequest) =>
    client.patch(`/bookings/${id}`, data).then(unwrap) as Promise<BookingDetailDto>,
  transitionBookingStatus: (id: string, status: 'active' | 'completed' | 'cancelled') =>
    client.patch(`/bookings/${id}/status`, { status }).then(unwrap) as Promise<any>,
  getBookingReport: (from: string, to: string) =>
    client.get('/bookings/report', { params: { from, to } }).then(unwrap) as Promise<any>,
  /** Dates as YYYY-MM-DD (local days, both included) or ISO instants. */
  getReportSummary: (from: string, to: string) =>
    client.get('/reports/summary', { params: { from, to } }).then(unwrap) as Promise<ReportSummaryDto>,
  finalizeContract: (id: string, data: { signature: string; customerEmail?: string }) =>
    client.post(`/bookings/${id}/finalize-contract`, data).then(unwrap) as Promise<any>,
  downloadContract: (id: string) =>
    client.get(`/bookings/${id}/download-contract`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  /**
   * Booking + company data, clauses, the active template (templateId, null = built-in contract), the open damages and who
   * signs for the company (companySigner.hasSignature=false: finalizing is blocked with 422 'company_signature_missing').
   * pdfUrl is the API path of the pre-filled, company-signed contract: use downloadContractDraft().
   */
  getContractPreview: (id: string) =>
    client.get(`/bookings/${id}/contract-preview`).then(unwrap) as Promise<ContractPreviewDto>,
  /** The contract pre-filled from the booking, signed by the company, renter's signature empty (PDF blob). 422 'company_signature_missing'. */
  downloadContractDraft: (id: string) =>
    client.get(`/bookings/${id}/contract-draft.pdf`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  /**
   * (Re)sends the contract package: signed contract + latest pick-up damage report + rental invoice, whatever exists.
   * `email` overrides the booking's address. 409 'contract_not_signed', 422 'no_recipient'.
   */
  sendContractPackage: (id: string, email?: string) =>
    client.post(`/bookings/${id}/send-contract-package`, email ? { email } : {}).then(unwrap) as Promise<{
      emailSent: boolean;
      status: 'SENT' | 'QUEUED' | 'FAILED';
      emailMessageId: string;
      includes: { contract: boolean; damageReport: boolean; invoice: boolean };
      error?: string;
    }>,

  // ─── Settings (CMS) ───────────────────────────────────────
  getSettings: () =>
    client.get('/settings').then(unwrap) as Promise<Record<string, any>>,
  getSetting: (key: string) =>
    client.get(`/settings/${key}`).then(unwrap) as Promise<any>,
  /** For translatable keys the value may carry `i18n: { en: {...}, fr: {...} }` (German stays in the normal fields). */
  updateSetting: (key: string, value: any) =>
    client.put(`/settings/${key}`, { value }).then(unwrap) as Promise<any>,
  /** Active currency ({ code }); CHF when unset. */
  getCurrency: () =>
    client.get('/settings/currency').then(unwrap) as Promise<{ code: CurrencyCode } | null>,
  /** Saving also sets the currency of EVERY vehicle; existing bookings / invoices keep their own. */
  setCurrency: (code: CurrencyCode) =>
    client.put('/settings/currency', { value: { code } }).then(unwrap) as Promise<{ code: CurrencyCode }>,

  // ─── Pricing Rules (real discount tiers, not marketing copy) ──
  /** Public tiers sorted by fromDay: [{ fromDay, toDay|null, discountPercent }]. */
  getPricingTiers: () =>
    client.get('/pricing/tiers').then(unwrap) as Promise<PricingTierDto[]>,
  getPricingRules: () =>
    client.get('/pricing/rules').then(unwrap) as Promise<any[]>,
  createPricingRule: (data: { fromDay: number; toDay: number | null; discountPercent: number }) =>
    client.post('/pricing/rules', data).then(unwrap) as Promise<any>,
  updatePricingRule: (id: string, data: { fromDay: number; toDay: number | null; discountPercent: number }) =>
    client.patch(`/pricing/rules/${id}`, data).then(unwrap) as Promise<any>,
  deletePricingRule: (id: string) =>
    client.delete(`/pricing/rules/${id}`).then(unwrap) as Promise<any>,

  // ─── Vehicle Maintenance / Decommission Periods ────────────
  getMaintenance: (vehicleId?: string) =>
    client.get('/maintenance', { params: vehicleId ? { vehicleId } : {} }).then(unwrap) as Promise<any[]>,
  createMaintenance: (data: { vehicleId: string; startDate: string; endDate: string; reason: 'repair' | 'accident' | 'other'; notes?: string }) =>
    client.post('/maintenance', data).then(unwrap) as Promise<any>,
  deleteMaintenance: (id: string) =>
    client.delete(`/maintenance/${id}`).then(unwrap) as Promise<any>,

  // ─── Locations (Standorte) ────────────────────────────────
  getLocations: () =>
    client.get('/locations').then(unwrap) as Promise<any[]>,
  createLocation: (data: { name: string; address: string; zip: string; city: string; country?: string; phone?: string; email?: string; openingHours?: string | null }) =>
    client.post('/locations', data).then(unwrap) as Promise<any>,
  /** data may include openingHours (multi-line text; '' or null clears it). */
  updateLocation: (id: string, data: any) =>
    client.patch(`/locations/${id}`, data).then(unwrap) as Promise<any>,
  deleteLocation: (id: string) =>
    client.delete(`/locations/${id}`).then(unwrap) as Promise<any>,

  // ─── Notifications ────────────────────────────────────────
  getNotifications: (unreadOnly?: boolean) =>
    client.get('/notifications', { params: unreadOnly ? { unreadOnly: 'true' } : {} }).then(unwrap) as Promise<{ items: any[]; unreadCount: number }>,
  markNotificationRead: (id: string) =>
    client.patch(`/notifications/${id}/read`).then(unwrap) as Promise<any>,
  markAllNotificationsRead: () =>
    client.patch('/notifications/read-all').then(unwrap) as Promise<any>,

  // ─── Invoices ─────────────────────────────────────────────
  getInvoices: (params?: { status?: string; bookingId?: string }) =>
    client.get('/invoices', { params }).then(unwrap) as Promise<any[]>,
  /**
   * Rental (original body, `type` may be omitted): { bookingId, periodStart, periodEnd, notes?, vatRate?, dueDays?, withQrBill?, sendEmail? }.
   * Custom: { type: 'DAMAGE'|'FINE'|'OTHER', bookingId?, debtor?, items: [{ description, quantity, unitPrice, vatRate?, feeId?, damageId?, fineId? }], ... }.
   * The debtor defaults from the booking's driver details. withQrBill omitted = default of the invoice settings; true with
   * incomplete creditor data rejects with 422 code 'qr_bill_unavailable' (error.data.missing = settings to complete).
   * The result carries emailSent / emailError when a mail was requested (rental invoices are mailed unless sendEmail:false).
   */
  createInvoice: (data: CreateInvoiceRequest) =>
    client.post('/invoices', data).then(unwrap) as Promise<InvoiceWithMailDto>,
  toggleInvoiceStatus: (id: string, status: 'PENDING' | 'PAID') =>
    client.patch(`/invoices/${id}/status`, { status }).then(unwrap) as Promise<any>,
  /**
   * Creates the linked dunning invoice. sendEmail=true also mails it as a reminder (Mahnung);
   * the result then carries emailSent and, if it was not delivered, emailError ('no_recipient' | 'send_failed').
   */
  reissueInvoice: (id: string, data: { penalty: number; notes?: string; sendEmail?: boolean }) =>
    client.post(`/invoices/${id}/reissue`, data).then(unwrap) as Promise<any>,
  /**
   * PDF blob. qr:true renders the Swiss QR payment slip on demand (whatever the invoice's withQrBill flag says), qr:false omits it;
   * 422 'qr_bill_unavailable' when the creditor data (Settings → Rechnungsinfos / Firmendaten) is incomplete.
   */
  downloadInvoice: (id: string, options?: { qr?: boolean }) =>
    client
      .get(`/invoices/${id}/download`, {
        responseType: 'blob',
        params: options?.qr === undefined ? undefined : { qr: options.qr ? 1 : 0 },
      })
      .then((res) => res.data) as Promise<Blob>,

  // ─── Search ───────────────────────────────────────────────
  globalSearch: (q: string) =>
    client.get('/search', { params: { q } }).then(unwrap) as Promise<any>,

  // ─── Testimonials ─────────────────────────────────────────
  getTestimonials: () =>
    client.get('/testimonials/all').then(unwrap) as Promise<any[]>,
  /** translations: { en: { text, location }, ... } (null clears). */
  createTestimonial: (data: { name: string; location?: string; text: string; rating?: number; avatarUrl?: string; isActive?: boolean; sortOrder?: number; translations?: Translations<{ text: string; location: string }> | null }) =>
    client.post('/testimonials', data).then(unwrap) as Promise<any>,
  updateTestimonial: (id: string, data: any) =>
    client.patch(`/testimonials/${id}`, data).then(unwrap) as Promise<any>,
  deleteTestimonial: (id: string) =>
    client.delete(`/testimonials/${id}`).then(unwrap) as Promise<any>,

  // ─── FAQ Items ────────────────────────────────────────────
  getFaqItems: () =>
    client.get('/faq/all').then(unwrap) as Promise<any[]>,
  /** translations: { en: { question, answer }, ... } (null clears). updateFaqItem accepts it too. */
  createFaqItem: (data: { question: string; answer: string; category?: string; isActive?: boolean; sortOrder?: number; translations?: Translations<{ question: string; answer: string }> | null }) =>
    client.post('/faq', data).then(unwrap) as Promise<any>,
  updateFaqItem: (id: string, data: any) =>
    client.patch(`/faq/${id}`, data).then(unwrap) as Promise<any>,
  deleteFaqItem: (id: string) =>
    client.delete(`/faq/${id}`).then(unwrap) as Promise<any>,

  // ─── Homepage Sections ────────────────────────────────────
  getHomepageSections: () =>
    client.get('/homepage-sections/all').then(unwrap) as Promise<any[]>,
  /** translations: { en: <same shape as content, partial>, fr: ... } deep-merged over the German content on the website. */
  updateHomepageSection: (key: string, data: { content?: any; sortOrder?: number; isActive?: boolean; translations?: Translations<any> | null }) =>
    client.put(`/homepage-sections/${key}`, data).then(unwrap) as Promise<any>,
  toggleHomepageSection: (key: string) =>
    client.patch(`/homepage-sections/${key}/toggle`).then(unwrap) as Promise<any>,

  // ─── Customers & marketing (permission area: marketing) ───
  /** Directory built from bookings + inquiries, deduplicated by e-mail. `eligible` is decided by the server. */
  getCustomers: (params?: { q?: string; filter?: CustomerFilter; page?: number; pageSize?: number }) =>
    client.get('/customers', { params }).then(unwrap) as Promise<CustomersPageDto>,

  /** personal: 'true' = also list the per-recipient codes of PERSONAL campaigns, 'only' = just those. */
  getDiscountCodes: (params?: { q?: string; status?: string; campaignId?: string; personal?: 'true' | 'only'; page?: number; pageSize?: number }) =>
    client.get('/discount-codes', { params }).then(unwrap) as Promise<PaginatedResponse<DiscountCodeDto>>,
  getDiscountCode: (id: string) =>
    client.get(`/discount-codes/${id}`).then(unwrap) as Promise<DiscountCodeDetailDto>,
  /** `code` is generated (HD-XXXX-XXXX) when omitted. validFrom / validUntil: YYYY-MM-DD (whole business days) or ISO. 409 'code_taken'. */
  createDiscountCode: (data: CreateDiscountCodeRequest) =>
    client.post('/discount-codes', data).then(unwrap) as Promise<DiscountCodeDto>,
  /** The code text can only change before its first redemption (409 'code_locked'). */
  updateDiscountCode: (id: string, data: UpdateDiscountCodeRequest) =>
    client.patch(`/discount-codes/${id}`, data).then(unwrap) as Promise<DiscountCodeDto>,
  /** 409 'has_redemptions' for redeemed codes: deactivate them instead. */
  deleteDiscountCode: (id: string) =>
    client.delete(`/discount-codes/${id}`).then(unwrap) as Promise<null>,
  /** Public endpoint; with vehicleId + days the discount is computed on the real price. */
  validateDiscountCode: (params: { code: string; email?: string; vehicleId?: string; days?: number }) =>
    client.get('/discount-codes/validate', { params }).then(unwrap) as Promise<DiscountValidationDto>,

  getCampaigns: (params?: { page?: number; pageSize?: number }) =>
    client.get('/marketing/campaigns', { params }).then(unwrap) as Promise<PaginatedResponse<CampaignDto>>,
  /** Incl. per-recipient status (recipients[]). */
  getCampaign: (id: string) =>
    client.get(`/marketing/campaigns/${id}`).then(unwrap) as Promise<CampaignDto>,
  /** Dry run: recipient count (eligible only), skipped addresses, sample code. */
  previewCampaign: (data: CreateCampaignRequest) =>
    client.post('/marketing/campaigns/preview', data).then(unwrap) as Promise<CampaignPreviewDto>,
  /** Queues one mail per eligible recipient (422 'no_recipients' when nobody is eligible). Resolves the campaign + skipped[]. */
  createCampaign: (data: CreateCampaignRequest) =>
    client.post('/marketing/campaigns', data).then(unwrap) as Promise<CampaignDto & { skipped: string[] }>,

  // ─── Contract templates + AGB (permission area: websiteSettings) ───
  getContractTemplates: () =>
    client.get('/contract-templates').then(unwrap) as Promise<ContractTemplateDto[]>,
  /**
   * Uploads a fillable PDF (<= 10 MB). The server reads the AcroForm fields and answers with the report
   * (fields.known / unknown / signatureFields / missingRecommended). Activated unless activate:false.
   * Errors: 415 'unsupported_file', 413 'file_too_large', 422 'invalid_pdf' | 'no_form_fields'.
   */
  uploadContractTemplate: (file: File | Blob, options?: { name?: string; activate?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.name) formData.append('name', options.name);
    if (options?.activate === false) formData.append('activate', 'false');
    return client
      .post('/contract-templates', formData, { headers: { 'Content-Type': undefined } })
      .then(unwrap) as Promise<ContractTemplateDto>;
  },
  renameContractTemplate: (id: string, name: string) =>
    client.patch(`/contract-templates/${id}`, { name }).then(unwrap) as Promise<ContractTemplateDto>,
  /** Only one template is active. */
  activateContractTemplate: (id: string) =>
    client.post(`/contract-templates/${id}/activate`).then(unwrap) as Promise<ContractTemplateDto>,
  /** Back to the built-in contract. */
  deactivateContractTemplates: () =>
    client.post('/contract-templates/deactivate').then(unwrap) as Promise<null>,
  /** 409 'template_in_use' while contracts were created from it. */
  deleteContractTemplate: (id: string) =>
    client.delete(`/contract-templates/${id}`).then(unwrap) as Promise<null>,
  /** Generated fillable starter PDF with every supported field (PDF blob). */
  downloadContractStarter: () =>
    client.get('/contract-templates/starter.pdf', { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  /** The uploaded original (PDF blob). */
  downloadContractTemplate: (id: string) =>
    client.get(`/contract-templates/${id}/download`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  /** Template filled with the booking (or sample data without bookingId), flattened, AGB attached (PDF blob). */
  previewContractTemplate: (id: string, bookingId?: string) =>
    client
      .get(`/contract-templates/${id}/preview.pdf`, { responseType: 'blob', params: bookingId ? { bookingId } : undefined })
      .then((res) => res.data) as Promise<Blob>,
  getAgbInfo: () =>
    client.get('/legal/agb/info').then(unwrap) as Promise<{ custom: boolean; size: number; pages: number | null; updatedAt: string }>,
  /** Replaces the bundled AGB (PDF <= 10 MB). The AGB is appended to every contract and served at GET /legal/agb. */
  uploadAgb: (file: File | Blob) => {
    const formData = new FormData();
    formData.append('file', file);
    return client
      .put('/legal/agb', formData, { headers: { 'Content-Type': undefined } })
      .then(unwrap) as Promise<{ custom: boolean; size: number; pages: number; updatedAt: string }>;
  },
  /** Back to the bundled AGB. */
  resetAgb: () => client.delete('/legal/agb').then(unwrap) as Promise<null>,

  // ─── Fee catalog (read: websiteSettings | contracts | fines, write: websiteSettings) ───
  getFees: (options?: { activeOnly?: boolean }) =>
    client.get('/fees', { params: options?.activeOnly ? { active: 1 } : undefined }).then(unwrap) as Promise<FeeDto[]>,
  createFee: (data: CreateFeeRequest) =>
    client.post('/fees', data).then(unwrap) as Promise<FeeDto>,
  updateFee: (id: string, data: UpdateFeeRequest) =>
    client.patch(`/fees/${id}`, data).then(unwrap) as Promise<FeeDto>,
  deleteFee: (id: string) =>
    client.delete(`/fees/${id}`).then(unwrap) as Promise<null>,

  // ─── Vehicle damages + inspections (permission area: damages) ───
  /** status: 'OPEN' | 'REPAIRED', default all. Oldest first = the pin numbers of the reports. */
  getVehicleDamages: (vehicleId: string, status?: 'OPEN' | 'REPAIRED') =>
    client.get(`/vehicles/${vehicleId}/damages`, { params: status ? { status } : undefined }).then(unwrap) as Promise<VehicleDamageDto[]>,
  /** view + x + y (0..1 of CAR_DIAGRAM[view]); zone defaults to suggestDamageZone(view, x, y). */
  createDamage: (vehicleId: string, data: CreateDamageRequest) =>
    client.post(`/vehicles/${vehicleId}/damages`, data).then(unwrap) as Promise<VehicleDamageDto>,
  /** status: 'REPAIRED' sets repairedAt, 'OPEN' clears it. */
  updateDamage: (vehicleId: string, id: string, data: UpdateDamageRequest) =>
    client.patch(`/vehicles/${vehicleId}/damages/${id}`, data).then(unwrap) as Promise<VehicleDamageDto>,
  repairDamage: (vehicleId: string, id: string, repairedAt?: string) =>
    client.post(`/vehicles/${vehicleId}/damages/${id}/repair`, repairedAt ? { repairedAt } : {}).then(unwrap) as Promise<VehicleDamageDto>,
  deleteDamage: (vehicleId: string, id: string) =>
    client.delete(`/vehicles/${vehicleId}/damages/${id}`).then(unwrap) as Promise<null>,
  /** Up to 10 images (<= 10 MB each, JPG / PNG / WebP) per call, <= 20 per damage; stored as JPEG, max 1600 px. Resolves the damage. */
  uploadDamagePhotos: (damageId: string, files: (File | Blob)[]) => {
    const formData = new FormData();
    for (const file of files) formData.append('photos', file);
    return client
      .post(`/damages/${damageId}/photos`, formData, { headers: { 'Content-Type': undefined } })
      .then(unwrap) as Promise<VehicleDamageDto>;
  },
  /** Resolves the damage without the photo. */
  deleteDamagePhoto: (damageId: string, photoId: string) =>
    client.delete(`/damages/${damageId}/photos/${photoId}`).then(unwrap) as Promise<VehicleDamageDto>,
  /**
   * URL for <img src>: the photo route is authenticated, so the access token goes in the query string
   * (like the SSE stream). Build it at render time: the token expires and is refreshed in the background.
   */
  damagePhotoUrl: (photoId: string): string => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
    return `${client.defaults.baseURL}/damages/photos/${photoId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  /** The photo as a Blob (Bearer header, no token in the URL). */
  fetchDamagePhoto: (photoId: string) =>
    client.get(`/damages/photos/${photoId}`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  getBookingInspections: (bookingId: string) =>
    client.get(`/bookings/${bookingId}/inspections`).then(unwrap) as Promise<BookingInspectionDto[]>,
  /**
   * PICKUP or RETURN: snapshots the open damages and renders the report PDF (car views with numbered pins, table, photos,
   * signature lines). newDamageIds (RETURN only) marks damages found during this rental.
   */
  createInspection: (bookingId: string, data: CreateInspectionRequest) =>
    client.post(`/bookings/${bookingId}/inspections`, data).then(unwrap) as Promise<BookingInspectionDto>,
  downloadInspectionReport: (inspectionId: string) =>
    client.get(`/inspections/${inspectionId}/report.pdf`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,

  // ─── Fines (permission area: fines) ───
  /**
   * Who had the vehicle? plate (any spelling) + at (ISO date-time, or YYYY-MM-DD = time unknown).
   * candidates[].matchType 'exact' | 'whole_day'; warning 'no_vehicle' | 'none' | 'multiple' | null.
   */
  lookupFine: (plate: string, at: string) =>
    client.get('/fines/lookup', { params: { plate, at } }).then(unwrap) as Promise<FineLookupDto>,
  getFines: (params?: { status?: FineStatus; q?: string; plate?: string; bookingId?: string; page?: number; pageSize?: number }) =>
    client.get('/fines', { params }).then(unwrap) as Promise<FinesPageDto>,
  getFine: (id: string) =>
    client.get(`/fines/${id}`).then(unwrap) as Promise<FineDto>,
  /** With `document` (PDF / JPG / PNG, <= 10 MB) the request is multipart. */
  createFine: (data: CreateFineRequest, document?: File | Blob) => {
    if (!document) return client.post('/fines', data).then(unwrap) as Promise<FineDto>;
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) if (value !== undefined && value !== null) formData.append(key, String(value));
    formData.append('document', document);
    return client.post('/fines', formData, { headers: { 'Content-Type': undefined } }).then(unwrap) as Promise<FineDto>;
  },
  /** bookingId: null unassigns. */
  updateFine: (id: string, data: UpdateFineRequest) =>
    client.patch(`/fines/${id}`, data).then(unwrap) as Promise<FineDto>,
  /** 409 'fine_has_invoice' once invoiced. */
  deleteFine: (id: string) =>
    client.delete(`/fines/${id}`).then(unwrap) as Promise<null>,
  /** Replaces the document. Resolves the fine. */
  uploadFineDocument: (id: string, file: File | Blob) => {
    const formData = new FormData();
    formData.append('document', file);
    return client
      .post(`/fines/${id}/document`, formData, { headers: { 'Content-Type': undefined } })
      .then(unwrap) as Promise<FineDto>;
  },
  downloadFineDocument: (id: string) =>
    client.get(`/fines/${id}/document`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  deleteFineDocument: (id: string) =>
    client.delete(`/fines/${id}/document`).then(unwrap) as Promise<FineDto>,
  /** Status NEW -> ASSIGNED. 422 'booking_vehicle_mismatch'. */
  assignFine: (id: string, bookingId: string) =>
    client.post(`/fines/${id}/assign`, { bookingId }).then(unwrap) as Promise<FineDto>,
  /** Fahrerangaben for the authority (PDF blob). 409 'fine_not_assigned'. */
  downloadFineDriverExport: (id: string) =>
    client.get(`/fines/${id}/driver-export.pdf`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  /** Mails the renter with the fine document attached; ASSIGNED -> FORWARDED. 409 'fine_not_assigned', 422 'no_recipient'. */
  notifyFine: (id: string, note?: string) =>
    client.post(`/fines/${id}/notify`, note ? { note } : {}).then(unwrap) as Promise<FineNotifyResultDto>,
  /**
   * FINE invoice: the fine amount (no VAT) + the selected fees, debtor from the booking; status -> INVOICED.
   * 409 'fine_already_invoiced' | 'fine_not_assigned', 422 'qr_bill_unavailable'.
   */
  createFineInvoice: (id: string, data: CreateFineInvoiceRequest = {}) =>
    client.post(`/fines/${id}/invoice`, data).then(unwrap) as Promise<FineInvoiceResultDto>,

  // ─── E-mail log & settings (permission area: websiteSettings) ───
  getEmailStatus: () =>
    client.get('/email/status').then(unwrap) as Promise<EmailStatusDto>,
  getEmailMessages: (params?: { status?: EmailStatus; template?: string; q?: string; relatedType?: string; relatedId?: string; page?: number; pageSize?: number }) =>
    client.get('/email/messages', { params }).then(unwrap) as Promise<PaginatedResponse<EmailMessageDto>>,
  /** Incl. the rendered HTML (null for one-time-link mails). */
  getEmailMessage: (id: string) =>
    client.get(`/email/messages/${id}`).then(unwrap) as Promise<EmailMessageDetailDto>,
  /** FAILED / QUEUED rows are retried, SENT rows are copied. 409 'not_resendable' for invite / password-reset mails. */
  resendEmail: (id: string) =>
    client.post(`/email/messages/${id}/resend`).then(unwrap) as Promise<EmailSendResultDto>,
  /** Sends right away; status SENT or QUEUED (+ error) tells whether the provider accepted it. */
  sendTestEmail: (to: string) =>
    client.post('/email/test', { to }).then(unwrap) as Promise<EmailSendResultDto>,
};

// Re-exported so pages can type vehicle data without importing @hoppdrive/shared separately.
export type { VehicleDto };
