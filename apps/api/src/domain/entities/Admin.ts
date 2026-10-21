import type { AdminLocale, AdminRole, AdminTheme } from '@hoppdrive/shared';
import { Entity } from './Entity';
import { Email } from '../value-objects/Email';

export interface AdminProps {
  id: string;
  email: Email;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  passwordHash: string;
  mustResetPassword: boolean;
  role?: AdminRole;
  lastActiveAt?: Date | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  inviteTokenHash?: string | null;
  inviteExpiresAt?: Date | null;
  deletedAt?: Date | null;
  /** UI language of the admin app ('de' | 'en' | 'fr' | 'it' | 'hr'). */
  locale?: AdminLocale;
  /** 'light' | 'dark' | 'system'. */
  theme?: AdminTheme;
  /** Read-only: whether a company signature is stored (the data itself stays in the repository). */
  hasSignature?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Admin extends Entity {
  public email: Email;
  public name: string;
  public firstName: string | null;
  public lastName: string | null;
  public phone: string | null;
  public passwordHash: string;
  public mustResetPassword: boolean;
  public role: AdminRole;
  public lastActiveAt: Date | null;
  public failedLoginAttempts: number;
  public lockedUntil: Date | null;
  public inviteTokenHash: string | null;
  public inviteExpiresAt: Date | null;
  public deletedAt: Date | null;
  public locale: AdminLocale;
  public theme: AdminTheme;
  public readonly hasSignature: boolean;

  private constructor(props: AdminProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.email = props.email;
    this.name = props.name;
    this.firstName = props.firstName ?? null;
    this.lastName = props.lastName ?? null;
    this.phone = props.phone ?? null;
    this.passwordHash = props.passwordHash;
    this.mustResetPassword = props.mustResetPassword;
    this.role = props.role ?? 'ADMIN';
    this.lastActiveAt = props.lastActiveAt ?? null;
    this.failedLoginAttempts = props.failedLoginAttempts ?? 0;
    this.lockedUntil = props.lockedUntil ?? null;
    this.inviteTokenHash = props.inviteTokenHash ?? null;
    this.inviteExpiresAt = props.inviteExpiresAt ?? null;
    this.deletedAt = props.deletedAt ?? null;
    this.locale = props.locale ?? 'de';
    this.theme = props.theme ?? 'system';
    this.hasSignature = props.hasSignature ?? false;
  }

  static create(props: AdminProps): Admin {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Admin name is required');
    }
    return new Admin(props);
  }

  /** Invite sent but not accepted yet: no usable password, cannot log in. */
  get isPending(): boolean {
    return this.inviteTokenHash !== null;
  }

  /** Soft-deleted (kept only so audit log entries still resolve to a person). */
  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /** Active = may log in / reset password. */
  get isActive(): boolean {
    return !this.isPending && !this.isDeleted;
  }

  isLocked(now: Date = new Date()): boolean {
    return this.lockedUntil !== null && this.lockedUntil.getTime() > now.getTime();
  }

  completePasswordReset(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
    this.mustResetPassword = false;
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.updatedAt = new Date();
  }

  changePassword(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
    this.updatedAt = new Date();
  }

  /** Invite accepted: set names + password, clear the invite, activate. */
  acceptInvite(data: { firstName: string; lastName: string; passwordHash: string }): void {
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.name = [data.firstName, data.lastName].filter(Boolean).join(' ') || this.name;
    this.passwordHash = data.passwordHash;
    this.mustResetPassword = false;
    this.inviteTokenHash = null;
    this.inviteExpiresAt = null;
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.updatedAt = new Date();
  }

  updateProfile(data: { firstName?: string; lastName?: string; name?: string; phone?: string; email?: Email }): void {
    if (data.firstName !== undefined) this.firstName = data.firstName;
    if (data.lastName !== undefined) this.lastName = data.lastName;
    if (data.name !== undefined) this.name = data.name;
    if (data.phone !== undefined) this.phone = data.phone;
    if (data.email !== undefined) this.email = data.email;
    // Keep name in sync
    if (data.firstName !== undefined || data.lastName !== undefined) {
      this.name = [this.firstName, this.lastName].filter(Boolean).join(' ') || this.name;
    }
    this.updatedAt = new Date();
  }
}
