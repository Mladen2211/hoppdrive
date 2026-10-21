import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

/**
 * multer wrappers that answer limit problems with a clean JSON error (413 / 400) instead of a 500.
 * Files are kept in memory (they are validated, converted and written to the private storage by the routes).
 */
function wrap(handler: ReturnType<ReturnType<typeof multer>['single']>, maxMb: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const tooBig = err.code === 'LIMIT_FILE_SIZE';
        res.status(tooBig ? 413 : 400).json({
          success: false,
          code: tooBig ? 'file_too_large' : 'upload_error',
          error: tooBig ? `Die Datei ist zu gross (maximal ${maxMb} MB).` : `Upload fehlgeschlagen: ${err.message}`,
        });
        return;
      }
      next(err);
    });
  };
}

export function singleUpload(field: string, options: { maxMb: number }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: options.maxMb * 1024 * 1024, files: 1 } });
  return wrap(upload.single(field), options.maxMb);
}

/** Any number of files (up to maxFiles) in any field. */
export function multiUpload(options: { maxMb: number; maxFiles: number }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxMb * 1024 * 1024, files: options.maxFiles },
  });
  return wrap(upload.any(), options.maxMb);
}

/** multer decodes file names as latin1: restores UTF-8 names ("Vertrag č.pdf"). */
export function fileNameOf(file: { originalname: string }): string {
  const raw = file.originalname;
  if (!/[\u0080-ÿ]/.test(raw)) return raw;
  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  return decoded.includes('�') ? raw : decoded;
}

/** True when the buffer starts (within the first KB) with the PDF header. */
export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 1024).includes('%PDF-');
}
