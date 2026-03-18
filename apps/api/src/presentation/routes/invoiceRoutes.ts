import { Router, Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/config/container';
import { createAuthMiddleware } from '../middleware/authMiddleware';
import type { InvoiceLineItem } from '../../infrastructure/services/PdfService';

const SWISS_VAT_RATE = 8.1; // Swiss standard MwSt rate

export function invoiceRoutes(container: Container): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.tokenService);

  /** GET /api/invoices – List invoices */
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

  /** POST /api/invoices/bulk – Generate one invoice per booking, merged into a single PDF */
  router.post('/bulk', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingIds, notes, vatRate: customVatRate, dueDays, label } = req.body;
      if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
        res.status(400).json({ success: false, error: 'bookingIds[] is required' });
        return;
      }

      const bookings = await container.prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        include: { vehicle: true },
        orderBy: { startDate: 'asc' },
      }) as any[];
      if (bookings.length === 0) {
        res.status(404).json({ success: false, error: 'No bookings found' });
        return;
      }

      // Get next sequential invoice number
      const year = new Date().getFullYear();
      const lastInv = await container.prisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: `HD-${year}-` } },
        orderBy: { invoiceNumber: 'desc' },
      });
      let seq = 1;
      if (lastInv) {
        const parts = lastInv.invoiceNumber.split('-');
        seq = parseInt(parts[2], 10) + 1;
      }

      const vatRate = customVatRate ?? SWISS_VAT_RATE;
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (dueDays ?? 30));

      // Generate one invoice PDF per booking, then merge all pages into one PDF
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const b of bookings) {
        const days = Math.max(1, Math.ceil(
          (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24),
        ));
        const price = Number(b.totalPrice) || 0;
        const vatAmount = Math.round(price * vatRate) / 100;
        const total = price + vatAmount;
        const invoiceNumber = `HD-${year}-${String(seq).padStart(5, '0')}`;
        seq++;

        const items: InvoiceLineItem[] = [{
          description: `Fahrzeugmiete – ${b.vehicle.brand} ${b.vehicle.model} (${new Date(b.startDate).toLocaleDateString('de-CH')} – ${new Date(b.endDate).toLocaleDateString('de-CH')})`,
          quantity: days,
          unitPrice: price / days,
          total: price,
        }];

        // Store invoice record
        await container.prisma.invoice.create({
          data: {
            invoiceNumber,
            bookingId: b.id,
            customerName: b.customerName,
            customerEmail: b.customerEmail,
            issueDate,
            dueDate,
            subtotal: price,
            vatRate,
            vatAmount,
            total,
            currency: b.currency || 'CHF',
            status: 'DRAFT',
            notes: notes || (label ? `${label}` : null),
          },
        });

        // Generate individual invoice PDF
        const pdfBytes = await container.pdfService.generateInvoice({
          invoiceNumber,
          issueDate,
          dueDate,
          customerName: b.customerName,
          customerEmail: b.customerEmail,
          customerAddress: null,
          items,
          subtotal: price,
          vatRate,
          vatAmount,
          total,
          currency: b.currency || 'CHF',
          notes: notes || null,
          bookingRef: b.id.substring(0, 8).toUpperCase(),
        });

        // Copy pages into merged document
        const singlePdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(singlePdf, singlePdf.getPageIndices());
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
      }

      const mergedBytes = await mergedPdf.save();
      const filename = `HoppDrive-${(label || 'Rechnungen').replace(/\s+/g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', mergedBytes.length);
      res.send(Buffer.from(mergedBytes));
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/invoices – Create invoice from a booking */
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId, notes, vatRate: customVatRate, dueDays } = req.body;
      if (!bookingId) {
        res.status(400).json({ success: false, error: 'bookingId is required' });
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

      // Generate sequential invoice number: HD-YYYY-NNNNN
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
      const invoiceNumber = `HD-${year}-${String(seq).padStart(5, '0')}`;

      const vatRate = customVatRate ?? SWISS_VAT_RATE;
      const subtotal = Number(booking.totalPrice);
      const vatAmount = Math.round(subtotal * vatRate) / 100;
      const total = subtotal + vatAmount;
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (dueDays ?? 30));

      const invoice = await container.prisma.invoice.create({
        data: {
          invoiceNumber,
          bookingId,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          issueDate,
          dueDate,
          subtotal,
          vatRate,
          vatAmount,
          total,
          currency: booking.currency,
          status: 'DRAFT',
          notes: notes || null,
        },
        include: { booking: { include: { vehicle: true } } },
      });

      res.status(201).json({ success: true, data: mapInvoice(invoice) });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /api/invoices/:id – Update invoice (status, notes, etc.) */
  router.patch('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, notes, customerAddress } = req.body;
      const invoice = await container.prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          ...(status !== undefined && { status }),
          ...(notes !== undefined && { notes }),
          ...(customerAddress !== undefined && { customerAddress }),
        },
        include: { booking: { include: { vehicle: true } } },
      });
      res.json({ success: true, data: mapInvoice(invoice) });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/invoices/:id/download – Download invoice PDF */
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

      const days = Math.ceil(
        (invoice.booking.endDate.getTime() - invoice.booking.startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const items: InvoiceLineItem[] = [
        {
          description: `Fahrzeugmiete – ${invoice.booking.vehicle.brand} ${invoice.booking.vehicle.model} (${invoice.booking.startDate.toLocaleDateString('de-CH')} – ${invoice.booking.endDate.toLocaleDateString('de-CH')})`,
          quantity: days,
          unitPrice: Number(invoice.subtotal) / days,
          total: Number(invoice.subtotal),
        },
      ];

      const pdfBytes = await container.pdfService.generateInvoice({
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        customerAddress: invoice.customerAddress,
        items,
        subtotal: Number(invoice.subtotal),
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

  /** POST /api/invoices/:id/send – Send invoice via email */
  router.post('/:id/send', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await container.prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: { booking: { include: { vehicle: true } } },
      });
      if (!invoice) {
        res.status(404).json({ success: false, error: 'Invoice not found' });
        return;
      }
      if (!invoice.customerEmail) {
        res.status(400).json({ success: false, error: 'No customer email on invoice' });
        return;
      }

      // Mark as sent
      await container.prisma.invoice.update({
        where: { id: req.params.id },
        data: { status: 'SENT' },
      });

      res.json({ success: true, data: null, message: 'Invoice sent' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function mapInvoice(inv: any) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    bookingId: inv.bookingId,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerAddress: inv.customerAddress,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subtotal: Number(inv.subtotal),
    vatRate: Number(inv.vatRate),
    vatAmount: Number(inv.vatAmount),
    total: Number(inv.total),
    currency: inv.currency,
    status: inv.status,
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
