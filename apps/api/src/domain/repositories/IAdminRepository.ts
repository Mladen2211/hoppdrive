import type { AdminRole } from '@hoppdrive/shared';
import { Admin } from '../entities/Admin';

export interface IAdminRepository {
  findById(id: string): Promise<Admin | null>;
  findByEmail(email: string): Promise<Admin | null>;
  /** Looks up a pending invite by the SHA-256 hash of its token. */
  findByInviteTokenHash(hash: string): Promise<Admin | null>;
  /** All non-deleted admins (active and pending invites), oldest first. */
  findAllActive(): Promise<Admin[]>;
  /** Count of non-deleted, non-pending admins with the given role. */
  countActiveByRole(role: AdminRole): Promise<number>;
  save(admin: Admin): Promise<Admin>;
  update(admin: Admin): Promise<Admin>;
  /**
   * Atomically increments the failed-login counter. When it reaches `maxAttempts`
   * the account is locked until now + lockMs and the counter is reset.
   */
  registerFailedLogin(
    id: string,
    maxAttempts: number,
    lockMs: number,
  ): Promise<{ attempts: number; lockedUntil: Date | null }>;
  /** Clears the lockout counters and stamps lastActiveAt. */
  registerSuccessfulLogin(id: string): Promise<void>;
  /** Stamps lastActiveAt only. */
  touchLastActive(id: string): Promise<void>;
}
