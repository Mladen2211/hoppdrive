import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateInvoiceItemInput, InvoiceDebtor } from '@hoppdrive/shared';
import { AppError } from '../../application/errors';
import type { EmailService } from '../email/EmailService';
import type { SettingsService } from './SettingsService';
import type { PdfService, InvoiceData, InvoiceLineItem } from './PdfService';
import type { QrBillService } from './QrBillService';
import { fmtDate, fmtMoney } from '../format';

/** Fallback only: the real rate is configurable in the settings (invoice_settings.vatRate). */
export const DEFAULT_VAT_RATE = 8.1;

/** What every invoice query / render needs. */
export const invoiceInclude = {
  booking: { include: { vehicle: true } },
  items: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.InvoiceInclude;

export type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface TotalsLine {
  quantity: number;
  unitPrice: number;
  /** null / undefined = the invoice's default rate. */
  vatRate?: number | null;
  /** Fixed line total (rental lines: the prorated price must not be re-derived from a rounded unit price). */
  total?: number;
}

export interface Totals {
  lines: { total: number; vatRate: number }[];
  subtotal: number;
  vatBreakdown: { rate: number; base: number; amount: number }[];
  vatAmount: number;
  total: number;
  /** Stored in Invoice.vatRate: the single rate of the lines, else the default rate. */
  vatRate: number;
}

/** Line totals, VAT per rate (rounded per rate group, the Swiss way) and the invoice total. */
export function computeTotals(items: TotalsLine[], defaultVatRate: number): Totals {
  const lines = items.map((i) => ({
    total: i.total !== undefined ? round2(i.total) : round2(i.quantity * i.unitPrice),
    vatRate: i.vatRate === null || i.vatRate === undefined ? defaultVatRate : Number(i.vatRate),
  }));
  const groups = new Map<number, number>();
  for (const l of lines) groups.set(l.vatRate, round2((groups.get(l.vatRate) ?? 0) + l.total));
  const vatBreakdown = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base, amount: round2((base * rate) / 100) }));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const vatAmount = round2(vatBreakdown.reduce((sum, g) => sum + g.amount, 0));
  return {
    lines,
    subtotal,
    vatBreakdown,
    vatAmount,
    total: round2(subtotal + vatAmount),
    vatRate: groups.size === 1 ? [...groups.keys()][0] : defaultVatRate,
  };
}

/** Invoice as the API returns it (see InvoiceDto in @hoppdrive/shared). */
export function mapInvoice(inv: any) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    type: inv.type ?? 'RENTAL',
    bookingId: inv.bookingId ?? null,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerAddress: inv.customerAddress,
    customerStreet: inv.customerStreet ?? null,
    customerZip: inv.customerZip ?? null,
    customerCity: inv.customerCity ?? null,
    customerCountry: inv.customerCountry ?? null,
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
    // PENDING and past its due date (computed on the server clock, so every client agrees).
    isOverdue: inv.status === 'PENDING' && new Date(inv.dueDate).getTime() < Date.now(),
    parentInvoiceId: inv.parentInvoiceId,
    notes: inv.notes,
    withQrBill: !!inv.withQrBill,
    qrReference: inv.qrReference ?? null,
    items: Array.isArray(inv.items)
      ? inv.items.map((i: any) => ({
          id: i.id,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          vatRate: i.vatRate === null || i.vatRate === undefined ? null : Number(i.vatRate),
          total: Number(i.total),
          sortOrder: i.sortOrder,
          feeId: i.feeId ?? null,
          damageId: i.damageId ?? null,
          fineId: i.fineId ?? null,
        }))
      : [],
    createdAt: inv.createdAt,
    booking: inv.booking
      ? {
          id: inv.booking.id,
          customerName: inv.booking.customerName,
          startDate: inv.booking.startDate,
          endDate: inv.booking.endDate,
          vehicle: inv.booking.vehicle ? { brand: inv.booking.vehicle.brand, model: inv.booking.vehicle.model } : null,
        }
      : null,
  };
}

export type MailOutcome = { emailSent: boolean; emailError?: 'no_recipient' | 'send_failed' };

export interface CreateRentalInput {
  bookingId: string;
  periodStart: Date;
  periodEnd: Date;
  notes?: string | null;
  vatRate?: number | null;
  dueDays?: number | null;
  withQrBill?: boolean;
  sendEmail?: boolean;
}

