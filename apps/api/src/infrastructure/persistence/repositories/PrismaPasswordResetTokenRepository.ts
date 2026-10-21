import { PrismaClient } from '@prisma/client';
import type {
  IPasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from '../../../domain';

export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    adminId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord> {
    return this.prisma.passwordResetToken.create({ data });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async findLatestForAdmin(adminId: string): Promise<PasswordResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markUsed(id: string): Promise<boolean> {
    const res = await this.prisma.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return res.count === 1;
  }

  async invalidateAllForAdmin(adminId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { adminId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const res = await this.prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
    });
    return res.count;
  }
}
