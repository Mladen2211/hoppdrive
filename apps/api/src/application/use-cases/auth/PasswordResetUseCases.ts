import {
  generateOpaqueToken,
  hashOpaqueToken,
  type IAdminRepository,
  type IPasswordResetTokenRepository,
} from '../../../domain';
import type { IPasswordHasher, ITokenService } from '../../interfaces/IAuthService';
import type { IEmailService } from '../../interfaces/IEmailService';
import { AppError } from '../../errors';
import { assertPasswordAcceptable } from './passwordPolicy';
import { toAdminSessionDto, type AuthSessionResult } from './dto';

export const RESET_TOKEN_TTL_MINUTES = 60;
/** At most one reset mail per account per this window (protects inboxes from being flooded). */
const RESEND_THROTTLE_MS = 60 * 1000;

const INVALID_RESET_MESSAGE =
  'Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.';

/**
 * POST /auth/forgot-password — never reveals whether the email belongs to an account:
 * callers always answer 200, this use case silently does nothing for unknown, deleted
 * or not-yet-activated accounts.
 */
export class ForgotPasswordUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private resetTokenRepo: IPasswordResetTokenRepository,
    private emailService: IEmailService,
    private adminUrl: string,
  ) {}

  async execute(email: string): Promise<void> {
    const admin = await this.adminRepo.findByEmail(email.toLowerCase().trim());
    if (!admin || !admin.isActive) return;

    const latest = await this.resetTokenRepo.findLatestForAdmin(admin.id);
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_THROTTLE_MS) return;

    // A new request invalidates older links.
    await this.resetTokenRepo.invalidateAllForAdmin(admin.id);

    const { raw, hash } = generateOpaqueToken();
    await this.resetTokenRepo.create({
      adminId: admin.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });

    await this.emailService.sendPasswordReset({
      to: admin.email.value,
      resetUrl: `${this.adminUrl}/reset-password?token=${raw}`,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  }
}

/** GET /auth/reset-token/:token — drives the expiry line on the reset page. */
export class GetResetTokenInfoUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private resetTokenRepo: IPasswordResetTokenRepository,
  ) {}

  async execute(rawToken: string): Promise<{ valid: boolean; expiresInMinutes: number }> {
    const record = await this.resetTokenRepo.findByHash(hashOpaqueToken(rawToken));
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      return { valid: false, expiresInMinutes: 0 };
    }
    const admin = await this.adminRepo.findById(record.adminId);
    if (!admin || !admin.isActive) return { valid: false, expiresInMinutes: 0 };

    return {
      valid: true,
      expiresInMinutes: Math.max(1, Math.ceil((record.expiresAt.getTime() - Date.now()) / 60000)),
    };
  }
}

interface ResetWithTokenInput {
  token: string;
  newPassword: string;
}

/**
 * POST /auth/reset-password-token — sets the password, burns the token, clears the
 * lockout and the forced-reset flag, and signs the admin in ("Danach werden Sie
 * automatisch angemeldet").
 */
export class ResetPasswordWithTokenUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private resetTokenRepo: IPasswordResetTokenRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
  ) {}

  async execute(input: ResetWithTokenInput): Promise<AuthSessionResult> {
    const record = await this.resetTokenRepo.findByHash(hashOpaqueToken(input.token));
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new AppError(INVALID_RESET_MESSAGE, 400, 'invalid_token');
    }

    const admin = await this.adminRepo.findById(record.adminId);
    if (!admin || !admin.isActive) {
      throw new AppError(INVALID_RESET_MESSAGE, 400, 'invalid_token');
    }

    // Validate before claiming the token so a too-weak password does not burn the link.
    await assertPasswordAcceptable(this.passwordHasher, input.newPassword, {
      currentHash: admin.passwordHash,
    });

    // Atomic claim: if a concurrent request already used this link, only one wins.
    const claimed = await this.resetTokenRepo.markUsed(record.id);
    if (!claimed) {
      throw new AppError(INVALID_RESET_MESSAGE, 400, 'invalid_token');
    }

    admin.completePasswordReset(await this.passwordHasher.hash(input.newPassword));
    await this.adminRepo.update(admin);
    await this.resetTokenRepo.invalidateAllForAdmin(admin.id);
    await this.adminRepo.registerSuccessfulLogin(admin.id);

    return {
      accessToken: this.tokenService.generateAccessToken(admin),
      refreshToken: this.tokenService.generateRefreshToken(admin),
      admin: toAdminSessionDto(admin),
    };
  }
}