export interface CreateCustomInput {
  type: 'DAMAGE' | 'FINE' | 'OTHER';
  bookingId?: string | null;
  debtor?: InvoiceDebtor;
  items: CreateInvoiceItemInput[];
  notes?: string | null;
  vatRate?: number | null;
  dueDays?: number | null;
  withQrBill?: boolean;
  sendEmail?: boolean;
  /** Currency of the invoice; defaults to the booking's currency, else the active currency setting. */
  currency?: string;
}

const blank = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Creates, renders and mails invoices of every type (rental, damage, fine, other).
 * Invoices with saved line items (InvoiceItem) are rendered from those lines; older invoices without items are
 * rebuilt from the booking period like before (legacy rendering).
 */
export class InvoiceService {
  constructor(
    private prisma: PrismaClient,
    private settings: SettingsService,
    private pdf: PdfService,
    private qr: QrBillService,
    private email: EmailService,
  ) {}

  /* ──────────────────────────────────────────────────────────── *
   *  Numbers                                                     *
   * ──────────────────────────────────────────────────────────── */

  async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    // A serializable transaction prevents two requests from reading the same "last" number.
    return this.prisma.$transaction(
      async (tx) => {
        const last = await tx.invoice.findFirst({
          where: { invoiceNumber: { startsWith: `HD-${year}-` } },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        });
        const seq = last ? parseInt(last.invoiceNumber.split('-')[2], 10) + 1 : 1;
        return `HD-${year}-${String(seq).padStart(5, '0')}`;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /** Creates the row (with a fresh invoice number); retries when two requests drew the same number. */
  private async insert(build: (invoiceNumber: string) => Prisma.InvoiceCreateInput): Promise<InvoiceRow> {
    for (let attempt = 0; ; attempt++) {
      const invoiceNumber = await this.nextInvoiceNumber();
      try {
        return await this.prisma.invoice.create({ data: build(invoiceNumber), include: invoiceInclude });
      } catch (err) {
        const unique = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!unique || attempt >= 4) throw err;
      }
    }
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Create                                                      *
   * ──────────────────────────────────────────────────────────── */

  /**
   * The QR bill requested for a new invoice: explicit true must work (422 qr_bill_unavailable), the settings default
   * silently falls back to "no QR bill" when the creditor data is incomplete.
   * Returns a function deriving the stored reference (QRR / SCOR) for the final invoice number, or null for no QR bill.
   */
  private async resolveQr(
    requested: boolean | undefined,
    probe: { total: number; currency: string },
  ): Promise<((invoiceNumber: string) => string) | null> {
    const wanted = requested ?? (await this.settings.getInvoiceSettings()).defaultWithQrBill;
    if (!wanted) return null;
    const company = await this.settings.getCompany();
    const build = (invoiceNumber: string) =>
      this.qr.buildData({ invoiceNumber, total: probe.total, currency: probe.currency, company }).reference;
    try {
      build('HD-0000-00000');
      return build;
    } catch (err) {
      if (requested === true) throw err;
      return null;
    }
  }

  /** Rental invoice for a booking period (prorated like before), saved as one line item. */
  async createRental(input: CreateRentalInput): Promise<{ invoice: InvoiceRow } & MailOutcome> {
    const booking = await this.prisma.booking.findUnique({ where: { id: input.bookingId }, include: { vehicle: true } });
    if (!booking) throw new AppError('Booking not found', 404);
    if (input.periodEnd <= input.periodStart) throw new AppError('periodEnd must be after periodStart', 400);

    const dayMs = 24 * 60 * 60 * 1000;
    const bookingDays = Math.max(1, Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / dayMs));
    const invoiceDays = Math.max(1, Math.ceil((input.periodEnd.getTime() - input.periodStart.getTime()) / dayMs));
    const dailyRate = Number(booking.totalPrice) / bookingDays;
    const subtotal = round2(dailyRate * invoiceDays);

    const settings = await this.settings.getInvoiceSettings();
    const vatRate = input.vatRate ?? settings.vatRate ?? DEFAULT_VAT_RATE;
    const totals = computeTotals([{ quantity: invoiceDays, unitPrice: subtotal / invoiceDays, total: subtotal }], vatRate);
    const currency = booking.currency || 'CHF';
    const qrReference = await this.resolveQr(input.withQrBill, { total: totals.total, currency });

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (input.dueDays ?? settings.dueDays));

    const description = `Fahrzeugmiete – ${booking.vehicle.brand} ${booking.vehicle.model} (${fmtDate(input.periodStart)} – ${fmtDate(input.periodEnd)})`;
    const invoice = await this.insert((invoiceNumber) => ({
      invoiceNumber,
      type: 'RENTAL',
      booking: { connect: { id: booking.id } },
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerStreet: blank(booking.driverStreet),
      customerZip: blank(booking.driverZip),
      customerCity: blank(booking.driverCity),
      customerCountry: blank(booking.driverCountry),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      issueDate,
      dueDate,
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      penalty: 0,
      total: totals.total,
      currency,
      status: 'PENDING',
      notes: input.notes || null,
      withQrBill: qrReference !== null,
      qrReference: qrReference ? qrReference(invoiceNumber) : null,
      items: {
        create: [{ description, quantity: invoiceDays, unitPrice: round2(subtotal / invoiceDays), vatRate: null, total: subtotal, sortOrder: 0 }],
      },
    }));

    // Rental invoices are mailed on issuance (conventional for Swiss invoicing) unless the caller opts out.
    const mail = input.sendEmail === false ? { emailSent: false } : await this.mail(invoice);
    return { invoice, ...mail };
  }

