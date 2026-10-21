import { PrismaClient, Admin as PrismaAdmin } from '@prisma/client';
import type { AdminLocale, AdminRole, AdminTheme } from '@hoppdrive/shared';
import { Admin, Email, type IAdminRepository } from '../../../domain';

export class PrismaAdminRepository implements IAdminRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Admin | null> {
    const row = await this.prisma.admin.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<Admin | null> {
    const row = await this.prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByInviteTokenHash(hash: string): Promise<Admin | null> {
    const row = await this.prisma.admin.findUnique({ where: { inviteTokenHash: hash } });
    return row ? this.toDomain(row) : null;
  }

  async findAllActive(): Promise<Admin[]> {
    const rows = await this.prisma.admin.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async countActiveByRole(role: AdminRole): Promise<number> {
    return this.prisma.admin.count({
      where: { role, deletedAt: null, inviteTokenHash: null },
    });
  }

  async save(admin: Admin): Promise<Admin> {
    const row = await this.prisma.admin.create({
      data: {
        id: admin.id,
        email: admin.email.value,
        name: admin.name,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        passwordHash: admin.passwordHash,
        mustResetPassword: admin.mustResetPassword,
        role: admin.role,
        lastActiveAt: admin.lastActiveAt,
        failedLoginAttempts: admin.failedLoginAttempts,
        lockedUntil: admin.lockedUntil,
        inviteTokenHash: admin.inviteTokenHash,
        inviteExpiresAt: admin.inviteExpiresAt,
        deletedAt: admin.deletedAt,
        locale: admin.locale,
        theme: admin.theme,
      },
    });
    return this.toDomain(row);
  }

  async update(admin: Admin): Promise<Admin> {
    const row = await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        email: admin.email.value,
        name: admin.name,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        passwordHash: admin.passwordHash,
        mustResetPassword: admin.mustResetPassword,
        role: admin.role,
        lastActiveAt: admin.lastActiveAt,
        failedLoginAttempts: admin.failedLoginAttempts,
        lockedUntil: admin.lockedUntil,
        inviteTokenHash: admin.inviteTokenHash,
        inviteExpiresAt: admin.inviteExpiresAt,
        deletedAt: admin.deletedAt,
        locale: admin.locale,
        theme: admin.theme,
      },
    });
    return this.toDomain(row);
  }

  async registerFailedLogin(
    id: string,
    maxAttempts: number,
    lockMs: number,
  ): Promise<{ attempts: number; lockedUntil: Date | null }> {
    // Atomic increment: concurrent wrong-password requests cannot overwrite each other.
    const row = await this.prisma.admin.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (row.failedLoginAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMs);
      await this.prisma.admin.update({
        where: { id },
        data: { lockedUntil, failedLoginAttempts: 0 },
      });
      return { attempts: row.failedLoginAttempts, lockedUntil };
    }
    return { attempts: row.failedLoginAttempts, lockedUntil: null };
  }

  async registerSuccessfulLogin(id: string): Promise<void> {
    await this.prisma.admin.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastActiveAt: new Date() },
    });
  }

  async touchLastActive(id: string): Promise<void> {
    await this.prisma.admin.update({ where: { id }, data: { lastActiveAt: new Date() } });
  }

  private toDomain(row: PrismaAdmin): Admin {
    return Admin.create({
      id: row.id,
      email: Email.create(row.email),
      name: row.name,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      passwordHash: row.passwordHash,
      mustResetPassword: row.mustResetPassword,
      role: row.role as AdminRole,
      lastActiveAt: row.lastActiveAt,
      failedLoginAttempts: row.failedLoginAttempts,
      lockedUntil: row.lockedUntil,
      inviteTokenHash: row.inviteTokenHash,
      inviteExpiresAt: row.inviteExpiresAt,
      deletedAt: row.deletedAt,
      locale: row.locale as AdminLocale,
      theme: row.theme as AdminTheme,
      hasSignature: Boolean(row.signatureData),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
