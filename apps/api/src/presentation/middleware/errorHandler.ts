import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[Error]', err.message);

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
