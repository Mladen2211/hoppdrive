import { evaluatePassword, PASSWORD_RULE_LABELS } from '@hoppdrive/shared';
import { AppError } from '../../errors';
import type { IPasswordHasher } from '../../interfaces/IAuthService';

/**
 * Enforces the shared password rules (min 12 chars, upper + lower case, digit) and,
 * when `currentHash` is given, that the new password differs from the current one.
 * Throws a 422 in the same shape as the zod validate() middleware so the UI can map
 * it onto the field: details[field] = [german rule labels...].
 */
export async function assertPasswordAcceptable(
  hasher: IPasswordHasher,
  newPassword: string,
  options: { currentHash?: string; field?: string } = {},
): Promise<void> {
  const field = options.field ?? 'newPassword';
  const errors = [...evaluatePassword(newPassword).errors];

  if (errors.length === 0 && options.currentHash) {
    const same = await hasher.compare(newPassword, options.currentHash);
    if (same) errors.push(PASSWORD_RULE_LABELS.different);
  }

  if (errors.length > 0) {
    throw new AppError('Validation failed', 422, 'weak_password', undefined, { [field]: errors });
  }
}
