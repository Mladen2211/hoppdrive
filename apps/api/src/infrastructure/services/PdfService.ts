import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';

/* ================================================================
 * Shared types
 * ================================================================ */

interface CompanyInfo {
  name: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  uid: string; // Swiss UID / VAT number (MwSt-Nr.)
  signatureData?: string | null; // admin company signature (base64 PNG)
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Euro-Abschleppservice GmbH',
  address: 'Industriestrasse 10',
  zip: '8305',
  city: 'Dietlikon',
  country: 'Schweiz',
  phone: '+41 44 833 33 33',
  email: 'info@hoppdrive.ch',
  uid: 'CHE-XXX.XXX.XXX MWST', // placeholder – update from SiteSettings
};

/* ================================================================
 * Contract data
 * ================================================================ */

export interface ContractData {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate?: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  currency: string;
  signatureData?: string | null; // customer signature
  signedAt?: Date | null;
  notes?: string | null;
  locationName?: string | null;
}

/* ================================================================
 * Invoice data
 * ================================================================ */

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  customerName: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;    // e.g. 8.1 for 8.1 %
  vatAmount: number;
  total: number;
  currency: string;
  notes?: string | null;
  bookingRef?: string | null; // shortened booking id for reference
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/* ================================================================
 * PDF Service
 * ================================================================ */

export class PdfService {
  private company: CompanyInfo;

  constructor(companyOverrides?: Partial<CompanyInfo>) {
    this.company = { ...DEFAULT_COMPANY, ...companyOverrides };
  }

  /** Update company info at runtime (e.g. after reading SiteSettings) */
  updateCompany(overrides: Partial<CompanyInfo>) {
    Object.assign(this.company, overrides);
  }

  /* ──────────────────────────────────────────────────────────── *
   *  CONTRACT PDF                                                *
   * ──────────────────────────────────────────────────────────── */

