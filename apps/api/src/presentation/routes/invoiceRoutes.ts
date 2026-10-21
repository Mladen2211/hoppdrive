import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import { createPermissionMiddleware } from '../middleware/permissionMiddleware';
import { createAuditMiddleware, setAuditDetails, vehicleLabel } from '../middleware/auditMiddleware';
import { validate, createInvoiceSchema } from '../validators';
import { invoiceInclude, mapInvoice, InvoiceService } from '../../infrastructure/services/InvoiceService';

export { mapInvoice };

/** ?qr=1 | true -> true, ?qr=0 | false -> false, absent -> undefined (the invoice's own withQrBill flag). */
function qrFlag(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  const v = String(value).toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return undefined;
}

export function invoiceRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);
  const access = createPermissionMiddleware(container.prisma);
  const audit = createAuditMiddleware(container.auditLogRepo);
  // All invoice routes belong to "Verträge und Rechnungen" (GET = view, mutations = edit).
  const contracts = access.requirePermission('contracts');
  const invoices = container.invoiceService;

  /** { invoiceNumber, customerName } of the invoice in :id, for the activity log. */
  const describeInvoice = (extra?: (req: Request) => Record<string, unknown>) => async (req: Request) => {
    const inv = await container.prisma.invoice.findUnique({
      where: { id: req.params.id },
      select: { invoiceNumber: true, customerName: true, type: true },
    });
    return { invoiceNumber: inv?.invoiceNumber, customerName: inv?.customerName, type: inv?.type, ...(extra ? extra(req) : {}) };
  };

  /* ────────────────────────────────────────────────────────────
   *  GET /api/invoices – List invoices, optionally by bookingId / status / type
   * ──────────────────────────────────────────────────────────── */
  router.get('/', auth, contracts, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, bookingId, type } = req.query;
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (bookingId) where.bookingId = bookingId;
      if (type) where.type = type;

      const rows = await container.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: invoiceInclude,
      });

      res.json({ success: true, data: rows.map(mapInvoice) });
    } catch (err) {
      next(err);
    }
  });

  /* ────────────────────────────────────────────────────────────
   *  POST /api/invoices – Create an invoice
   *
   *  Rental (the original flow; `type` may be omitted or 'RENTAL'):
   *    { bookingId, periodStart, periodEnd, notes?, vatRate?, dueDays?, withQrBill?, sendEmail? }
   *    The booking price is prorated for the period and saved as one line item.
   *    sendEmail defaults to TRUE (mailed on issuance when the booking has an e-mail address).
   *  Damage / fine / other:
   *    { type: 'DAMAGE'|'FINE'|'OTHER', bookingId?, debtor?: { name, email?, street?, zip?, city?, country? },
   *      items: [{ description, quantity, unitPrice, vatRate?, feeId?, damageId?, fineId? }],
   *      dueDays?, notes?, vatRate?, withQrBill?, sendEmail? }
   *    The debtor defaults from the booking's driver details. Items without vatRate use the invoice settings
   *    rate (pass-through items such as fines: vatRate 0). sendEmail defaults to false.
   *  withQrBill: omitted = the "Mit QR-Rechnung" default of the invoice settings; true with incomplete creditor
   *  data = 422 qr_bill_unavailable.
   *  Response 201: the invoice plus emailSent / emailError ('no_recipient' | 'send_failed') when a mail was requested.
   * ──────────────────────────────────────────────────────────── */
  router.post(
    '/',
    auth,
    contracts,
    validate(createInvoiceSchema),
    audit('invoice', 'create', async (req) => {
      const b = req.body ?? {};
      const booking = b.bookingId
        ? await container.prisma.booking.findUnique({
            where: { id: b.bookingId },
            select: { customerName: true, vehicle: { select: { brand: true, model: true } } },
          })
        : null;
      return { type: b.type ?? 'RENTAL', bookingCustomer: booking?.customerName, vehicle: vehicleLabel(booking?.vehicle) };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const b = req.body;
        const result =
          b.type === 'RENTAL'
            ? await invoices.createRental({
                bookingId: b.bookingId,
                periodStart: b.periodStart,
                periodEnd: b.periodEnd,
                notes: b.notes,
                vatRate: b.vatRate,
                dueDays: b.dueDays,
                withQrBill: b.withQrBill,
                sendEmail: b.sendEmail,
              })
            : await invoices.createCustom(b);

        const { invoice, emailSent, emailError } = result;
        const requested = b.type === 'RENTAL' ? b.sendEmail !== false : b.sendEmail === true;
        setAuditDetails(res, { ...InvoiceService.auditSummary(invoice), emailed: emailSent }, invoice.id);
        res.status(201).json({
          success: true,
          data: { ...mapInvoice(invoice), ...(requested ? { emailSent, ...(emailError ? { emailError } : {}) } : {}) },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /* ────────────────────────────────────────────────────────────
   *  PATCH /api/invoices/:id/status – Toggle PENDING / PAID
   * ──────────────────────────────────────────────────────────── */
  router.patch(
    '/:id/status',
    auth,
    contracts,
    audit('invoice', 'update-status', async (req) => ({
      ...(await describeInvoice()(req)),
      status: req.body?.status,
    })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status } = req.body;
        if (!status || !['PENDING', 'PAID'].includes(status)) {
          res.status(400).json({ success: false, error: 'status must be PENDING or PAID' });
          return;
        }

        const invoice = await container.prisma.invoice.update({
          where: { id: req.params.id },
          data: { status },
          include: invoiceInclude,
        });

        res.json({ success: true, data: mapInvoice(invoice) });
      } catch (err) {
        next(err);
      }
    },
  );

  /* ────────────────────────────────────────────────────────────
   *  POST /api/invoices/:id/reissue – Reissue with penalty (Mahnung)
   *  Body: { penalty: number, notes?, sendEmail?: boolean }
   *  sendEmail=true mails the new invoice PDF to the customer as a payment reminder
   *  (notes appear below the standard reminder text). The response is the new invoice
   *  plus emailSent (and emailError: 'no_recipient' | 'send_failed' when it was requested
   *  but not delivered). Without sendEmail nothing is mailed (previous behaviour).
   * ──────────────────────────────────────────────────────────── */
  router.post(
    '/:id/reissue',
    auth,
    contracts,
    audit('invoice', 'reissue', async (req) => {
      const inv = await container.prisma.invoice.findUnique({
        where: { id: req.params.id },
        select: { invoiceNumber: true, customerName: true },
      });
      return {
        parentInvoiceNumber: inv?.invoiceNumber,
        customerName: inv?.customerName,
        penalty: Number(req.body?.penalty) || 0,
        sendEmail: req.body?.sendEmail === true,
      };
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { penalty, notes, sendEmail } = req.body;
        const penaltyAmount = Number(penalty) || 0;

        const original = await container.prisma.invoice.findUnique({
          where: { id: req.params.id },
          include: invoiceInclude,
        });
        if (!original) {
          res.status(404).json({ success: false, error: 'Invoice not found' });
          return;
        }

        const subtotal = Number(original.subtotal);
        const vatRate = Number(original.vatRate);
        // Invoices with line items keep their (per-line) VAT; legacy invoices recompute it from the single rate.
        const vatAmount = original.items.length > 0 ? Number(original.vatAmount) : Math.round(subtotal * vatRate) / 100;
        const total = Math.round((subtotal + vatAmount + penaltyAmount) * 100) / 100;

        const issueDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 14-day deadline on reissue

        const reissued = await container.prisma.invoice.create({
            data: {
              invoiceNumber: await container.invoiceService.nextInvoiceNumber(),
              type: original.type,
              bookingId: original.bookingId,
              customerName: original.customerName,
              customerEmail: original.customerEmail,
              customerAddress: original.customerAddress,
              customerStreet: original.customerStreet,
              customerZip: original.customerZip,
              customerCity: original.customerCity,
              customerCountry: original.customerCountry,
              withQrBill: original.withQrBill,
              periodStart: original.periodStart,
              periodEnd: original.periodEnd,
              issueDate,
              dueDate,
              subtotal,
              vatRate,
              vatAmount,
              penalty: penaltyAmount,
              total,
              currency: original.currency,
              status: 'PENDING',
              parentInvoiceId: original.id,
              notes: notes || (penaltyAmount > 0 ? `Mahnung – Verzugsgebühr: ${original.currency} ${penaltyAmount.toFixed(2)}` : null),
              // Invoices built from line items keep their lines on the reissue.
              items: {
                create: original.items.map((item) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  vatRate: item.vatRate,
                  total: item.total,
                  sortOrder: item.sortOrder,
                  feeId: item.feeId,
                  damageId: item.damageId,
                  fineId: item.fineId,
                })),
              },
            },
            include: invoiceInclude,
        });
        // A QR bill on the original continues on the reminder (new invoice number = new payment reference).
        if (reissued.withQrBill) {
          try {
            await container.invoiceService.renderPdf(reissued); // derives and stores the reference
          } catch (qrErr) {
            console.error('[Invoice] QR bill unavailable for the reminder, continuing without it:', qrErr);
            await container.prisma.invoice.update({ where: { id: reissued.id }, data: { withQrBill: false } });
            reissued.withQrBill = false;
          }
        }

        // Optional Mahnung mail. A delivery problem must not undo the created invoice; the
        // caller learns about it through emailSent / emailError instead.
        let emailSent = false;
        let emailError: 'no_recipient' | 'send_failed' | undefined;
        if (sendEmail === true) {
          const outcome = await container.invoiceService.mail(reissued, {
            reminder: {
              originalInvoiceNumber: original.invoiceNumber,
              note: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
            },
          });
          emailSent = outcome.emailSent;
          emailError = outcome.emailError;
        }

        setAuditDetails(res, { invoiceNumber: reissued.invoiceNumber, emailed: emailSent }, reissued.id);
        res.status(201).json({
          success: true,
          data: { ...mapInvoice(reissued), emailSent, ...(emailError ? { emailError } : {}) },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /* ────────────────────────────────────────────────────────────
   *  GET /api/invoices/:id/download[?qr=1] – Download invoice PDF
   *  qr=1 renders the Swiss QR payment slip on demand (whatever the invoice's withQrBill flag says), qr=0 omits it;
   *  422 qr_bill_unavailable (+ missing: [...]) when the creditor data is incomplete.
   * ──────────────────────────────────────────────────────────── */
  router.get('/:id/download', auth, contracts, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await container.prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: invoiceInclude,
      });
      if (!invoice) {
        res.status(404).json({ success: false, error: 'Invoice not found' });
        return;
      }

      const qr = qrFlag(req.query.qr);
      const pdfBytes = await invoices.renderPdf(invoice, { qr });

      const filename = `HoppDrive-${qr ?? invoice.withQrBill ? 'QR-' : ''}Rechnung-${invoice.invoiceNumber}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
