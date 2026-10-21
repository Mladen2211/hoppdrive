/**
 * Error with an explicit HTTP status and an optional machine-readable code.
 * The global errorHandler serialises it as
 *   { success:false, error:<message>, code?, details?, ...extra }
 * so the admin UI can react to e.g. `code: 'locked'` without parsing messages.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code?: string,
    /** Extra top-level fields for the response body (e.g. lockedUntil). Never put secrets here. */
    public readonly extra?: Record<string, unknown>,
    /** Per-field validation messages, same shape as the 422 from validate(). */
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Account temporarily locked after too many failed logins (HTTP 423). */
export class AccountLockedError extends AppError {
  constructor(
    public readonly lockedUntil: Date,
    /** Internal only (used for the audit entry), never serialised. */
    public readonly adminId?: string,
    /** True when this very attempt triggered the lock. */
    public readonly justLocked = false,
  ) {
    super(
      `Zu viele Fehlversuche. Der Zugang ist bis ${formatClockTime(lockedUntil)} gesperrt.`,
      423,
      'locked',
      { lockedUntil: lockedUntil.toISOString() },
    );
    this.name = 'AccountLockedError';
  }
}

/** HH:MM in the business time zone (default Europe/Zurich). */
export function formatClockTime(date: Date): string {
  try {
    return new Intl.DateTimeFormat('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: process.env.APP_TIMEZONE || 'Europe/Zurich',
    }).format(date);
  } catch {
    return date.toISOString().substring(11, 16);
  }
}
