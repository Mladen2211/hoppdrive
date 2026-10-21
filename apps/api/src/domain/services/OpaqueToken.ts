import crypto from 'crypto';

/**
 * One-time tokens for invites and password resets.
 * Only the SHA-256 hash is ever stored; the raw value exists only in the email link.
 */
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashOpaqueToken(raw) };
}

export function hashOpaqueToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
