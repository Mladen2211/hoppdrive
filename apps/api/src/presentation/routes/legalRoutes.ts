import path from 'path';
import { Router, Request, Response } from 'express';

const AGB_PDF_PATH = path.join(__dirname, '../../../assets/legal/agb.pdf');

/**
 * Public legal documents — same AGB shown on the public site (apps/web/public/agb.pdf)
 * and merged into generated rental contracts (PdfService), served from a single
 * place so the iPad signing flow can embed it directly.
 */
export function legalRoutes(): Router {
  const router = Router();

  /** GET /api/legal/agb – Public: current AGB as a PDF */
  router.get('/agb', (_req: Request, res: Response) => {
    res.sendFile(AGB_PDF_PATH, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ success: false, error: 'AGB document not found' });
      }
    });
  });

  return router;
}
