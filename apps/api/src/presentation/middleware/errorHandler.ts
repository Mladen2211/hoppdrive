import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../application/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Errors with an explicit status/code (lockout, validation of passwords, guards, ...)
  if (err instanceof AppError) {
    if (err.status >= 500) console.error('[Error]', err.stack || err.message);
    res.status(err.status).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
      ...(err.extra ?? {}),
    });
    return;
  }

  console.error('[Error]', err.stack || err.message);
  // If the raw body was captured by the JSON parser, log it for debugging
  try {
    const raw = (req as any).rawBody;
    if (raw) console.error('[RawBody]', raw);
  } catch {
    // ignore
  }

  // Domain/validation errors
  if (
    err.message.includes('not found') ||
    err.message.includes('Invalid') ||
    err.message.includes('required') ||
    err.message.includes('must be')
  ) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
}
