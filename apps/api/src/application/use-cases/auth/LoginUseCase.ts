import { randomUUID } from 'crypto';
import type { IAdminRepository } from '../../../domain';
import type { IPasswordHasher, ITokenService } from '../../interfaces/IAuthService';
import { AccountLockedError, AppError } from '../../errors';
import { toAdminSessionDto, type AuthSessionResult } from './dto';

interface LoginInput {
  email: string;
  password: string;
}

/** Per-account lockout: 5 wrong passwords lock the account for 15 minutes. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export type LoginResult = AuthSessionResult;

export class LoginUseCase {
  /** Lazily computed bcrypt hash used to keep response time similar for unknown emails. */
  private dummyHash: string | null = null;

  constructor(
    private adminRepo: IAdminRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const admin = await this.adminRepo.findByEmail(input.email.toLowerCase().trim());

    // Unknown, deleted and not-yet-activated (pending invite) accounts all look
    // exactly like a wrong password: no account enumeration.
    if (!admin || !admin.isActive) {
      this.dummyHash ??= await this.passwordHasher.hash(randomUUID());
      await this.passwordHasher.compare(input.password, this.dummyHash);
      throw this.invalidCredentials();
    }

    // Locked accounts are rejected before the password is even checked, so a
    // correct password cannot be used to probe whether the lock is still active.
    if (admin.isLocked()) {
      throw new AccountLockedError(admin.lockedUntil!, admin.id);
    }

    const isValid = await this.passwordHasher.compare(input.password, admin.passwordHash);
    if (!isValid) {
      const result = await this.adminRepo.registerFailedLogin(
        admin.id,
        MAX_FAILED_LOGIN_ATTEMPTS,
        LOCKOUT_DURATION_MS,
      );
      if (result.lockedUntil) {
        throw new AccountLockedError(result.lockedUntil, admin.id, true);
      }
      throw this.invalidCredentials();
    }

    // Success: reset the counter, clear any expired lock and stamp lastActiveAt.
    await this.adminRepo.registerSuccessfulLogin(admin.id);

    return {
      accessToken: this.tokenService.generateAccessToken(admin),
      refreshToken: this.tokenService.generateRefreshToken(admin),
      admin: toAdminSessionDto(admin),
    };
  }

  private invalidCredentials(): AppError {
    return new AppError(
      'E-Mail oder Passwort stimmt nicht. Prüfen Sie die Eingabe und versuchen Sie es erneut.',
      401,
      'invalid_credentials',
    );
  }
}
