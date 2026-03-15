import type { IAdminRepository } from '../../../domain';
import type { ITokenService } from '../../interfaces/IAuthService';

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private tokenService: ITokenService,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResult> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Invalid or expired refresh token');
    }

    const admin = await this.adminRepo.findById(payload.adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    return {
      accessToken: this.tokenService.generateAccessToken(admin),
      refreshToken: this.tokenService.generateRefreshToken(admin),
    };
  }
}