  /** Damage / fine / other invoice from free lines, catalog fees, damages or fines. */
  async createCustom(input: CreateCustomInput): Promise<{ invoice: InvoiceRow } & MailOutcome> {
    if (!input.items.length) {
      throw new AppError('Mindestens eine Rechnungsposition ist erforderlich.', 422, 'items_required', undefined, {
        items: ['Mindestens eine Rechnungsposition ist erforderlich.'],
      });
    }

    const booking = input.bookingId
      ? await this.prisma.booking.findUnique({ where: { id: input.bookingId }, include: { vehicle: true } })
      : null;
    if (input.bookingId && !booking) throw new AppError('Booking not found', 404);

    // Debtor: what was entered wins, the booking's driver details fill the gaps.
    const d = input.debtor ?? ({} as Partial<InvoiceDebtor>);
    const name = blank(d.name) ?? booking?.customerName ?? null;
    if (!name) {
      throw new AppError('Name des Rechnungsempfängers ist erforderlich.', 422, 'debtor_required', undefined, {
        'debtor.name': ['Name des Rechnungsempfängers ist erforderlich.'],
      });
    }
    const debtor = {
      name,
      email: blank(d.email)?.toLowerCase() ?? booking?.customerEmail ?? null,
      street: blank(d.street) ?? blank(booking?.driverStreet),
      zip: blank(d.zip) ?? blank(booking?.driverZip),
      city: blank(d.city) ?? blank(booking?.driverCity),
      country: blank(d.country) ?? blank(booking?.driverCountry),
    };

    // Referenced catalog entries must exist (clear 422 instead of a foreign-key error).
    await this.assertReferences(input.items);

    const settings = await this.settings.getInvoiceSettings();
    const vatRate = input.vatRate ?? settings.vatRate ?? DEFAULT_VAT_RATE;
    const totals = computeTotals(input.items, vatRate);
    if (totals.total <= 0) {
      throw new AppError('Der Rechnungsbetrag muss grösser als 0 sein.', 422, 'invoice_total_invalid');
    }
    const currency = input.currency || booking?.currency || (await this.settings.getCurrency());
    const qrReference = await this.resolveQr(input.withQrBill, { total: totals.total, currency });

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (input.dueDays ?? settings.dueDays));

