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

  private constructor(props: AdminProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.email = props.email;
    this.name = props.name;
    this.firstName = props.firstName ?? null;
    this.lastName = props.lastName ?? null;
    this.phone = props.phone ?? null;
    this.passwordHash = props.passwordHash;
    this.mustResetPassword = props.mustResetPassword;
  }

  static create(props: AdminProps): Admin {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Admin name is required');
    }
    return new Admin(props);
  }

  completePasswordReset(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
    this.mustResetPassword = false;
    this.updatedAt = new Date();
  }

  changePassword(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
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
