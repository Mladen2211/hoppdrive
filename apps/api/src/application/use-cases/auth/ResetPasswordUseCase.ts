import type { IAdminRepository } from '../../../domain';
import type { IPasswordHasher } from '../../interfaces/IAuthService';

interface ResetPasswordInput {
  adminId: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const admin = await this.adminRepo.findById(input.adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    if (input.newPassword.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }

    const hash = await this.passwordHasher.hash(input.newPassword);
    admin.completePasswordReset(hash);

    await this.adminRepo.update(admin);
  }
}
