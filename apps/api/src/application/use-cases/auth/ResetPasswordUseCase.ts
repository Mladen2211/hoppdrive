import type { IAdminRepository } from '../../../domain';
import type { IPasswordHasher } from '../../interfaces/IAuthService';
import { assertPasswordAcceptable } from './passwordPolicy';

interface ResetPasswordInput {
  adminId: string;
  newPassword: string;
}

/** Forced password change for an authenticated admin (mustResetPassword). */
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

    // Min length, upper + lower case, digit, and different from the current password.
    await assertPasswordAcceptable(this.passwordHasher, input.newPassword, {
      currentHash: admin.passwordHash,
    });

    const hash = await this.passwordHasher.hash(input.newPassword);
    admin.completePasswordReset(hash);

    await this.adminRepo.update(admin);
  }
}
