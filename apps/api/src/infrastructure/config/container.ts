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
  PrismaPasswordResetTokenRepository,
  PrismaReportingRepository,
} from '../persistence/repositories';

// ─── Infrastructure Services ──────────────────────────────────
import { BcryptPasswordHasher, JwtTokenService } from '../services/AuthServices';
import { InMemoryCacheService, RedisCacheService } from '../services/CacheService';
import { SharpImageService } from '../services/SharpImageService';
import { ContractStorageService } from '../services/ContractStorageService';
import { PrivateStorageService } from '../services/PrivateStorageService';
import { PdfService } from '../services/PdfService';
import { QrBillService } from '../services/QrBillService';
import { InvoiceService } from '../services/InvoiceService';
import { ContractTemplateService } from '../services/ContractTemplateService';
import { ContractService } from '../services/ContractService';
import { DamageReportService } from '../services/DamageReportService';
import { FineDocumentService } from '../services/FineDocumentService';
import { PrismaSettingsReader } from '../services/PrismaSettingsReader';
import { SettingsService } from '../services/SettingsService';
import { SignatureImageService } from '../services/SignatureImageService';
import { DiscountService } from '../services/DiscountService';
import { MarketingService } from '../services/MarketingService';
import { VehicleAvailabilityService } from '../services/VehicleAvailabilityService';
import { EmailService } from '../email/EmailService';
import { EmailWorker } from '../email/EmailWorker';
import { createTransportFromEnv } from '../email/transports';

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
  GetInviteInfoUseCase,
  AcceptInviteUseCase,
  ForgotPasswordUseCase,
  GetResetTokenInfoUseCase,
  ResetPasswordWithTokenUseCase,
} from '../../application/use-cases/auth';
import { ManageAdminsUseCase } from '../../application/use-cases/admins/ManageAdminsUseCase';
import { GetReportSummaryUseCase } from '../../application/use-cases/reports/GetReportSummaryUseCase';

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

  // Base URL of the admin app, used for invite / password-reset links in emails.
  // ADMIN_URL wins; NEXT_PUBLIC_ADMIN_URL is the variable the web app already uses.
  const adminUrl = (
    process.env.ADMIN_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    'http://localhost:98'
  ).replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_URL && !process.env.NEXT_PUBLIC_ADMIN_URL) {
    console.warn('[startup] ADMIN_URL is not set: invite and password-reset links will point to ' + adminUrl);
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

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const imageService = new SharpImageService(uploadDir);

  // Files with personal data (contracts, damage photos, ...) live here and are NEVER served statically.
  const privateStorage = new PrivateStorageService(process.env.PRIVATE_UPLOAD_DIR || './private');
  const contractStorage = new ContractStorageService(privateStorage, uploadDir);

  const settingsService = new SettingsService(prisma);
  const pdfService = new PdfService(privateStorage);
  const signatureImages = new SignatureImageService();
  const vehicleAvailability = new VehicleAvailabilityService(prisma);

  // E-mail: outbox + log in the database, transport chosen with EMAIL_PROVIDER (brevo | smtp | listmonk | log).
  const siteUrl = (
    process.env.PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://hoppdrive.ch'
  ).replace(/\/+$/, '');
  const emailTransport = createTransportFromEnv();
  const emailService = new EmailService(prisma, emailTransport, privateStorage, settingsService, {
    fromEmail: process.env.EMAIL_FROM || process.env.BREVO_SENDER_EMAIL || 'noreply@hoppdrive.ch',
    fromName: process.env.EMAIL_FROM_NAME || process.env.BREVO_SENDER_NAME || 'HoppDrive',
    adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@hoppdrive.ch',
    siteUrl,
    // Horizontal logo (car + wordmark) served by the website (apps/web/public/logos); override with EMAIL_LOGO_URL.
    logoUrl: process.env.EMAIL_LOGO_URL || `${siteUrl}/logos/logo-horizontal.png`,
    adminUrl,
  });
  const emailWorker = new EmailWorker(emailService);
  if (!emailTransport.isConfigured()) {
    console.warn(`[startup] EMAIL_PROVIDER=${emailTransport.name} is not fully configured: e-mails will fail until it is.`);
  }

  // Invoices (line items, Swiss QR bill), fillable contract templates, damage reports, fine documents.
  const qrBillService = new QrBillService();
  const invoiceService = new InvoiceService(prisma, settingsService, pdfService, qrBillService, emailService);
  const contractTemplateService = new ContractTemplateService(pdfService);
  const contractService = new ContractService(prisma, settingsService, pdfService, contractTemplateService, privateStorage);
  const damageReportService = new DamageReportService(pdfService, privateStorage);
  const fineDocumentService = new FineDocumentService(pdfService);

  const discountService = new DiscountService(prisma);
  const marketingService = new MarketingService(prisma, emailService, discountService, { siteUrl });

  // ─── Repositories ──────────────────────────────────────────
  const vehicleRepo = new PrismaVehicleRepository(prisma);
  const contactRepo = new PrismaContactRequestRepository(prisma);
  const adminRepo = new PrismaAdminRepository(prisma);
  const bookingRepo = new PrismaBookingRepository(prisma);
  const pricingRuleRepo = new PrismaPricingRuleRepository(prisma);
  const auditLogRepo = new PrismaAuditLogRepository(prisma);
  const maintenanceRepo = new PrismaVehicleMaintenanceRepository(prisma);
  const resetTokenRepo = new PrismaPasswordResetTokenRepository(prisma);
  const reportingRepo = new PrismaReportingRepository(prisma);
  const settingsReader = new PrismaSettingsReader(prisma);

  // ─── Use Cases ─────────────────────────────────────────────
  const createVehicle = new CreateVehicleUseCase(vehicleRepo, cacheService, settingsReader);
  const getAllVehicles = new GetAllVehiclesUseCase(vehicleRepo, cacheService);
  const getVehicleById = new GetVehicleByIdUseCase(vehicleRepo, cacheService);
  const updateVehicle = new UpdateVehicleUseCase(vehicleRepo, cacheService);
  const deleteVehicle = new DeleteVehicleUseCase(vehicleRepo, cacheService);

  const createContactRequest = new CreateContactRequestUseCase(contactRepo, emailService, settingsReader, marketingService);
  const getContactRequests = new GetContactRequestsUseCase(contactRepo);
  const updateContactStatus = new UpdateContactStatusUseCase(contactRepo);
  const cleanupOldRequests = new CleanupOldRequestsUseCase(contactRepo);

  const login = new LoginUseCase(adminRepo, passwordHasher, tokenService);
  const refreshToken = new RefreshTokenUseCase(adminRepo, tokenService);
  const resetPassword = new ResetPasswordUseCase(adminRepo, passwordHasher);
  const getInviteInfo = new GetInviteInfoUseCase(adminRepo);
  const acceptInvite = new AcceptInviteUseCase(adminRepo, passwordHasher, tokenService);
  const forgotPassword = new ForgotPasswordUseCase(adminRepo, resetTokenRepo, emailService, adminUrl);
  const getResetTokenInfo = new GetResetTokenInfoUseCase(adminRepo, resetTokenRepo);
  const resetPasswordWithToken = new ResetPasswordWithTokenUseCase(
    adminRepo,
    resetTokenRepo,
    passwordHasher,
    tokenService,
  );
  const manageAdmins = new ManageAdminsUseCase(adminRepo, resetTokenRepo, passwordHasher, emailService, adminUrl);

  const createBooking = new CreateBookingUseCase(bookingRepo, vehicleRepo, pricingRuleRepo, maintenanceRepo, discountService);
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
  const getDashboardStats = new GetDashboardStatsUseCase(bookingRepo, vehicleRepo, contactRepo, reportingRepo);
  const getReportSummary = new GetReportSummaryUseCase(reportingRepo, vehicleRepo);

  return {
    // Services
    prisma,
    cacheService,
    tokenService,
    imageService,
    emailService,
    emailWorker,
    privateStorage,
    contractStorage,
    pdfService,
    qrBillService,
    invoiceService,
    contractTemplateService,
    contractService,
    damageReportService,
    fineDocumentService,
    settingsService,
    signatureImages,
    discountService,
    marketingService,
    auditLogRepo,
    pricingRuleRepo,
    passwordHasher,
    contactRepo,
    resetTokenRepo,
    vehicleAvailability,
    adminUrl,

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
    getInviteInfo,
    acceptInvite,
    forgotPassword,
    getResetTokenInfo,
    resetPasswordWithToken,

    // Admin users
    manageAdmins,

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

    // Dashboard & reports
    getDashboardStats,
    getReportSummary,
  };
}

export type Container = ReturnType<typeof createContainer>;
