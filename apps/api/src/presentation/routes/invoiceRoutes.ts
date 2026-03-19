import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import type { InvoiceLineItem } from '../../infrastructure/services/PdfService';

const SWISS_VAT_RATE = 8.1; // Swiss standard MwSt rate

export function invoiceRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /* ────────────────────────────────────────────────────────────
   *  GET /api/invoices – List invoices, optionally by bookingId
   * ──────────────────────────────────────────────────────────── */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, bookingId } = req.query;
      const where: any = {};
      if (status) where.status = status;
      if (bookingId) where.bookingId = bookingId;

      const invoices = await container.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { booking: { include: { vehicle: true } } },
      });

      res.json({ success: true, data: invoices.map(mapInvoice) });
    } catch (err) {
      next(err);
    }
  });

  /* ────────────────────────────────────────────────────────────
   *  POST /api/invoices – Create invoice for a booking + date range
   *  Body: { bookingId, periodStart, periodEnd, notes?, vatRate?, dueDays? }
   * ──────────────────────────────────────────────────────────── */
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId, periodStart, periodEnd, notes, vatRate: customVatRate, dueDays } = req.body;

      if (!bookingId || !periodStart || !periodEnd) {
        res.status(400).json({ success: false, error: 'bookingId, periodStart and periodEnd are required' });
        return;
      }

      const booking = await container.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { vehicle: true },
      }) as any;
      if (!booking) {
        res.status(404).json({ success: false, error: 'Booking not found' });
        return;
      }

      const pStart = new Date(periodStart);
      const pEnd = new Date(periodEnd);
      if (pEnd <= pStart) {
        res.status(400).json({ success: false, error: 'periodEnd must be after periodStart' });
        return;
      }

      // Calculate days in the invoiced period
      const totalBookingDays = Math.max(1, Math.ceil(
        (new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60 * 24),
      ));
      const invoiceDays = Math.max(1, Math.ceil(
        (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24),
      ));
      const dailyRate = Number(booking.totalPrice) / totalBookingDays;
      const subtotal = Math.round(dailyRate * invoiceDays * 100) / 100;

      const vatRate = customVatRate ?? SWISS_VAT_RATE;
      const vatAmount = Math.round(subtotal * vatRate) / 100;
      const total = Math.round((subtotal + vatAmount) * 100) / 100;

      const invoiceNumber = await nextInvoiceNumber(container);
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (dueDays ?? 30));

      const invoice = await container.prisma.invoice.create({
        data: {
          invoiceNumber,
          bookingId,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          periodStart: pStart,
          periodEnd: pEnd,
          issueDate,
          dueDate,
          subtotal,
          vatRate,
          vatAmount,
          total,
          penalty: 0,
          currency: booking.currency || 'CHF',
          status: 'PENDING',
          notes: notes || null,
        },
        include: { booking: { include: { vehicle: true } } },
      });

      res.status(201).json({ success: true, data: mapInvoice(invoice) });
    } catch (err) {
      next(err);
    }
  });

  /* ────────────────────────────────────────────────────────────
   *  PATCH /api/invoices/:id/status – Toggle PENDING / PAID
   * ──────────────────────────────────────────────────────────── */
  router.patch('/:id/status', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!status || !['PENDING', 'PAID'].includes(status)) {
        res.status(400).json({ success: false, error: 'status must be PENDING or PAID' });
        return;
      }

      const invoice = await container.prisma.invoice.update({
        where: { id: req.params.id },
        data: { status },
        include: { booking: { include: { vehicle: true } } },
      });

      res.json({ success: true, data: mapInvoice(invoice) });
    } catch (err) {
      next(err);
    }
  });

  /* ────────────────────────────────────────────────────────────
   *  POST /api/invoices/:id/reissue – Reissue with penalty
   *  Body: { penalty: number, notes? }
   * ──────────────────────────────────────────────────────────── */
  router.post('/:id/reissue', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { penalty, notes } = req.body;
      const penaltyAmount = Number(penalty) || 0;

      const original = await container.prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: { booking: { include: { vehicle: true } } },
      });
      if (!original) {
        res.status(404).json({ success: false, error: 'Invoice not found' });
        return;
      }

      const subtotal = Number(original.subtotal);
      const vatRate = Number(original.vatRate);
      const vatAmount = Math.round(subtotal * vatRate) / 100;
      const total = Math.round((subtotal + vatAmount + penaltyAmount) * 100) / 100;

      const invoiceNumber = await nextInvoiceNumber(container);
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14-day deadline on reissue

      const reissued = await container.prisma.invoice.create({
        data: {
          invoiceNumber,
          bookingId: original.bookingId,
          customerName: original.customerName,
          customerEmail: original.customerEmail,
          customerAddress: original.customerAddress,
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
        },
        include: { booking: { include: { vehicle: true } } },
      });

      res.status(201).json({ success: true, data: mapInvoice(reissued) });
    } catch (err) {
      next(err);
    }
  });

  /* ────────────────────────────────────────────────────────────
   *  GET /api/invoices/:id/download – Download invoice PDF
   * ──────────────────────────────────────────────────────────── */
  router.get('/:id/download', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await container.prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: { booking: { include: { vehicle: true } } },
      });
      if (!invoice) {
        res.status(404).json({ success: false, error: 'Invoice not found' });
        return;
      }

      const periodDays = Math.max(1, Math.ceil(
        (invoice.periodEnd.getTime() - invoice.periodStart.getTime()) / (1000 * 60 * 60 * 24),
      ));
      const subtotal = Number(invoice.subtotal);
      const penaltyAmt = Number(invoice.penalty);

      const items: InvoiceLineItem[] = [
        {
          description: `Fahrzeugmiete – ${(invoice.booking as any).vehicle.brand} ${(invoice.booking as any).vehicle.model} (${invoice.periodStart.toLocaleDateString('de-CH')} – ${invoice.periodEnd.toLocaleDateString('de-CH')})`,
          quantity: periodDays,
          unitPrice: subtotal / periodDays,
          total: subtotal,
        },
      ];

      if (penaltyAmt > 0) {
        items.push({
          description: 'Verzugsgebühr / Mahngebühr',
          quantity: 1,
          unitPrice: penaltyAmt,
          total: penaltyAmt,
        });
      }

      const pdfBytes = await container.pdfService.generateInvoice({
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        customerAddress: invoice.customerAddress,
        items,
        subtotal: subtotal + penaltyAmt,
        vatRate: Number(invoice.vatRate),
        vatAmount: Number(invoice.vatAmount),
        total: Number(invoice.total),
        currency: invoice.currency,
        notes: invoice.notes,
        bookingRef: invoice.booking.id.substring(0, 8).toUpperCase(),
      });

      const filename = `HoppDrive-Rechnung-${invoice.invoiceNumber}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/* ══════════════════════════════════════════════════════════════
 *  Helpers
 * ══════════════════════════════════════════════════════════════ */

async function nextInvoiceNumber(container: Container): Promise<string> {
  const year = new Date().getFullYear();
  const lastInvoice = await container.prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `HD-${year}-` } },
    orderBy: { invoiceNumber: 'desc' },
  });
  let seq = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split('-');
    seq = parseInt(parts[2], 10) + 1;
  }
  return `HD-${year}-${String(seq).padStart(5, '0')}`;
}

function mapInvoice(inv: any) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    bookingId: inv.bookingId,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerAddress: inv.customerAddress,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subtotal: Number(inv.subtotal),
    vatRate: Number(inv.vatRate),
    vatAmount: Number(inv.vatAmount),
    penalty: Number(inv.penalty),
    total: Number(inv.total),
    currency: inv.currency,
    status: inv.status,
    parentInvoiceId: inv.parentInvoiceId,
    notes: inv.notes,
    createdAt: inv.createdAt,
    booking: inv.booking
      ? {
          id: inv.booking.id,
          customerName: inv.booking.customerName,
          startDate: inv.booking.startDate,
          endDate: inv.booking.endDate,
          vehicle: inv.booking.vehicle
            ? { brand: inv.booking.vehicle.brand, model: inv.booking.vehicle.model }
            : null,
        }
      : null,
  };
}