    const invoice = await this.insert((invoiceNumber) => ({
      invoiceNumber,
      type: input.type,
      ...(booking ? { booking: { connect: { id: booking.id } } } : {}),
      customerName: debtor.name,
      customerEmail: debtor.email,
      customerStreet: debtor.street,
      customerZip: debtor.zip,
      customerCity: debtor.city,
      customerCountry: debtor.country,
      // Periods only matter for rentals: the issue date marks other invoices.
      periodStart: issueDate,
      periodEnd: issueDate,
      issueDate,
      dueDate,
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      penalty: 0,
      total: totals.total,
      currency,
      status: 'PENDING',
      notes: input.notes || null,
      withQrBill: qrReference !== null,
      qrReference: qrReference ? qrReference(invoiceNumber) : null,
      items: {
        create: input.items.map((item, index) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate ?? null,
          total: totals.lines[index].total,
          sortOrder: index,
          feeId: item.feeId ?? null,
          damageId: item.damageId ?? null,
          fineId: item.fineId ?? null,
        })),
      },
    }));

    // Fines that are billed now are "INVOICED" (a closed fine stays closed).
    const fineIds = [...new Set(input.items.map((i) => i.fineId).filter((id): id is string => !!id))];
    if (fineIds.length > 0) {
      await this.prisma.fine.updateMany({ where: { id: { in: fineIds }, status: { not: 'CLOSED' } }, data: { status: 'INVOICED' } });
    }

    const mail = input.sendEmail === true ? await this.mail(invoice) : { emailSent: false };
    return { invoice, ...mail };
  }

  private async assertReferences(items: CreateInvoiceItemInput[]): Promise<void> {
    const check = async (kind: 'feeId' | 'damageId' | 'fineId', model: 'fee' | 'vehicleDamage' | 'fine') => {
      const ids = [...new Set(items.map((i) => i[kind]).filter((id): id is string => !!id))];
      if (ids.length === 0) return;
      const found = await (this.prisma[model] as any).count({ where: { id: { in: ids } } });
      if (found !== ids.length) {
        throw new AppError('Eine referenzierte Gebühr, ein Schaden oder eine Busse existiert nicht (mehr).', 422, 'invalid_reference', undefined, {
          items: [`${kind} unbekannt`],
        });
      }
    };
    await check('feeId', 'fee');
    await check('damageId', 'vehicleDamage');
    await check('fineId', 'fine');
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Render                                                      *
   * ──────────────────────────────────────────────────────────── */

  /**
   * Renders the invoice PDF. `qr` forces the Swiss QR bill (true) or omits it (false); default: the invoice's own
   * withQrBill flag. A QR bill that cannot be built (missing creditor data) rejects with 422 qr_bill_unavailable.
   */
  async renderPdf(invoice: InvoiceRow, options: { qr?: boolean } = {}): Promise<Uint8Array> {
    const company = await this.settings.getCompany();
    const wantQr = options.qr ?? invoice.withQrBill;
    const subtotal = Number(invoice.subtotal);
    const penalty = Number(invoice.penalty);
    const hasItems = invoice.items.length > 0;

    let data: InvoiceData;
    const structured = [
      invoice.customerStreet,
      [invoice.customerZip, invoice.customerCity].filter(Boolean).join(' '),
      invoice.customerCountry,
    ].filter((l): l is string => !!l && l.trim() !== '');
    const customerAddress = structured.length > 0 ? structured.join('\n') : invoice.customerAddress;
    const base = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerAddress,
      subtotal,
      vatRate: Number(invoice.vatRate),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
      currency: invoice.currency,
      notes: invoice.notes,
      bookingRef: invoice.booking ? invoice.booking.id.substring(0, 8).toUpperCase() : null,
    };

    if (hasItems) {
      const defaultRate = Number(invoice.vatRate);
      const lines: InvoiceLineItem[] = invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
        vatRate: i.vatRate === null ? defaultRate : Number(i.vatRate),
      }));
      const totals = computeTotals(
        invoice.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), vatRate: i.vatRate === null ? null : Number(i.vatRate), total: Number(i.total) })),
        defaultRate,
      );
      data = {
        ...base,
        title: INVOICE_TITLES[invoice.type],
        items: lines,
        vatBreakdown: totals.vatBreakdown,
        showVatColumn: new Set(lines.map((l) => l.vatRate)).size > 1,
        penalty: penalty > 0 ? penalty : undefined,
      };
    } else {
      // Legacy invoice without saved items: rebuilt from the booking period (rental line + optional reminder fee).
      const days = Math.max(1, Math.ceil((invoice.periodEnd.getTime() - invoice.periodStart.getTime()) / (24 * 60 * 60 * 1000)));
      const vehicle = invoice.booking?.vehicle;
      const items: InvoiceLineItem[] = [
        {
          description: `Fahrzeugmiete${vehicle ? ` – ${vehicle.brand} ${vehicle.model}` : ''} (${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)})`,
          quantity: days,
          unitPrice: subtotal / days,
          total: subtotal,
        },
      ];
      if (penalty > 0) items.push({ description: 'Verzugsgebühr / Mahngebühr', quantity: 1, unitPrice: penalty, total: penalty });
      data = { ...base, items };
    }

    if (wantQr) {
      const built = this.qr.buildData({
        invoiceNumber: invoice.invoiceNumber,
        total: Number(invoice.total),
        currency: invoice.currency,
        company,
        debtor: {
          name: invoice.customerName,
          street: invoice.customerStreet,
          zip: invoice.customerZip,
          city: invoice.customerCity,
          country: invoice.customerCountry,
        },
      });
      data.qrPage = await this.qr.render(built.data);
      data.qrReference = built.reference;
      // The reference is derived from the invoice number: remember it (also for on-demand renderings).
      if (invoice.qrReference !== built.reference) {
        await this.prisma.invoice.update({ where: { id: invoice.id }, data: { qrReference: built.reference } });
        invoice.qrReference = built.reference;
      }
    }

    return this.pdf.generateInvoice(data, { company });
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Mail                                                        *
   * ──────────────────────────────────────────────────────────── */

  /** Mails the invoice (PDF attached) with the template that fits its type. Never throws. */
  async mail(
    invoice: InvoiceRow,
    options: { reminder?: { originalInvoiceNumber: string; note?: string } } = {},
  ): Promise<MailOutcome> {
    if (!invoice.customerEmail) return { emailSent: false, emailError: 'no_recipient' };
    try {
      const pdfBytes = await this.renderPdf(invoice);
      const related = { type: 'invoice', id: invoice.id };
      const total = Number(invoice.total);
      const common = { to: invoice.customerEmail, customerName: invoice.customerName, invoiceNumber: invoice.invoiceNumber, total, currency: invoice.currency, dueDate: invoice.dueDate };
      const attachment = { filename: `HoppDrive_Rechnung_${invoice.invoiceNumber}.pdf`, bytes: pdfBytes, contentType: 'application/pdf' };

      let result;
      if (options.reminder) {
        result = await this.email.sendInvoiceEmail({
          ...common,
          pdfBytes,
          withQrBill: invoice.withQrBill,
          related,
          reminder: { originalInvoiceNumber: options.reminder.originalInvoiceNumber, dueDate: invoice.dueDate, note: options.reminder.note },
        });
      } else if (invoice.type === 'DAMAGE') {
        result = await this.email.sendDamageInvoice({
          ...common,
          vehicleName: invoice.booking?.vehicle ? `${invoice.booking.vehicle.brand} ${invoice.booking.vehicle.model}` : null,
          bookingRef: invoice.booking ? invoice.booking.id.substring(0, 8).toUpperCase() : null,
          damageLines: invoice.items.map((i) => i.description),
          withQrBill: invoice.withQrBill,
          attachments: [attachment],
          related,
        });
      } else if (invoice.type === 'FINE') {
        const fineId = invoice.items.find((i) => i.fineId)?.fineId;
        const fine = fineId ? await this.prisma.fine.findUnique({ where: { id: fineId } }) : null;
        result = await this.email.sendFineInvoice({
          ...common,
          licensePlate: fine?.licensePlate ?? '',
          occurredAt: fine?.occurredAt ?? invoice.issueDate,
          place: fine?.place || null,
          authority: fine?.authority || null,
          reference: fine?.reference || null,
          withQrBill: invoice.withQrBill,
          attachments: [attachment],
          related,
        });
      } else {
        result = await this.email.sendInvoiceEmail({ ...common, pdfBytes, withQrBill: invoice.withQrBill, related });
      }
      // SENT = delivered now; QUEUED = the outbox keeps retrying (visible in the e-mail log).
      return result.status === 'SENT' ? { emailSent: true } : { emailSent: false, emailError: 'send_failed' };
    } catch (err) {
      console.error('[Invoice] Failed to send invoice email:', err);
      return { emailSent: false, emailError: 'send_failed' };
    }
  }

  /** One-line summary for the audit log. */
  static auditSummary(invoice: InvoiceRow) {
    return {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      type: invoice.type,
      total: Number(invoice.total),
      currency: invoice.currency,
      amount: fmtMoney(Number(invoice.total), invoice.currency),
      withQrBill: invoice.withQrBill,
    };
  }
}

const INVOICE_TITLES: Record<string, string> = {
  RENTAL: 'Rechnung / Invoice',
  DAMAGE: 'Rechnung – Fahrzeugschaden',
  FINE: 'Rechnung – Busse (Weiterverrechnung)',
  OTHER: 'Rechnung / Invoice',
};
