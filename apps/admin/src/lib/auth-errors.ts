/**
 * Helpers that turn API failures of the auth flows (login, forgot / reset password, invite,
 * profile) into German UI text. Every failed call rejects with an ApiError (see lib/api.ts):
 *  - 401 code 'invalid_credentials'   wrong e-mail or password
 *  - 423 code 'locked' + lockedUntil  too many failed attempts (account locked for 15 minutes)
 *  - 400 code 'invalid_token'         reset / invite link is invalid or expired
 *  - 422 details { field: [labels] }  validation (password rules, missing names)
 */
import { PASSWORD_RULE_LABELS } from '@hoppdrive/shared';
import { errorText } from '@/lib/errors';
import { fmtTime } from '@/lib/format';
import { tr } from '@/i18n/active';

interface ErrorShape {
  status?: number;
  code?: string;
  message?: string;
  lockedUntil?: string;
  details?: Record<string, string[]>;
}

const asShape = (err: unknown): ErrorShape => (err && typeof err === 'object' ? (err as ErrorShape) : {});

export function isLockedError(err: unknown): boolean {
  const e = asShape(err);
  return e.status === 423 || e.code === 'locked';
}

export function isInvalidCredentials(err: unknown): boolean {
  const e = asShape(err);
  return e.status === 401 && e.code === 'invalid_credentials';
}

export function isInvalidToken(err: unknown): boolean {
  return asShape(err).code === 'invalid_token';
}

/** Text for the login error alert. Locked accounts always show the time the lock ends. */
export function loginErrorText(err: unknown): string {
  const e = asShape(err);
  if (isLockedError(err)) {
    const until = e.lockedUntil ? fmtTime(e.lockedUntil) : '';
    if (until && until !== '–') return tr('authErrors.zuVieleFehlversucheDer', { until });
    return tr('authErrors.zuVieleFehlversucheDer2');
  }
  if (isInvalidCredentials(err)) return tr('authErrors.invalidCredentials');
  return errorText(err, tr('authErrors.anmeldungFehlgeschlagenBitteVe'));
}

/** Validation messages (422) for one request field, or an empty list. */
export function fieldMessages(err: unknown, field: string): string[] {
  const details = asShape(err).details;
  const list = details?.[field];
  return Array.isArray(list) ? list.filter((m): m is string => typeof m === 'string') : [];
}

/** True when the server rejected the password because it equals the current / old one. */
export function isSamePasswordRejected(err: unknown, field: string): boolean {
  return fieldMessages(err, field).includes(PASSWORD_RULE_LABELS.different);
}
