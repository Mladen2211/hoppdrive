import path from 'path';
import fs from 'fs/promises';
import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../../application/errors';
import { isPdf, singleUpload } from '../helpers/uploads';
import { PDFDocument } from 'pdf-lib';

const AGB_PDF_PATH = path.join(__dirname, '../../../assets/legal/agb.pdf');
/** Key of an uploaded AGB in the private storage (replaces the bundled file). */
export const AGB_STORAGE_KEY = 'legal/agb.pdf';

/**
 * Legal documents — the AGB shown on the public site and merged into generated rental contracts
 * (PdfService), served from a single place so the iPad signing flow can embed it directly.
 * An AGB uploaded in the admin (private storage, key legal/agb.pdf) takes precedence over the bundled file.
 *
 *   GET    /legal/agb          public: the current AGB as PDF
 *   GET    /legal/agb/info     websiteSettings (view): { custom, size, pages, updatedAt }
 *   PUT    /legal/agb          websiteSettings (edit): multipart `file` (PDF, <= 10 MB) replaces the AGB
 *   DELETE /legal/agb          websiteSettings (edit): back to the bundled AGB
 */
export function legalRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const settings = access.requirePermission('websiteSettings');

  /** GET /api/legal/agb – Public: current AGB as a PDF */
  router.get('/agb', async (_req: Request, res: Response) => {
    try {
      if (await container.privateStorage.exists(AGB_STORAGE_KEY)) {
        // The AGB is a public document, so it may be cached (unlike every other private file).
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="HoppDrive-AGB.pdf"');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(await container.privateStorage.read(AGB_STORAGE_KEY));
        return;
      }
    } catch (err) {
      console.error('[Legal] Failed to read uploaded AGB, serving the bundled file:', err);
    }
    res.sendFile(AGB_PDF_PATH, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ success: false, error: 'AGB document not found' });
      }
    });
  });

  router.get('/agb/info', auth, settings, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const custom = await container.privateStorage.exists(AGB_STORAGE_KEY);
      const bytes = custom ? await container.privateStorage.read(AGB_STORAGE_KEY) : await fs.readFile(AGB_PDF_PATH);
      const stat = custom ? await fs.stat(container.privateStorage.resolve(AGB_STORAGE_KEY)) : await fs.stat(AGB_PDF_PATH);
      let pages: number | null = null;
      try {
        pages = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
      } catch {
        /* unreadable: no page count */
      }
      res.json({ success: true, data: { custom, size: bytes.length, pages, updatedAt: stat.mtime } });
    } catch (err) {
      next(err);
    }
  });

  router.put(
    '/agb',
    auth,
    settings,
    singleUpload('file', { maxMb: 10 }),
    audit('legal-document', 'upload-agb'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = req.file;
        if (!file) throw new AppError('Bitte eine PDF-Datei auswählen (Feld "file").', 400, 'file_required');
        if (!/^application\/(pdf|x-pdf|octet-stream)$/i.test(file.mimetype) || !isPdf(file.buffer)) {
          throw new AppError('Nur PDF-Dateien sind erlaubt.', 415, 'unsupported_file');
        }
        let pages: number;
        try {
          pages = (await PDFDocument.load(file.buffer, { updateMetadata: false })).getPageCount();
        } catch {
          throw new AppError('Die Datei ist kein lesbares (unverschlüsseltes) PDF.', 422, 'invalid_pdf');
        }
        await container.privateStorage.save(AGB_STORAGE_KEY, file.buffer);
        res.json({ success: true, data: { custom: true, size: file.buffer.length, pages, updatedAt: new Date() } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete('/agb', auth, settings, audit('legal-document', 'reset-agb'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await container.privateStorage.delete(AGB_STORAGE_KEY);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
