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
} from '../persistence/repositories';

// ─── Infrastructure Services ──────────────────────────────────
import { BcryptPasswordHasher, JwtTokenService } from '../services/AuthServices';
import { InMemoryCacheService, RedisCacheService } from '../services/CacheService';
import { BrevoEmailService } from '../services/BrevoEmailService';
import { SharpImageService } from '../services/SharpImageService';

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

import { CreateBookingUseCase, GetBookingsUseCase } from '../../application/use-cases/bookings';
import { CalculatePricingUseCase } from '../../application/use-cases/pricing/CalculatePricingUseCase';
import { GetDashboardStatsUseCase } from '../../application/use-cases/dashboard/GetDashboardStatsUseCase';

/**
 * Composition Root / DI Container.
 * Wires together all layers following the Dependency Inversion Principle.
 */
export function createContainer() {
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

  // ─── Repositories ──────────────────────────────────────────
  const vehicleRepo = new PrismaVehicleRepository(prisma);
  const contactRepo = new PrismaContactRequestRepository(prisma);
  const adminRepo = new PrismaAdminRepository(prisma);
  const bookingRepo = new PrismaBookingRepository(prisma);
  const pricingRuleRepo = new PrismaPricingRuleRepository(prisma);
  const auditLogRepo = new PrismaAuditLogRepository(prisma);

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

  const createBooking = new CreateBookingUseCase(bookingRepo, vehicleRepo, pricingRuleRepo);
  const getBookings = new GetBookingsUseCase(bookingRepo);

  const calculatePricing = new CalculatePricingUseCase(vehicleRepo, pricingRuleRepo);
  const getDashboardStats = new GetDashboardStatsUseCase(bookingRepo, vehicleRepo, contactRepo);

  return {
    // Services
    prisma,
    cacheService,
    tokenService,
    imageService,
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

    // Pricing
    calculatePricing,

    // Dashboard
    getDashboardStats,
  };
}

export type Container = ReturnType<typeof createContainer>;
