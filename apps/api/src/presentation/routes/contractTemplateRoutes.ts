import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails } from '../middleware/auditMiddleware';
import { validate, renameContractTemplateSchema } from '../validators';
import { AppError } from '../../application/errors';
import { PrivateStorageService } from '../../infrastructure/services/PrivateStorageService';
import { fileNameOf, isPdf, singleUpload } from '../helpers/uploads';

const MAX_PDF_MB = 10;

/**
 * Contract templates (fillable PDF forms) under Settings → Dokumente. Permission: websiteSettings (GET = view).
 *
 *   GET    /contract-templates                       list (newest first) incl. the field report and bookingCount
 *   GET    /contract-templates/starter.pdf           generated starter template with every supported field
 *   POST   /contract-templates                       multipart: file (PDF, <= 10 MB), name?, activate? (default true)
 *   POST   /contract-templates/deactivate            back to the built-in contract
 *   GET    /contract-templates/:id/download          the uploaded original
 *   GET    /contract-templates/:id/preview.pdf?bookingId=   filled with the booking (or with sample data)
 *   PATCH  /contract-templates/:id                   { name }
 *   POST   /contract-templates/:id/activate          only one template is active
 *   DELETE /contract-templates/:id                   409 template_in_use when bookings were created from it
 */
export function contractTemplateRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const audit = createAuditMiddleware(container.auditLogRepo);
  const access = createPermissionMiddleware(container.prisma);
  const settings = access.requirePermission('websiteSettings');
  const prisma = container.prisma;
  const storage = container.privateStorage;

  const include = { uploadedBy: { select: { name: true } }, _count: { select: { bookings: true } } } as const;

  const mapTemplate = (t: any) => ({
    id: t.id,
    name: t.name,
    originalFileName: t.originalFileName ?? null,
    fields: {
      fields: t.fields?.fields ?? [],
      known: t.fields?.known ?? [],
      unknown: t.fields?.unknown ?? [],
      signatureFields: t.fields?.signatureFields ?? [],
      missingRecommended: t.fields?.missingRecommended ?? [],
    },
    isActive: t.isActive,
    uploadedById: t.uploadedById,
    uploadedByName: t.uploadedBy?.name ?? null,
    bookingCount: t._count?.bookings ?? 0,
    createdAt: t.createdAt,
  });

  /** { template: name } of the template in :id for the activity log. */
  const describeTemplate = async (req: Request) => {
    const t = await prisma.contractTemplate.findUnique({ where: { id: req.params.id }, select: { name: true } });
    return { template: t?.name };
  };

  const sendPdf = (res: Response, bytes: Uint8Array, filename: string, inline = false) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(bytes));
  };

  router.get('/', auth, settings, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.contractTemplate.findMany({ orderBy: { createdAt: 'desc' }, include });
      res.json({ success: true, data: rows.map(mapTemplate) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/starter.pdf', auth, settings, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendPdf(res, await container.contractTemplateService.generateStarter(), 'HoppDrive-Mietvertrag-Vorlage.pdf');
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/',
    auth,
    settings,
    singleUpload('file', { maxMb: MAX_PDF_MB }),
    audit('contract-template', 'upload'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const file = req.file;
        if (!file) throw new AppError('Bitte eine PDF-Datei auswählen (Feld "file").', 400, 'file_required');
        const mimeOk = /^application\/(pdf|x-pdf|octet-stream)$/i.test(file.mimetype);
        if (!mimeOk || !isPdf(file.buffer)) {
          throw new AppError('Nur PDF-Dateien sind erlaubt.', 415, 'unsupported_file');
        }
        const fileName = fileNameOf(file);
        const bytes = new Uint8Array(file.buffer);
        const report = await container.contractTemplateService.analyse(bytes);

        const id = uuid();
        const name = (typeof req.body?.name === 'string' && req.body.name.trim()) || fileName.replace(/\.pdf$/i, '').slice(0, 120) || 'Vertragsvorlage';
        const activate = !['false', '0', 'no'].includes(String(req.body?.activate ?? 'true').toLowerCase());
        const key = PrivateStorageService.keys.contractTemplate(id);
        await storage.save(key, bytes);

        try {
          const created = await prisma.$transaction(async (tx) => {
            if (activate) await tx.contractTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });
            return tx.contractTemplate.create({
              data: {
                id,
                name,
                storageKey: key,
                originalFileName: fileName,
                fields: report as unknown as object,
                isActive: activate,
                uploadedById: req.adminId!,
              },
              include,
            });
          });
          setAuditDetails(res, { template: name, fields: report.fields.length, unknown: report.unknown.length, activated: activate }, id);
          res.status(201).json({ success: true, data: mapTemplate(created) });
        } catch (dbErr) {
          await storage.delete(key).catch(() => undefined);
          throw dbErr;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/deactivate', auth, settings, audit('contract-template', 'deactivate'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.contractTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/download', auth, settings, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const t = await prisma.contractTemplate.findUnique({ where: { id: req.params.id } });
      if (!t) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }
      await storage.sendFile(res, t.storageKey, {
        filename: t.originalFileName || `${t.name}.pdf`,
        contentType: 'application/pdf',
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/preview.pdf', auth, settings, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const t = await prisma.contractTemplate.findUnique({ where: { id: req.params.id } });
      if (!t) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }
      const templateBytes = await storage.read(t.storageKey);
      const signer = await container.contractService.resolveSigner(req.adminId);
      let input;
      const bookingId = typeof req.query.bookingId === 'string' && req.query.bookingId ? req.query.bookingId : null;
      if (bookingId) {
        const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true, location: true } });
        if (!booking) {
          res.status(404).json({ success: false, error: 'Booking not found' });
          return;
        }
        input = await container.contractService.fillInputFor(booking, { signer });
      } else {
        input = container.contractTemplateService.sampleInput(await container.settingsService.getCompany(), signer.signatureData);
      }
      const bytes = await container.contractTemplateService.fill(templateBytes, input);
      sendPdf(res, bytes, `Vorschau-${t.name.replace(/[^\w.-]+/g, '_')}.pdf`, true);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', auth, settings, validate(renameContractTemplateSchema), audit('contract-template', 'rename', describeTemplate), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exists = await prisma.contractTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!exists) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }
      const updated = await prisma.contractTemplate.update({ where: { id: req.params.id }, data: { name: req.body.name }, include });
      setAuditDetails(res, { newName: updated.name });
      res.json({ success: true, data: mapTemplate(updated) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/activate', auth, settings, audit('contract-template', 'activate', describeTemplate), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exists = await prisma.contractTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!exists) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }
      const updated = await prisma.$transaction(async (tx) => {
        await tx.contractTemplate.updateMany({ where: { isActive: true, NOT: { id: req.params.id } }, data: { isActive: false } });
        return tx.contractTemplate.update({ where: { id: req.params.id }, data: { isActive: true }, include });
      });
      res.json({ success: true, data: mapTemplate(updated) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', auth, settings, audit('contract-template', 'delete', describeTemplate), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const t = await prisma.contractTemplate.findUnique({ where: { id: req.params.id }, include });
      if (!t) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }
      if ((t._count?.bookings ?? 0) > 0) {
        throw new AppError(
          `Die Vorlage wird von ${t._count.bookings} Vertrag/Verträgen verwendet und kann nicht gelöscht werden. Aktivieren Sie stattdessen eine andere Vorlage.`,
          409,
          'template_in_use',
        );
      }
      await prisma.contractTemplate.delete({ where: { id: t.id } });
      await storage.delete(t.storageKey).catch(() => undefined);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
