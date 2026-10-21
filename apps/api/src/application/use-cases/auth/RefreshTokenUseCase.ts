import type { IAdminRepository } from '../../../domain';
import type { ITokenService } from '../../interfaces/IAuthService';
import { AppError } from '../../errors';
import { toAdminSessionDto, type AdminSessionDto } from './dto';

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminSessionDto;
}

export class RefreshTokenUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private tokenService: ITokenService,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResult> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError('Invalid or expired refresh token', 401, 'invalid_refresh_token');
    }

    const admin = await this.adminRepo.findById(payload.adminId);
    // Deleted admins (and admins whose invite is somehow pending again) lose their
    // session at the next refresh, at the latest 15 minutes after removal.
    if (!admin || !admin.isActive) {
      throw new AppError('Admin not found', 401, 'invalid_refresh_token');
    }

    // The app refreshes every ~13 minutes while open, so this keeps "Zuletzt aktiv" current.
    await this.adminRepo.touchLastActive(admin.id);

    return {
      accessToken: this.tokenService.generateAccessToken(admin),
      refreshToken: this.tokenService.generateRefreshToken(admin),
      admin: toAdminSessionDto(admin),
    };
  }
}
