import type { IAdminRepository } from '../../../domain';
import type { IPasswordHasher, ITokenService } from '../../interfaces/IAuthService';

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    mustResetPassword: boolean;
  };
}

export class LoginUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const admin = await this.adminRepo.findByEmail(input.email.toLowerCase().trim());
    if (!admin) {
      throw new Error('Invalid credentials');
    }

    const isValid = await this.passwordHasher.compare(input.password, admin.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const accessToken = this.tokenService.generateAccessToken(admin);
    const refreshToken = this.tokenService.generateRefreshToken(admin);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email.value,
        name: admin.name,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        mustResetPassword: admin.mustResetPassword,
      },
    };
  }
}
