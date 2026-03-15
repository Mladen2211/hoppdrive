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
  isAvailable: boolean;
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
}

export interface UpdateVehicleRequest extends Partial<CreateVehicleRequest> {}

// ─── Pricing ────────────────────────────────────────────────────

export interface PricingBreakpointDto {
  id: string;
  fromDay: number;
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
  status: ContactRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export type ContactRequestStatus = 'pending' | 'reviewed' | 'responded' | 'converted' | 'archived';

export interface CreateContactRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  vehicleOfInterest?: string;
  message: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
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

export interface AdminDto {
  id: string;
  email: string;
  name: string;
  mustResetPassword: boolean;
}

// ─── Booking / Availability ─────────────────────────────────────

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
  monthlyRevenue: number;
  revenueChangePercent: number;
  fleetUtilization: number;
  totalVehicles: number;
  bookedVehicles: number;
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
