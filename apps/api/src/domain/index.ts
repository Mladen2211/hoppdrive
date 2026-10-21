// ─── Domain Entities ──────────────────────────────────────────
export { Entity } from './entities/Entity';
export { Vehicle, type VehicleProps, type VehicleImage, type VehicleType } from './entities/Vehicle';
export { ContactRequest, type ContactRequestProps, type ContactRequestStatus } from './entities/ContactRequest';
export { Admin, type AdminProps } from './entities/Admin';
export { Booking, type BookingProps, type BookingStatus } from './entities/Booking';
export { PricingRule, type PricingRuleProps } from './entities/PricingRule';
export { VehicleMaintenance, type VehicleMaintenanceProps, type MaintenanceReason } from './entities/VehicleMaintenance';
export { AuditLog, type AuditLogProps } from './entities/AuditLog';

// ─── Value Objects ────────────────────────────────────────────
export { Email } from './value-objects/Email';
export { Phone } from './value-objects/Phone';
export { Money } from './value-objects/Money';
export { DateRange } from './value-objects/DateRange';
export { VehicleSpecs, type FuelType, type TransmissionType } from './value-objects/VehicleSpecs';

// ─── Repository Interfaces ───────────────────────────────────
export type { IVehicleRepository } from './repositories/IVehicleRepository';
export type { IContactRequestRepository } from './repositories/IContactRequestRepository';
export type { IAdminRepository } from './repositories/IAdminRepository';
export type { IBookingRepository, BookingExtras } from './repositories/IBookingRepository';
export type { IPricingRuleRepository } from './repositories/IPricingRuleRepository';
export type { IVehicleMaintenanceRepository } from './repositories/IVehicleMaintenanceRepository';
export type { IAuditLogRepository } from './repositories/IAuditLogRepository';
export type {
  IPasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from './repositories/IPasswordResetTokenRepository';
export type { IReportingRepository } from './repositories/IReportingRepository';

// ─── Domain Services ─────────────────────────────────────────
export { PricingService, type PricingResult } from './services/PricingService';
export {
  type BookingSlice,
  overlapMs,
  proratedRevenue,
  bookingDays,
  round1,
  round2,
  percentChange,
} from './services/RevenueCalculator';
export * as TimeUtils from './services/TimeUtils';
export { generateOpaqueToken, hashOpaqueToken } from './services/OpaqueToken';
