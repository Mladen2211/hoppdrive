export interface PasswordResetTokenRecord {
  id: string;
  adminId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IPasswordResetTokenRepository {
  create(data: { adminId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetTokenRecord>;
  findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  /** Most recent token created for this admin (used to throttle reset mails). */
  findLatestForAdmin(adminId: string): Promise<PasswordResetTokenRecord | null>;
  /**
   * Atomically marks the token as used. Returns false when it was already used
   * (two concurrent requests with the same link: only one may win).
   */
  markUsed(id: string): Promise<boolean>;
  /** Invalidates every still-unused token of an admin (new request, successful reset, delete). */
  invalidateAllForAdmin(adminId: string): Promise<void>;
  /** Housekeeping: removes expired/used tokens older than the cutoff. */
  deleteOlderThan(cutoff: Date): Promise<number>;
}
