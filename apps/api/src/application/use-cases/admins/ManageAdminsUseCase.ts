import { randomBytes, randomUUID } from 'crypto';
import type { AdminRole } from '@hoppdrive/shared';
import {
  Admin,
  Email,
  generateOpaqueToken,
  type IAdminRepository,
  type IPasswordResetTokenRepository,
} from '../../../domain';
import type { IPasswordHasher } from '../../interfaces/IAuthService';
import type { IEmailService } from '../../interfaces/IEmailService';
import { AppError } from '../../errors';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Row of GET /api/admins */
export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  role: AdminRole;
  lastActiveAt: string | null;
  pending: boolean;
  inviteExpired: boolean;
  /** A company signature is stored (needed to sign contracts as the company). */
  hasSignature: boolean;
  createdAt: string;
}

export function toAdminUserDto(admin: Admin): AdminUserDto {
  return {
    id: admin.id,
    email: admin.email.value,
    firstName: admin.firstName,
    lastName: admin.lastName,
    name: admin.name,
    role: admin.role,
    lastActiveAt: admin.lastActiveAt ? admin.lastActiveAt.toISOString() : null,
    pending: admin.isPending,
    inviteExpired:
      admin.isPending && !!admin.inviteExpiresAt && admin.inviteExpiresAt.getTime() <= Date.now(),
    hasSignature: admin.hasSignature,
    createdAt: admin.createdAt.toISOString(),
  };
}

/**
 * User management (Settings → Benutzer und Rollen). Soft-deletes instead of removing rows:
 * audit_logs reference admins and must keep resolving to a person (FADP).
 */
export class ManageAdminsUseCase {
  constructor(
    private adminRepo: IAdminRepository,
    private resetTokenRepo: IPasswordResetTokenRepository,
    private passwordHasher: IPasswordHasher,
    private emailService: IEmailService,
    private adminUrl: string,
  ) {}

  async list(): Promise<AdminUserDto[]> {
    const admins = await this.adminRepo.findAllActive();
    return admins.map(toAdminUserDto);
  }

  /**
   * Creates a pending admin (random unusable password) and emails the invite link.
   * Re-inviting a pending or previously removed address regenerates the token.
   */
  async invite(input: {
    email: string;
    role: AdminRole;
    invitedByAdminId: string;
  }): Promise<{ admin: AdminUserDto; emailSent: boolean; target: { email: string; role: AdminRole } }> {
    const email = Email.create(input.email);
    const { raw, hash } = generateOpaqueToken();
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const existing = await this.adminRepo.findByEmail(email.value);
    let saved: Admin;

    if (existing) {
      if (existing.isActive) {
        throw new AppError(
          'Für diese E-Mail-Adresse existiert bereits ein Benutzer.',
          409,
          'already_exists',
        );
      }
      // Pending (token regenerated) or soft-deleted (reactivated as a fresh pending invite).
      if (existing.isDeleted) {
        existing.passwordHash = await this.unusablePasswordHash();
        existing.failedLoginAttempts = 0;
        existing.lockedUntil = null;
        existing.mustResetPassword = false;
        existing.lastActiveAt = null;
        existing.deletedAt = null;
      }
      existing.role = input.role;
      existing.inviteTokenHash = hash;
      existing.inviteExpiresAt = inviteExpiresAt;
      saved = await this.adminRepo.update(existing);
    } else {
      saved = await this.adminRepo.save(
        Admin.create({
          id: randomUUID(),
          email,
          // Placeholder until the invitee sets their real name on accept-invite.
          name: email.value.split('@')[0],
          passwordHash: await this.unusablePasswordHash(),
          mustResetPassword: false,
          role: input.role,
          inviteTokenHash: hash,
          inviteExpiresAt,
        }),
      );
    }

    const inviter = await this.adminRepo.findById(input.invitedByAdminId);
    let emailSent = true;
    try {
      // The mail goes through the outbox: SENT = delivered now; QUEUED = the worker keeps retrying
      // (emailSent=false tells the admin it is not delivered yet; re-inviting sends a fresh link).
      const result = await this.emailService.sendAdminInvite({
        to: saved.email.value,
        inviteUrl: `${this.adminUrl}/accept-invite?token=${raw}`,
        invitedBy: inviter?.name ?? 'HoppDrive',
        role: saved.role,
      });
      emailSent = result.status === 'SENT';
    } catch (err) {
      emailSent = false;
      console.error('[Admins] Failed to send invite email:', err);
    }

    return {
      admin: toAdminUserDto(saved),
      emailSent,
      target: { email: saved.email.value, role: saved.role },
    };
  }

  async changeRole(input: {
    id: string;
    role: AdminRole;
    actingAdminId: string;
  }): Promise<{ admin: AdminUserDto; previousRole: AdminRole }> {
    if (input.id === input.actingAdminId) {
      throw new AppError('Sie können Ihre eigene Rolle nicht ändern.', 409, 'cannot_change_own_role');
    }

    const target = await this.adminRepo.findById(input.id);
    if (!target || target.isDeleted) {
      throw new AppError('Benutzer nicht gefunden.', 404, 'not_found');
    }

    const previousRole = target.role;
    if (previousRole === 'ADMIN' && input.role !== 'ADMIN') {
      await this.assertNotLastAdmin(target);
    }

    target.role = input.role;
    target.updatedAt = new Date();
    const saved = await this.adminRepo.update(target);
    return { admin: toAdminUserDto(saved), previousRole };
  }

  async remove(input: {
    id: string;
    actingAdminId: string;
  }): Promise<{ email: string; name: string; role: AdminRole }> {
    if (input.id === input.actingAdminId) {
      throw new AppError('Sie können sich nicht selbst löschen.', 409, 'cannot_delete_self');
    }

    const target = await this.adminRepo.findById(input.id);
    if (!target || target.isDeleted) {
      throw new AppError('Benutzer nicht gefunden.', 404, 'not_found');
    }

    if (target.role === 'ADMIN') {
      await this.assertNotLastAdmin(target);
    }

    const info = { email: target.email.value, name: target.name, role: target.role };

    // Soft delete: keep the row for audit-log integrity but make it unusable.
    target.deletedAt = new Date();
    target.inviteTokenHash = null;
    target.inviteExpiresAt = null;
    target.passwordHash = await this.unusablePasswordHash();
    target.failedLoginAttempts = 0;
    target.lockedUntil = null;
    target.updatedAt = new Date();
    await this.adminRepo.update(target);
    await this.resetTokenRepo.invalidateAllForAdmin(target.id);

    return info;
  }

  /** The last active ADMIN can neither be demoted nor removed. */
  private async assertNotLastAdmin(target: Admin): Promise<void> {
    if (!target.isActive) return; // a pending invite does not count as a working admin
    const remaining = await this.adminRepo.countActiveByRole('ADMIN');
    if (remaining <= 1) {
      throw new AppError(
        'Der letzte Administrator kann nicht entfernt oder herabgestuft werden.',
        409,
        'last_admin',
      );
    }
  }

  /** A bcrypt hash of random bytes nobody knows: cannot be matched by any password. */
  private unusablePasswordHash(): Promise<string> {
    return this.passwordHasher.hash(randomBytes(48).toString('hex'));
  }
}
