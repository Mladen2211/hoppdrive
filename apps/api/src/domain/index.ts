// ─── Domain Entities ──────────────────────────────────────────
export { Entity } from './entities/Entity';
export { Vehicle, type VehicleProps, type VehicleImage, type VehicleType } from './entities/Vehicle';
export { ContactRequest, type ContactRequestProps, type ContactRequestStatus } from './entities/ContactRequest';
export { Admin, type AdminProps } from './entities/Admin';
export { Booking, type BookingProps, type BookingStatus } from './entities/Booking';
export { PricingRule, type PricingRuleProps } from './entities/PricingRule';
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
export type { IBookingRepository } from './repositories/IBookingRepository';
export type { IPricingRuleRepository } from './repositories/IPricingRuleRepository';
export type { IAuditLogRepository } from './repositories/IAuditLogRepository';

// ─── Domain Services ─────────────────────────────────────────
export { PricingService, type PricingResult } from './services/PricingService';