  async generateContract(data: ContractData): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const brandRed = rgb(0.65, 0.055, 0.055);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.93, 0.93, 0.93);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 60;

    // ── Header ────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.97, 0.97, 0.97) });
    page.drawText('HOPPDRIVE', { x: 50, y: height - 50, size: 24, font: helveticaBold, color: brandRed });
    page.drawText('Mietvertrag / Rental Agreement', { x: 50, y: height - 70, size: 10, font: helvetica, color: gray });

    // ── Contract ref & date ───────────────────────
    y = height - 110;
    page.drawText(`Vertragsnr.: ${data.id.substring(0, 8).toUpperCase()}`, {
      x: 50, y, size: 9, font: helvetica, color: gray,
    });
    const contractDate = data.signedAt
      ? data.signedAt.toLocaleDateString('de-CH')
      : new Date().toLocaleDateString('de-CH');
    page.drawText(`Datum: ${contractDate}`, {
      x: 380, y, size: 9, font: helvetica, color: gray,
    });

    // ── Parties ───────────────────────────────────
    y -= 35;
    page.drawText('Vertragsparteien', { x: 50, y, size: 13, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    // Left column – company
    y -= 22;
    page.drawText('Vermieter:', { x: 50, y, size: 10, font: helveticaBold, color: gray });
    y -= 16;
    page.drawText(this.company.name, { x: 50, y, size: 10, font: helveticaBold, color: black });
    y -= 14;
    page.drawText(`${this.company.address}, ${this.company.zip} ${this.company.city}`, { x: 50, y, size: 9, font: helvetica, color: gray });
    y -= 14;
    page.drawText(`Tel: ${this.company.phone} | ${this.company.email}`, { x: 50, y, size: 9, font: helvetica, color: gray });

    // Right area – customer
    const cY = y + 44;
    page.drawText('Mieter:', { x: 320, y: cY, size: 10, font: helveticaBold, color: gray });
    page.drawText(data.customerName, { x: 320, y: cY - 16, size: 10, font: helveticaBold, color: black });
    if (data.customerEmail) {
      page.drawText(data.customerEmail, { x: 320, y: cY - 30, size: 9, font: helvetica, color: gray });
    }

    // ── Vehicle section ───────────────────────────
    y -= 30;
    page.drawText('Fahrzeug', { x: 50, y, size: 13, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    this.drawLabelValue(page, 'Fahrzeug:', `${data.vehicleBrand} ${data.vehicleModel}`, 50, y, helvetica, helveticaBold);
    y -= 20;
    if (data.licensePlate) {
      this.drawLabelValue(page, 'Kennzeichen:', data.licensePlate, 50, y, helvetica, helveticaBold);
      y -= 20;
    }
    if (data.locationName) {
      this.drawLabelValue(page, 'Standort:', data.locationName, 50, y, helvetica, helveticaBold);
      y -= 20;
    }

    // ── Rental period ─────────────────────────────
    y -= 15;
    page.drawText('Mietdauer', { x: 50, y, size: 13, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    const startStr = data.startDate.toLocaleDateString('de-CH');
    const endStr = data.endDate.toLocaleDateString('de-CH');
    const days = Math.ceil((data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24));
    this.drawLabelValue(page, 'Von:', startStr, 50, y, helvetica, helveticaBold);
    this.drawLabelValue(page, 'Bis:', endStr, 300, y, helvetica, helveticaBold);
    y -= 20;
    this.drawLabelValue(page, 'Tage:', `${days}`, 50, y, helvetica, helveticaBold);

    // ── Pricing ───────────────────────────────────
    y -= 35;
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 35, color: lightGray });
    page.drawText('Gesamtpreis:', { x: 60, y: y + 5, size: 12, font: helveticaBold, color: black });
    page.drawText(`${data.currency} ${data.totalPrice.toFixed(2)}`, {
      x: 380, y: y + 5, size: 14, font: helveticaBold, color: brandRed,
    });

    // ── Notes ─────────────────────────────────────
    if (data.notes) {
      y -= 50;
      page.drawText('Bemerkungen:', { x: 50, y, size: 10, font: helveticaBold, color: gray });
      y -= 16;
      const noteLines = this.wrapText(data.notes, helvetica, 9, width - 120);
      for (const line of noteLines) {
        page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: gray });
        y -= 14;
      }
    }

    // ── Terms ─────────────────────────────────────
    y -= 30;
    page.drawText('Allgemeine Mietbedingungen', { x: 50, y, size: 11, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });
    y -= 18;
    const terms = [
      'Der Mieter verpflichtet sich, das Fahrzeug sorgfältig zu behandeln und in gleichem Zustand zurückzugeben.',
      'Bei Schäden oder Unfällen ist die Vermieterin unverzüglich zu benachrichtigen.',
      'Das Fahrzeug darf nur vom Mieter oder einer bevollmächtigten Person gefahren werden.',
      'Die Kaution wird nach Rückgabe und Überprüfung des Fahrzeugs zurückerstattet.',
      'Gerichtsstand ist der Sitz der Vermieterin. Es gilt Schweizer Recht.',
    ];
    for (const term of terms) {
      const lines = this.wrapText(`• ${term}`, helvetica, 8, width - 120);
      for (const line of lines) {
        page.drawText(line, { x: 55, y, size: 8, font: helvetica, color: gray });
        y -= 13;
      }
      y -= 2;
    }

    // ── Signatures ────────────────────────────────
    y -= 30;
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 25;

    page.drawText('Vermieter', { x: 50, y, size: 10, font: helveticaBold, color: black });
    page.drawText('Mieter', { x: 340, y, size: 10, font: helveticaBold, color: black });

    y -= 16;
    page.drawText(this.company.name, { x: 50, y, size: 9, font: helvetica, color: gray });

    // Embed company signature (admin signature from profile)
    if (this.company.signatureData) {
      try {
        const base64 = this.company.signatureData.replace(/^data:image\/png;base64,/, '');
        const sigImg = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
        const dims = sigImg.scale(0.4);
        const scale = Math.min(180 / dims.width, 60 / dims.height, 1);
        page.drawImage(sigImg, { x: 50, y: y - 55, width: dims.width * scale, height: dims.height * scale });
      } catch (err) {
        console.error('[PdfService] Failed to embed company signature:', err);
      }
    }

    // Embed customer signature
    if (data.signatureData) {
      try {
        const base64 = data.signatureData.replace(/^data:image\/png;base64,/, '');
        const sigImg = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
        const dims = sigImg.scale(0.4);
        const scale = Math.min(180 / dims.width, 60 / dims.height, 1);
        page.drawImage(sigImg, { x: 340, y: y - 55, width: dims.width * scale, height: dims.height * scale });
      } catch (err) {
        console.error('[PdfService] Failed to embed customer signature:', err);
      }
    }

    y -= 70;
    page.drawRectangle({ x: 50, y, width: 180, height: 1, color: rgb(0.7, 0.7, 0.7) });
    page.drawRectangle({ x: 340, y, width: 180, height: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;

    if (data.signedAt) {
      const sd = data.signedAt.toLocaleDateString('de-CH');
      const st = data.signedAt.toLocaleTimeString('de-CH');
      page.drawText(`Signiert am: ${sd} um ${st}`, { x: 50, y, size: 8, font: helvetica, color: gray });
      page.drawText(`Signiert am: ${sd} um ${st}`, { x: 340, y, size: 8, font: helvetica, color: gray });
    } else {
      page.drawText('Datum / Unterschrift', { x: 50, y, size: 8, font: helvetica, color: gray });
      page.drawText('Datum / Unterschrift', { x: 340, y, size: 8, font: helvetica, color: gray });
    }

    // ── Footer ────────────────────────────────────
    page.drawText(
      `HoppDrive – ${this.company.name} | hoppdrive.ch`,
      { x: 50, y: 30, size: 7, font: helvetica, color: rgb(0.6, 0.6, 0.6) },
    );

    return pdfDoc.save();
  }

  /* ──────────────────────────────────────────────────────────── *
   *  INVOICE PDF (Swiss-compliant)                               *
   * ──────────────────────────────────────────────────────────── */

  async generateInvoice(data: InvoiceData): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const brandRed = rgb(0.65, 0.055, 0.055);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.93, 0.93, 0.93);

    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 60;

    // ── Header ────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.97, 0.97, 0.97) });
    page.drawText('HOPPDRIVE', { x: 50, y: height - 50, size: 24, font: helveticaBold, color: brandRed });
    page.drawText('Rechnung / Invoice', { x: 50, y: height - 70, size: 10, font: helvetica, color: gray });

    // ── Company address block (top right) ─────────
    const companyLines = [
      this.company.name,
      this.company.address,
      `${this.company.zip} ${this.company.city}`,
      `Tel: ${this.company.phone}`,
      this.company.email,
      this.company.uid,
    ];
    let cy = height - 100;
    for (const line of companyLines) {
      page.drawText(line, { x: 380, y: cy, size: 8, font: helvetica, color: gray });
      cy -= 12;
    }

    // ── Invoice meta ──────────────────────────────
    y = height - 110;
    page.drawText(`Rechnung Nr.: ${data.invoiceNumber}`, { x: 50, y, size: 10, font: helveticaBold, color: black });
    y -= 18;
    page.drawText(`Rechnungsdatum: ${data.issueDate.toLocaleDateString('de-CH')}`, { x: 50, y, size: 9, font: helvetica, color: gray });
    y -= 14;
    page.drawText(`Fälligkeitsdatum: ${data.dueDate.toLocaleDateString('de-CH')}`, { x: 50, y, size: 9, font: helvetica, color: gray });
    if (data.bookingRef) {
      y -= 14;
      page.drawText(`Buchungsreferenz: ${data.bookingRef}`, { x: 50, y, size: 9, font: helvetica, color: gray });
    }

    // ── Customer address block ────────────────────
    y -= 30;
    page.drawText('Rechnungsempfänger:', { x: 50, y, size: 10, font: helveticaBold, color: gray });
    y -= 18;
    page.drawText(data.customerName, { x: 50, y, size: 10, font: helveticaBold, color: black });
    y -= 14;
    if (data.customerAddress) {
      const addrLines = data.customerAddress.split('\n');
      for (const line of addrLines) {
        page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: gray });
        y -= 14;
      }
    }
    if (data.customerEmail) {
      page.drawText(data.customerEmail, { x: 50, y, size: 9, font: helvetica, color: gray });
      y -= 14;
    }

    // ── Line items table ──────────────────────────
    y -= 25;

    // Table header
    const colX = { desc: 50, qty: 340, unit: 410, total: 490 };
    page.drawRectangle({ x: 50, y: y - 4, width: width - 100, height: 22, color: lightGray });
    page.drawText('Beschreibung', { x: colX.desc, y, size: 9, font: helveticaBold, color: black });
    page.drawText('Menge', { x: colX.qty, y, size: 9, font: helveticaBold, color: black });
    page.drawText('Preis', { x: colX.unit, y, size: 9, font: helveticaBold, color: black });
    page.drawText('Total', { x: colX.total, y, size: 9, font: helveticaBold, color: black });

    y -= 22;

    // Table rows
    for (const item of data.items) {
      page.drawRectangle({ x: 50, y: y - 4, width: width - 100, height: 1, color: rgb(0.9, 0.9, 0.9) });
      // Wrap long descriptions
      const descLines = this.wrapText(item.description, helvetica, 9, 280);
      for (let i = 0; i < descLines.length; i++) {
        page.drawText(descLines[i], { x: colX.desc, y, size: 9, font: helvetica, color: black });
        if (i === 0) {
          page.drawText(`${item.quantity}`, { x: colX.qty, y, size: 9, font: helvetica, color: black });
          page.drawText(`${data.currency} ${item.unitPrice.toFixed(2)}`, { x: colX.unit, y, size: 9, font: helvetica, color: black });
          page.drawText(`${data.currency} ${item.total.toFixed(2)}`, { x: colX.total, y, size: 9, font: helveticaBold, color: black });
        }
        y -= 16;
      }
      y -= 4;
    }

    // ── Totals section ────────────────────────────
    y -= 10;
    page.drawRectangle({ x: 350, y: y - 60, width: width - 400, height: 75, color: rgb(0.98, 0.98, 0.98) });

    page.drawText('Zwischensumme:', { x: 360, y, size: 9, font: helvetica, color: gray });
    page.drawText(`${data.currency} ${data.subtotal.toFixed(2)}`, { x: 480, y, size: 9, font: helvetica, color: black });

    y -= 16;
    page.drawText(`MwSt (${data.vatRate}%):`, { x: 360, y, size: 9, font: helvetica, color: gray });
    page.drawText(`${data.currency} ${data.vatAmount.toFixed(2)}`, { x: 480, y, size: 9, font: helvetica, color: black });

    y -= 20;
    page.drawRectangle({ x: 350, y: y + 12, width: width - 400, height: 1, color: brandRed });
    page.drawText('Gesamtbetrag:', { x: 360, y, size: 11, font: helveticaBold, color: black });
    page.drawText(`${data.currency} ${data.total.toFixed(2)}`, { x: 475, y, size: 12, font: helveticaBold, color: brandRed });

    // ── Payment info ──────────────────────────────
    y -= 45;
    page.drawText('Zahlungsinformationen', { x: 50, y, size: 11, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });
    y -= 18;
    const paymentLines = [
      `Bitte überweisen Sie den Betrag bis zum ${data.dueDate.toLocaleDateString('de-CH')} auf folgendes Konto:`,
      `Kontoinhaber: ${this.company.name}`,
      'Zahlungsvermerk: ' + data.invoiceNumber,
    ];
    for (const line of paymentLines) {
      page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: gray });
      y -= 14;
    }

    // ── Notes ─────────────────────────────────────
    if (data.notes) {
      y -= 20;
      page.drawText('Bemerkungen:', { x: 50, y, size: 10, font: helveticaBold, color: gray });
      y -= 16;
      const noteLines = this.wrapText(data.notes, helvetica, 9, width - 120);
      for (const line of noteLines) {
        page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: gray });
        y -= 14;
      }
    }

    // ── Legal footer ──────────────────────────────
    const footerY = 35;
    page.drawRectangle({ x: 50, y: footerY + 8, width: width - 100, height: 1, color: rgb(0.9, 0.9, 0.9) });
    page.drawText(
      `${this.company.name} | ${this.company.address}, ${this.company.zip} ${this.company.city} | ${this.company.uid}`,
      { x: 50, y: footerY - 5, size: 7, font: helvetica, color: rgb(0.6, 0.6, 0.6) },
    );

    return pdfDoc.save();
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Utilities                                                   *
   * ──────────────────────────────────────────────────────────── */

  private drawLabelValue(
    page: PDFPage,
    label: string,
    value: string,
    x: number,
    y: number,
    font: PDFFont,
    boldFont: PDFFont,
  ) {
    page.drawText(label, { x, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: x + 90, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  }

  private wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(test, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}
