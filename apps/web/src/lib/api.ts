import type {
  VehicleDto,
  PricingCalculation,
  CreateContactRequestPayload,
} from '@hoppdrive/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

/**
 * Error thrown by every `api.*` call. `details` carries the API's per-field
 * validation messages of a 422 ({ email: ['Valid email is required'] }),
 * `network` is true when the server could not be reached at all.
 */
export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;
  network: boolean;

  constructor(message: string, status: number, details?: Record<string, string[]>, network = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.network = network;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    throw new ApiError('Server unreachable', 0, undefined, true);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page): handled below via the status code.
  }

  if (!res.ok) {
    throw new ApiError(json?.error || 'Request failed', res.status, json?.details);
  }

  return json?.data as T;
}

export interface HomepageSectionDto {
  sectionKey: string;
  isActive: boolean;
  sortOrder: number;
  content: Record<string, unknown>;
}

export interface TestimonialDto {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
}

export interface FaqItemDto {
  id: string;
  question: string;
  answer: string;
  category: string;
}

/** Payload of `POST /contact` (the shared type, which includes the page `locale`, plus the optional desired dates, ISO strings). */
export type SubmitContactPayload = CreateContactRequestPayload & {
  desiredStartDate?: string;
  desiredEndDate?: string;
};

/** Reason codes of an invalid discount code (`GET /discount-codes/validate`). Texts: messages -> contact.discount.reasons.<reason>. */
export type DiscountReason =
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

/** Answer of the public discount validation. A valid code carries its rule; amounts only come with vehicleId + days. */
export interface DiscountValidation {
  valid: boolean;
  /** Only when `valid` is false. Unknown values are shown with a generic text. */
  reason?: DiscountReason | string;
  message?: string;
  type?: 'PERCENT' | 'FIXED';
  value?: number;
  currency?: string | null;
  discount?: number | null;
  total?: number | null;
  totalAfterDiscount?: number | null;
  minDays?: number | null;
  validUntil?: string | null;
}

export interface DiscountValidationParams {
  code: string;
  email?: string;
  vehicleId?: string;
  days?: number;
}

/** `GET /marketing/unsubscribe/:token` (the e-mail address is masked: "m***@gmail.com"). */
export interface UnsubscribeStatus {
  valid: boolean;
  email?: string;
  unsubscribed?: boolean;
}

/** `POST /marketing/unsubscribe` */
export interface UnsubscribeResult {
  valid: boolean;
  alreadyUnsubscribed: boolean;
}

/** `?locale=xx` for the CMS endpoints (the API merges that language's translations over the German content). */
const localeQuery = (locale?: string) => (locale ? `?locale=${encodeURIComponent(locale)}` : '');

export const api = {
  getVehicles: (locale?: string) => request<VehicleDto[]>(`/vehicles${localeQuery(locale)}`),
  getVehicle: (id: string, locale?: string) => request<VehicleDto>(`/vehicles/${id}${localeQuery(locale)}`),
  calculatePricing: (vehicleId: string, days: number) =>
    request<PricingCalculation>(`/pricing?vehicleId=${vehicleId}&days=${days}`),
  submitContact: (data: SubmitContactPayload) =>
    request<{ id: string }>('/contact', { method: 'POST', body: JSON.stringify(data) }),
  getSetting: <T = unknown>(key: string, locale?: string) => request<T>(`/settings/${key}${localeQuery(locale)}`),
  validateDiscountCode: (params: DiscountValidationParams, signal?: AbortSignal) => {
    const query = new URLSearchParams({ code: params.code });
    if (params.email) query.set('email', params.email);
    if (params.vehicleId) query.set('vehicleId', params.vehicleId);
    if (params.days) query.set('days', String(params.days));
    return request<DiscountValidation>(`/discount-codes/validate?${query.toString()}`, { signal });
  },
  getUnsubscribeStatus: (token: string) =>
    request<UnsubscribeStatus>(`/marketing/unsubscribe/${encodeURIComponent(token)}`),
  unsubscribe: (token: string) =>
    request<UnsubscribeResult>('/marketing/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) }),
  getTestimonials: (locale?: string) => request<TestimonialDto[]>(`/testimonials${localeQuery(locale)}`),
  getFaq: (locale?: string) => request<FaqItemDto[]>(`/faq${localeQuery(locale)}`),
  getHomepageSections: (locale?: string) => request<HomepageSectionDto[]>(`/homepage-sections${localeQuery(locale)}`),
};
