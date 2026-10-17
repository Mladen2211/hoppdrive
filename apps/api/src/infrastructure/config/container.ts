import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../persistence/prisma/client';

// ─── Repositories ─────────────────────────────────────────────
import {
  PrismaVehicleRepository,
  PrismaContactRequestRepository,
  PrismaAdminRepository,
  PrismaBookingRepository,
  PrismaPricingRuleRepository,
  PrismaAuditLogRepository,
  PrismaVehicleMaintenanceRepository,
} from '../persistence/repositories';

// ─── Infrastructure Services ──────────────────────────────────
import { BcryptPasswordHasher, JwtTokenService } from '../services/AuthServices';
import { InMemoryCacheService, RedisCacheService } from '../services/CacheService';
import { BrevoEmailService } from '../services/BrevoEmailService';
import { SharpImageService } from '../services/SharpImageService';
import { ContractStorageService } from '../services/ContractStorageService';
import { PdfService } from '../services/PdfService';

// ─── Use Cases ────────────────────────────────────────────────
import {
  CreateVehicleUseCase,
  GetAllVehiclesUseCase,
  GetVehicleByIdUseCase,
  UpdateVehicleUseCase,
  DeleteVehicleUseCase,
} from '../../application/use-cases/vehicles';

import {
  CreateContactRequestUseCase,
  GetContactRequestsUseCase,
  UpdateContactStatusUseCase,
  CleanupOldRequestsUseCase,
} from '../../application/use-cases/contact-requests';

import {
  LoginUseCase,
  RefreshTokenUseCase,
  ResetPasswordUseCase,
} from '../../application/use-cases/auth';

import { CreateBookingUseCase, GetBookingsUseCase, TransitionBookingStatusUseCase } from '../../application/use-cases/bookings';
import { CalculatePricingUseCase } from '../../application/use-cases/pricing/CalculatePricingUseCase';
import { GetPricingRulesUseCase } from '../../application/use-cases/pricing/GetPricingRulesUseCase';
import { CreatePricingRuleUseCase } from '../../application/use-cases/pricing/CreatePricingRuleUseCase';
import { UpdatePricingRuleUseCase } from '../../application/use-cases/pricing/UpdatePricingRuleUseCase';
import { DeletePricingRuleUseCase } from '../../application/use-cases/pricing/DeletePricingRuleUseCase';
import { ScheduleMaintenanceUseCase } from '../../application/use-cases/maintenance/ScheduleMaintenanceUseCase';
import { GetMaintenanceUseCase } from '../../application/use-cases/maintenance/GetMaintenanceUseCase';
import { DeleteMaintenanceUseCase } from '../../application/use-cases/maintenance/DeleteMaintenanceUseCase';
import { GetDashboardStatsUseCase } from '../../application/use-cases/dashboard/GetDashboardStatsUseCase';

/**
 * Composition Root / DI Container.
 * Wires together all layers following the Dependency Inversion Principle.
 */
export function createContainer() {
  // ─── Production env guard ──────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`[startup] Missing required environment variable: ${key}`);
      }
    }
  }

  // ─── Infrastructure ────────────────────────────────────────
  const prisma: PrismaClient = getPrismaClient();

  const cacheService = process.env.REDIS_URL
    ? new RedisCacheService(process.env.REDIS_URL)
    : new InMemoryCacheService();

  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(
    process.env.JWT_SECRET || 'dev-secret-change-me',
    process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  );

  const emailService = new BrevoEmailService(
    process.env.BREVO_API_KEY || '',
    process.env.BREVO_SENDER_EMAIL || 'noreply@hoppdrive.ch',
    process.env.BREVO_SENDER_NAME || 'HoppDrive',
    process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@hoppdrive.ch',
  );

  const imageService = new SharpImageService(
    process.env.UPLOAD_DIR || './uploads',
  );

  const contractStorage = new ContractStorageService(
    process.env.UPLOAD_DIR || './uploads',
  );

  const pdfService = new PdfService();

  // ─── Repositories ──────────────────────────────────────────
  const vehicleRepo = new PrismaVehicleRepository(prisma);
  const contactRepo = new PrismaContactRequestRepository(prisma);
  const adminRepo = new PrismaAdminRepository(prisma);
  const bookingRepo = new PrismaBookingRepository(prisma);
  const pricingRuleRepo = new PrismaPricingRuleRepository(prisma);
  const auditLogRepo = new PrismaAuditLogRepository(prisma);
  const maintenanceRepo = new PrismaVehicleMaintenanceRepository(prisma);

  // ─── Use Cases ─────────────────────────────────────────────
  const createVehicle = new CreateVehicleUseCase(vehicleRepo, cacheService);
  const getAllVehicles = new GetAllVehiclesUseCase(vehicleRepo, cacheService);
  const getVehicleById = new GetVehicleByIdUseCase(vehicleRepo, cacheService);
  const updateVehicle = new UpdateVehicleUseCase(vehicleRepo, cacheService);
  const deleteVehicle = new DeleteVehicleUseCase(vehicleRepo, cacheService);

  const createContactRequest = new CreateContactRequestUseCase(contactRepo, emailService);
  const getContactRequests = new GetContactRequestsUseCase(contactRepo);
  const updateContactStatus = new UpdateContactStatusUseCase(contactRepo);
  const cleanupOldRequests = new CleanupOldRequestsUseCase(contactRepo);

  const login = new LoginUseCase(adminRepo, passwordHasher, tokenService);
  const refreshToken = new RefreshTokenUseCase(adminRepo, tokenService);
  const resetPassword = new ResetPasswordUseCase(adminRepo, passwordHasher);

  const createBooking = new CreateBookingUseCase(bookingRepo, vehicleRepo, pricingRuleRepo, maintenanceRepo);
  const getBookings = new GetBookingsUseCase(bookingRepo);
  const transitionBookingStatus = new TransitionBookingStatusUseCase(bookingRepo);

  const calculatePricing = new CalculatePricingUseCase(vehicleRepo, pricingRuleRepo);
  const getPricingRules = new GetPricingRulesUseCase(pricingRuleRepo);
  const createPricingRule = new CreatePricingRuleUseCase(pricingRuleRepo);
  const updatePricingRule = new UpdatePricingRuleUseCase(pricingRuleRepo);
  const deletePricingRule = new DeletePricingRuleUseCase(pricingRuleRepo);
  const scheduleMaintenance = new ScheduleMaintenanceUseCase(maintenanceRepo, bookingRepo);
  const getMaintenance = new GetMaintenanceUseCase(maintenanceRepo);
  const deleteMaintenance = new DeleteMaintenanceUseCase(maintenanceRepo);
  const getDashboardStats = new GetDashboardStatsUseCase(bookingRepo, vehicleRepo, contactRepo);

  return {
    // Services
    prisma,
    cacheService,
    tokenService,
    imageService,
    emailService,
    contractStorage,
    pdfService,
    auditLogRepo,

    // Vehicles
    createVehicle,
    getAllVehicles,
    getVehicleById,
    updateVehicle,
    deleteVehicle,

    // Contact Requests
    createContactRequest,
    getContactRequests,
    updateContactStatus,
    cleanupOldRequests,

    // Auth
    login,
    refreshToken,
    resetPassword,

    // Bookings
    createBooking,
    getBookings,
    transitionBookingStatus,

    // Pricing
    calculatePricing,
    getPricingRules,
    createPricingRule,
    updatePricingRule,
    deletePricingRule,

    // Maintenance
    scheduleMaintenance,
    getMaintenance,
    deleteMaintenance,

    // Dashboard
    getDashboardStats,
  };
}

export type Container = ReturnType<typeof createContainer>;
