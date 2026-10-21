import { hashOpaqueToken, type IAdminRepository } from '../../../domain';
import type { IPasswordHasher, ITokenService } from '../../interfaces/IAuthService';
import { AppError } from '../../errors';
import { assertPasswordAcceptable } from './passwordPolicy';
import { toAdminSessionDto, type AuthSessionResult } from './dto';
import type { AdminRole } from '@hoppdrive/shared';

const INVALID_INVITE_MESSAGE =
  'Der Einladungslink ist ungültig oder abgelaufen. Bitten Sie um eine neue Einladung.';

/** GET /auth/invite/:token — lets the accept-invite page show the email and role up front. */
export class GetInviteInfoUseCase {
  constructor(private adminRepo: IAdminRepository) {}

  async execute(rawToken: string): Promise<{ valid: boolean; email: string | null; role: AdminRole | null }> {
    const admin = await this.adminRepo.findByInviteTokenHash(hashOpaqueToken(rawToken));
    const valid =
      !!admin &&
      !admin.isDeleted &&
      !!admin.inviteExpiresAt &&
      admin.inviteExpiresAt.getTime() > Date.now();
    if (!valid || !admin) return { valid: false, email: null, role: null };
    return { valid: true, email: admin.email.value, role: admin.role };
  }
}

interface AcceptInviteInput {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

/** POST /auth/accept-invite — sets name + password, activates the account and logs in. */
export class AcceptInviteUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
  ) {}

  async execute(input: AcceptInviteInput): Promise<AuthSessionResult> {
    const admin = await this.adminRepo.findByInviteTokenHash(hashOpaqueToken(input.token));
    if (
      !admin ||
      admin.isDeleted ||
      !admin.inviteExpiresAt ||
      admin.inviteExpiresAt.getTime() <= Date.now()
    ) {
      throw new AppError(INVALID_INVITE_MESSAGE, 400, 'invalid_token');
    }

    await assertPasswordAcceptable(this.passwordHasher, input.password, { field: 'password' });

    admin.acceptInvite({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash: await this.passwordHasher.hash(input.password),
    });
    await this.adminRepo.update(admin);
    await this.adminRepo.registerSuccessfulLogin(admin.id);

    return {
      accessToken: this.tokenService.generateAccessToken(admin),
      refreshToken: this.tokenService.generateRefreshToken(admin),
      admin: toAdminSessionDto(admin),
    };
  }
}
