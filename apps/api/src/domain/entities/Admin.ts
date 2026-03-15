import { Entity } from './Entity';
import { Email } from '../value-objects/Email';

export interface AdminProps {
  id: string;
  email: Email;
  name: string;
  passwordHash: string;
  mustResetPassword: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Admin extends Entity {
  public email: Email;
  public name: string;
  public passwordHash: string;
  public mustResetPassword: boolean;

  private constructor(props: AdminProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.email = props.email;
    this.name = props.name;
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

  updateProfile(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }
}
