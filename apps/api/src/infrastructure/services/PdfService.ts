import path from 'path';
import fs from 'fs/promises';
import { PDFDocument, rgb, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { CONTRACT_CLAUSES, renderClause } from './contractTemplate';
import type { CompanyInfo } from './SettingsService';
import type { PrivateStorageService } from './PrivateStorageService';
import { formatReference } from 'swissqrbill/utils';
import { fmtAmount, fmtDate, fmtDateMaybeTime, fmtDateTime, fmtMoney, hasTimeOfDay, rentalDays } from '../format';

// Static fallback checked into the repo (apps/api/assets/legal/agb.pdf). An uploaded AGB in the private
// storage (key "legal/agb.pdf") takes precedence.
const AGB_PDF_PATH = path.join(__dirname, '../../../assets/legal/agb.pdf');
const AGB_STORAGE_KEY = 'legal/agb.pdf';
const FONT_DIR = path.join(__dirname, '../../../assets/fonts');
/** Horizontal logo (car + wordmark), 1600 x 197 px PNG with transparency. */
const LOGO_PATH = path.join(__dirname, '../../../assets/brand/logo-horizontal.png');

/* ================================================================
 * Colours (shared by all generated documents)
 * ================================================================ */

export const PDF_COLORS = {
  brandRed: rgb(0.65, 0.055, 0.055),
  black: rgb(0, 0, 0),
  gray: rgb(0.4, 0.4, 0.4),
  lightGray: rgb(0.93, 0.93, 0.93),
  rule: rgb(0.8, 0.8, 0.8),
  muted: rgb(0.6, 0.6, 0.6),
};

/** A document with the Unicode fonts registered (Fira Sans Regular + Bold). */
export interface PdfKit {
  pdfDoc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
}

/* ================================================================
 * Contract data
 * ================================================================ */

export interface ContractData {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  /** One line per entry, e.g. ["Bahnhofstrasse 1", "8001 Zürich", "Schweiz"]. */
  driverAddressLines?: string[];
  driverBirthDate?: Date | null;
  driverLicenseNumber?: string | null;
  driverLicenseCountry?: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate?: string | null;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  /** Discount that is already deducted from totalPrice. */
  discountAmount?: number;
  currency: string;
  signatureData?: string | null; // customer signature (PNG data URL)
  signedAt?: Date | null;
  notes?: string | null;
  locationName?: string | null;
  /** Lines of the open vehicle damages at contract time ("1. Kratzer – Tür vorne links (leicht)"), printed as "Bestehende Schäden". */
  existingDamages?: string[];
}

export interface ContractOptions {
  /** The company (renter) details printed on the contract. Required: nothing is kept in the service. */
  company: CompanyInfo;
  /** PNG data URL of the signature of the admin who signs for the company. Per call, never stored. */
  companySignatureData?: string | null;
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
  /** Default / dominant VAT rate, e.g. 8.1 for 8.1 %. Used for the legacy single-rate totals. */
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  notes?: string | null;
  bookingRef?: string | null; // shortened booking id for reference
  /** Document title, default "Rechnung / Invoice". */
  title?: string;
  /**
   * VAT per rate for invoices with line items (items may carry their own rate). When absent the totals are
   * rendered the legacy way with the single vatRate (old invoices without saved items).
   */
  vatBreakdown?: { rate: number; base: number; amount: number }[];
  /** Print the VAT rate of every line (invoices with line items). */
  showVatColumn?: boolean;
  /**
   * Swiss QR bill: the A4 page rendered by QrBillService (payment part at the bottom). It is placed on the last page
   * when there is room for it, else on an extra page.
   */
  qrPage?: Uint8Array | null;
  /** QR reference (QRR / SCOR), printed next to the payment information. */
  qrReference?: string | null;
  /** Reminder fee (Mahngebühr) that is part of `total` but not of `subtotal` / VAT: printed as its own totals row. */
  penalty?: number;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** VAT rate of this line in percent (only used with showVatColumn). */
  vatRate?: number | null;
}

export interface InvoiceOptions {
  company: CompanyInfo;
}

/* ================================================================
 * PDF Service
 * ================================================================ */

/**
 * Generates the PDFs. The service holds NO per-request state: company details and signatures are
 * passed with every call (so one admin's signature can never end up on another admin's document).
 *
 * All text is set in Fira Sans (embedded through @pdf-lib/fontkit), which covers the full Latin range
 * including Croatian č ć đ š ž / Š, so names and addresses print correctly.
 */
export class PdfService {
  private fontBytes: { regular: Uint8Array; bold: Uint8Array } | null = null;
  private logoBytes: Uint8Array | null | undefined;

  constructor(private privateStorage?: PrivateStorageService) {}

  /* ──────────────────────────────────────────────────────────── *
   *  Building blocks (also used by the damage report / QR bill)  *
   * ──────────────────────────────────────────────────────────── */

  /** Creates an empty document with the Unicode fonts embedded. */
  async createDocument(): Promise<PdfKit> {
    const pdfDoc = await PDFDocument.create();
    return this.attachFonts(pdfDoc);
  }

  /** Registers fontkit and embeds Fira Sans on an existing document (e.g. one that was loaded). */
  async attachFonts(pdfDoc: PDFDocument): Promise<PdfKit> {
    pdfDoc.registerFontkit(fontkit);
    if (!this.fontBytes) {
      const [regular, bold] = await Promise.all([
        fs.readFile(path.join(FONT_DIR, 'FiraSans-Regular.ttf')),
        fs.readFile(path.join(FONT_DIR, 'FiraSans-Bold.ttf')),
      ]);
      this.fontBytes = { regular, bold };
    }
    const [regular, bold] = await Promise.all([
      pdfDoc.embedFont(this.fontBytes.regular, { subset: true }),
      pdfDoc.embedFont(this.fontBytes.bold, { subset: true }),
    ]);
    return { pdfDoc, regular, bold };
  }

  /**
   * Embeds the HoppDrive logo (horizontal: car + wordmark) into the document. Embed once per document and reuse the
   * result for every header. Returns null (and logs once) when the file is missing, drawLogo then falls back to text.
   */
  async embedLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
    if (this.logoBytes === undefined) {
      try {
        this.logoBytes = await fs.readFile(LOGO_PATH);
      } catch (err) {
        console.error('[PdfService] Logo not found, headers fall back to text:', err);
        this.logoBytes = null;
      }
    }
    return this.logoBytes ? pdfDoc.embedPng(this.logoBytes) : null;
  }

  /**
   * Draws the logo with its bottom-left corner at (x, y), `width` points wide, aspect ratio kept. Without a logo image
   * the word "HOPPDRIVE" is set in `fallbackFont` instead. Returns the height that was drawn.
   * (Only for page headers: the Swiss QR payment part stays logo-free.)
   */
  drawLogo(page: PDFPage, logo: PDFImage | null, box: { x: number; y: number; width: number }, fallbackFont?: PDFFont): number {
    if (logo) {
      const height = (logo.height / logo.width) * box.width;
      page.drawImage(logo, { x: box.x, y: box.y, width: box.width, height });
      return height;
    }
    if (fallbackFont) {
      page.drawText('HOPPDRIVE', { x: box.x, y: box.y, size: box.width / 7, font: fallbackFont, color: PDF_COLORS.brandRed });
    }
    return box.width / 7;
  }

  /** Raw bytes of the current AGB (uploaded version if present, else the bundled file). */
  async loadAgbBytes(): Promise<Uint8Array> {
    if (this.privateStorage) {
      try {
        return await this.privateStorage.read(AGB_STORAGE_KEY);
      } catch {
        /* no upload: use the bundled file */
      }
    }
    return fs.readFile(AGB_PDF_PATH);
  }

  /** Appends all pages of the AGB to `pdfDoc`. Logs and carries on when the AGB cannot be read. */
  async appendAgb(pdfDoc: PDFDocument): Promise<void> {
    try {
      const agbDoc = await PDFDocument.load(await this.loadAgbBytes());
      const agbPages = await pdfDoc.copyPages(agbDoc, agbDoc.getPageIndices());
      agbPages.forEach((p) => pdfDoc.addPage(p));
    } catch (err) {
      console.error('[PdfService] Failed to attach AGB:', err);
    }
  }

  /** Embeds a PNG / JPG data URL. Returns null (and logs) for anything that is not a valid image. */
  async embedImageDataUrl(pdfDoc: PDFDocument, dataUrl: string | null | undefined) {
    if (!dataUrl) return null;
    try {
      const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
      if (!match) return null;
      // Decode and re-encode with sharp first: it rejects corrupt data quickly, whereas pdf-lib's own
      // PNG decoder can spin indefinitely on malformed input (seen with a broken stored signature).
      const bytes = await sharp(Buffer.from(match[2], 'base64'), { limitInputPixels: 25_000_000 })
        .png()
        .toBuffer();
      return await pdfDoc.embedPng(bytes);
    } catch (err) {
      console.error('[PdfService] Failed to embed image:', err);
      return null;
    }
  }

  /**
   * Draws a signature image scaled to fit inside the box, aligned to the bottom-left.
   * Returns false when there was nothing (valid) to draw.
   */
  async drawSignature(
    pdfDoc: PDFDocument,
    page: PDFPage,
    dataUrl: string | null | undefined,
    box: { x: number; y: number; width: number; height: number },
  ): Promise<boolean> {
    const image = await this.embedImageDataUrl(pdfDoc, dataUrl);
    if (!image) return false;
    const scale = Math.min(box.width / image.width, box.height / image.height, 1);
    page.drawImage(image, { x: box.x, y: box.y, width: image.width * scale, height: image.height * scale });
    return true;
  }

  /* ──────────────────────────────────────────────────────────── *
   *  CONTRACT PDF                                                *
   * ──────────────────────────────────────────────────────────── */

  async generateContract(data: ContractData, options: ContractOptions): Promise<Uint8Array> {
    const { company, companySignatureData } = options;
    const { pdfDoc, regular, bold } = await this.createDocument();
    const { brandRed, black, gray, lightGray } = PDF_COLORS;

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 60;

    // ── Header ────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.97, 0.97, 0.97) });
    this.drawLogo(page, await this.embedLogo(pdfDoc), { x: 50, y: height - 52, width: 160 }, bold);
    page.drawText('Mietvertrag / Rental Agreement', { x: 50, y: height - 70, size: 10, font: regular, color: gray });

    // ── Contract ref & date ───────────────────────
    y = height - 110;
    page.drawText(`Vertragsnr.: ${data.id.substring(0, 8).toUpperCase()}`, {
      x: 50, y, size: 9, font: regular, color: gray,
    });
    page.drawText(`Datum: ${fmtDate(data.signedAt ?? new Date())}`, {
      x: 380, y, size: 9, font: regular, color: gray,
    });

    // ── Parties ───────────────────────────────────
    y -= 35;
    page.drawText('Vertragsparteien', { x: 50, y, size: 13, font: bold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    // Left column – company
    y -= 22;
    const partiesTop = y;
    page.drawText('Vermieter:', { x: 50, y, size: 10, font: bold, color: gray });
    y -= 16;
    page.drawText(company.name, { x: 50, y, size: 10, font: bold, color: black });
    y -= 14;
    page.drawText(`${company.street}, ${company.zip} ${company.city}`, { x: 50, y, size: 9, font: regular, color: gray });
    y -= 14;
    page.drawText(`Tel: ${company.phone} | ${company.email}`, { x: 50, y, size: 9, font: regular, color: gray });
    if (company.uid) {
      y -= 14;
      page.drawText(company.uid, { x: 50, y, size: 9, font: regular, color: gray });
    }

    // Right column – customer / driver
    let cY = partiesTop;
    page.drawText('Mieter:', { x: 320, y: cY, size: 10, font: bold, color: gray });
    cY -= 16;
    page.drawText(data.customerName, { x: 320, y: cY, size: 10, font: bold, color: black });
    const customerLines = [
      ...(data.driverAddressLines ?? []),
      data.customerEmail ?? '',
      data.customerPhone ? `Tel: ${data.customerPhone}` : '',
      data.driverBirthDate ? `Geburtsdatum: ${fmtDate(data.driverBirthDate)}` : '',
      data.driverLicenseNumber
        ? `Führerausweis: ${data.driverLicenseNumber}${data.driverLicenseCountry ? ` (${data.driverLicenseCountry})` : ''}`
        : '',
    ].filter(Boolean);
    for (const line of customerLines) {
      cY -= 13;
      page.drawText(line, { x: 320, y: cY, size: 9, font: regular, color: gray });
    }
    y = Math.min(y, cY);

    // ── Vehicle section ───────────────────────────
    y -= 30;
    page.drawText('Fahrzeug', { x: 50, y, size: 13, font: bold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    this.drawLabelValue(page, 'Fahrzeug:', `${data.vehicleBrand} ${data.vehicleModel}`, 50, y, regular, bold);
    y -= 20;
    if (data.licensePlate) {
      this.drawLabelValue(page, 'Kennzeichen:', data.licensePlate, 50, y, regular, bold);
      y -= 20;
    }
    if (data.locationName) {
      this.drawLabelValue(page, 'Standort:', data.locationName, 50, y, regular, bold);
      y -= 20;
    }

    // ── Rental period ─────────────────────────────
    y -= 15;
    page.drawText('Mietdauer', { x: 50, y, size: 13, font: bold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    this.drawLabelValue(page, 'Übergabe:', fmtDateMaybeTime(data.startDate), 50, y, regular, bold);
    this.drawLabelValue(page, 'Rückgabe:', fmtDateMaybeTime(data.endDate), 300, y, regular, bold);
    y -= 20;
    this.drawLabelValue(page, 'Tage:', `${rentalDays(data.startDate, data.endDate)}`, 50, y, regular, bold);

    // ── Pricing ───────────────────────────────────
    const discount = data.discountAmount && data.discountAmount > 0 ? data.discountAmount : 0;
    y -= discount ? 52 : 35;
    const priceBoxHeight = discount ? 52 : 35;
    page.drawRectangle({ x: 50, y: y + 30 - priceBoxHeight, width: width - 100, height: priceBoxHeight, color: lightGray });
    let priceY = y + 5;
    if (discount) {
      page.drawText('Rabatt:', { x: 60, y: priceY + 14, size: 10, font: regular, color: gray });
      page.drawText(`- ${fmtMoney(discount, data.currency)}`, { x: 380, y: priceY + 14, size: 10, font: regular, color: gray });
      priceY -= 4;
    }
    page.drawText('Gesamtpreis:', { x: 60, y: priceY, size: 12, font: bold, color: black });
    page.drawText(fmtMoney(data.totalPrice, data.currency), {
      x: 380, y: priceY, size: 14, font: bold, color: brandRed,
    });

    // ── Notes ─────────────────────────────────────
    if (data.notes) {
      y -= 50;
      page.drawText('Bemerkungen:', { x: 50, y, size: 10, font: bold, color: gray });
      y -= 16;
      for (const line of this.wrapText(data.notes, regular, 9, width - 120)) {
        page.drawText(line, { x: 50, y, size: 9, font: regular, color: gray });
        y -= 14;
      }
    }

    // ── Existing damages (known at contract time) ──
    if (data.existingDamages) {
      y -= 30;
      if (y < 160) {
        page = pdfDoc.addPage([width, height]);
        y = height - 60;
      }
      page.drawText('Bestehende Schäden', { x: 50, y, size: 11, font: bold, color: black });
      y -= 5;
      page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });
      y -= 18;
      const damageLines = data.existingDamages.length > 0 ? data.existingDamages : ['Keine bekannten Schäden.'];
      for (const line of damageLines.flatMap((l) => this.wrapText(l, regular, 9, width - 110))) {
        if (y < 110) {
          page = pdfDoc.addPage([width, height]);
          y = height - 60;
        }
        page.drawText(line, { x: 55, y, size: 9, font: regular, color: gray });
        y -= 13;
      }
    }

    // ── Terms (structured, editable clause data — see contractTemplate.ts) ──
    y -= 30;
    // Keep the heading together with its first clause (220 = space reserved for the signature block below).
    if (y < 220 + 70) {
      page = pdfDoc.addPage([width, height]);
      y = height - 60;
    }
    page.drawText('Allgemeine Mietbedingungen', { x: 50, y, size: 11, font: bold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });
    y -= 18;

    const MIN_Y = 220; // leaves room for the signature block below
    for (const clause of CONTRACT_CLAUSES) {
      const body = renderClause(clause.body, { companyName: company.name });
      const bodyLines = this.wrapText(body, regular, 8, width - 120);

      if (y - (14 + bodyLines.length * 12) < MIN_Y) {
        page = pdfDoc.addPage([width, height]);
        y = height - 60;
      }

      page.drawText(clause.heading, { x: 50, y, size: 9, font: bold, color: black });
      y -= 12;
      for (const line of bodyLines) {
        page.drawText(line, { x: 55, y, size: 8, font: regular, color: gray });
        y -= 12;
      }
      y -= 6;
    }

    // ── Signatures ────────────────────────────────
    y -= 30;
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 1, color: PDF_COLORS.rule });
    y -= 25;

    page.drawText('Vermieter', { x: 50, y, size: 10, font: bold, color: black });
    page.drawText('Mieter', { x: 340, y, size: 10, font: bold, color: black });

    y -= 16;
    page.drawText(company.name, { x: 50, y, size: 9, font: regular, color: gray });

    // Company signature (the signing admin's stored signature, passed in for THIS contract only)
    await this.drawSignature(pdfDoc, page, companySignatureData, { x: 50, y: y - 55, width: 180, height: 60 });
    // Customer signature
    await this.drawSignature(pdfDoc, page, data.signatureData, { x: 340, y: y - 55, width: 180, height: 60 });

    y -= 70;
    page.drawRectangle({ x: 50, y, width: 180, height: 1, color: rgb(0.7, 0.7, 0.7) });
    page.drawRectangle({ x: 340, y, width: 180, height: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;

    if (data.signedAt) {
      const stamp = `Signiert am: ${fmtDateTime(data.signedAt).replace(', ', ' um ')}`;
      page.drawText(companySignatureData ? stamp : 'Datum / Unterschrift', { x: 50, y, size: 8, font: regular, color: gray });
      page.drawText(stamp, { x: 340, y, size: 8, font: regular, color: gray });
    } else {
      page.drawText('Datum / Unterschrift', { x: 50, y, size: 8, font: regular, color: gray });
      page.drawText('Datum / Unterschrift', { x: 340, y, size: 8, font: regular, color: gray });
    }

    // ── Footer ────────────────────────────────────
    page.drawText(`HoppDrive – ${company.name} | hoppdrive.ch`, {
      x: 50, y: 30, size: 7, font: regular, color: PDF_COLORS.muted,
    });

    // ── Attach the real AGB as trailing pages ──────
    await this.appendAgb(pdfDoc);

    return pdfDoc.save();
  }

  /* ──────────────────────────────────────────────────────────── *
   *  INVOICE PDF (Swiss-compliant)                               *
   * ──────────────────────────────────────────────────────────── */

  async generateInvoice(data: InvoiceData, options: InvoiceOptions): Promise<Uint8Array> {
    const { company } = options;
    const { pdfDoc, regular, bold } = await this.createDocument();
    const { brandRed, black, gray, lightGray } = PDF_COLORS;

    const W = 595.28;
    const H = 841.89;
    const M = 50;
    const RIGHT = W - M;
    /** Height of the QR payment part (105 mm). */
    const SLIP_H = 297.64;
    const showVat = !!data.showVatColumn;
    const hasQr = !!data.qrPage;
    const title = data.title ?? 'Rechnung / Invoice';
    const money = (n: number) => fmtMoney(n, data.currency);

    // Column layout: description is left aligned, the numbers are right aligned at the given x.
    const col = showVat
      ? { descW: 232, qty: 330, unit: 398, vat: 452, total: RIGHT }
      : { descW: 270, qty: 382, unit: 462, vat: 0, total: RIGHT };

    const logo = await this.embedLogo(pdfDoc);
    const pages: PDFPage[] = [];
    const rightText = (page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color = black) => {
      page.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y, size, font, color });
    };
    const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, ''));

    /** Adds a page: the first one carries the full header, the following ones a slim continuation header. */
    const startPage = (): { page: PDFPage; y: number } => {
      const page = pdfDoc.addPage([W, H]);
      pages.push(page);
      if (pages.length === 1) {
        page.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: rgb(0.97, 0.97, 0.97) });
        this.drawLogo(page, logo, { x: M, y: H - 52, width: 160 }, bold);
        page.drawText(title, { x: M, y: H - 70, size: 10, font: regular, color: gray });
        return { page, y: H - 110 };
      }
      page.drawRectangle({ x: 0, y: H - 46, width: W, height: 46, color: rgb(0.97, 0.97, 0.97) });
      this.drawLogo(page, logo, { x: M, y: H - 29, width: 100 }, bold);
      page.drawText(`Rechnung Nr. ${data.invoiceNumber} (Fortsetzung)`, { x: 170, y: H - 30, size: 9, font: regular, color: gray });
      return { page, y: H - 80 };
    };

    const drawTableHeader = (page: PDFPage, y: number): number => {
      page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: lightGray });
      page.drawText('Beschreibung', { x: M + 4, y, size: 9, font: bold, color: black });
      rightText(page, 'Menge', col.qty, y, 9, bold);
      rightText(page, 'Preis', col.unit, y, 9, bold);
      if (showVat) rightText(page, 'MwSt', col.vat, y, 9, bold);
      rightText(page, 'Total', col.total - 4, y, 9, bold);
      return y - 24;
    };

    // ── First page: header, company block, meta, recipient ──
    let { page, y } = startPage();

    const companyLines = [
      company.name,
      company.street,
      `${company.zip} ${company.city}`,
      company.phone ? `Tel: ${company.phone}` : '',
      company.email,
      company.uid,
    ].filter(Boolean);
    let cy = H - 100;
    for (const line of companyLines) {
      page.drawText(line, { x: 380, y: cy, size: 8, font: regular, color: gray });
      cy -= 12;
    }

    page.drawText(`Rechnung Nr.: ${data.invoiceNumber}`, { x: M, y, size: 10, font: bold, color: black });
    y -= 18;
    page.drawText(`Rechnungsdatum: ${fmtDate(data.issueDate)}`, { x: M, y, size: 9, font: regular, color: gray });
    y -= 14;
    page.drawText(`Fälligkeitsdatum: ${fmtDate(data.dueDate)}`, { x: M, y, size: 9, font: regular, color: gray });
    if (data.bookingRef) {
      y -= 14;
      page.drawText(`Buchungsreferenz: ${data.bookingRef}`, { x: M, y, size: 9, font: regular, color: gray });
    }

    y -= 30;
    page.drawText('Rechnungsempfänger:', { x: M, y, size: 10, font: bold, color: gray });
    y -= 18;
    page.drawText(data.customerName, { x: M, y, size: 10, font: bold, color: black });
    y -= 14;
    if (data.customerAddress) {
      for (const line of data.customerAddress.split('\n')) {
        page.drawText(line, { x: M, y, size: 9, font: regular, color: gray });
        y -= 14;
      }
    }
    if (data.customerEmail) {
      page.drawText(data.customerEmail, { x: M, y, size: 9, font: regular, color: gray });
      y -= 14;
    }

    // ── Line items (multi-page) ──
    y -= 22;
    y = drawTableHeader(page, y);
    for (const item of data.items) {
      const lines = this.wrapText(item.description, regular, 9, col.descW);
      const rowH = lines.length * 12 + 8;
      if (y - rowH < 90) {
        ({ page, y } = startPage());
        y = drawTableHeader(page, y);
      }
      lines.forEach((line, i) => {
        page.drawText(line, { x: M + 4, y: y - 12 * i, size: 9, font: regular, color: black });
      });
      rightText(page, fmtQty(item.quantity), col.qty, y, 9, regular);
      rightText(page, fmtAmount(item.unitPrice), col.unit, y, 9, regular);
      if (showVat) {
        const rate = item.vatRate ?? data.vatRate;
        rightText(page, `${Number(rate)} %`, col.vat, y, 9, regular, gray);
      }
      rightText(page, fmtAmount(item.total), col.total - 4, y, 9, bold);
      page.drawRectangle({ x: M, y: y - (lines.length - 1) * 12 - 6, width: W - 2 * M, height: 0.7, color: rgb(0.88, 0.88, 0.88) });
      y -= rowH;
    }

    // ── Totals ──
    const vatRows = data.vatBreakdown && data.vatBreakdown.length > 0
      ? data.vatBreakdown.map((g) => ({ label: `MwSt ${Number(g.rate)} % auf ${fmtAmount(g.base)}`, amount: g.amount }))
      : [{ label: `MwSt (${data.vatRate}%)`, amount: data.vatAmount }];
    if (data.penalty && data.penalty > 0) vatRows.push({ label: 'Mahngebühr (Verzug)', amount: data.penalty });
    const totalsH = 16 + vatRows.length * 15 + 34;
    if (y - totalsH < 90) ({ page, y } = startPage());
    y -= 16;
    page.drawRectangle({ x: 330, y: y - vatRows.length * 15 - 36, width: RIGHT - 330, height: totalsH, color: rgb(0.98, 0.98, 0.98) });
    page.drawText('Zwischensumme:', { x: 340, y, size: 9, font: regular, color: gray });
    rightText(page, money(data.subtotal), RIGHT - 10, y, 9, regular);
    for (const row of vatRows) {
      y -= 15;
      page.drawText(row.label, { x: 340, y, size: 9, font: regular, color: gray });
      rightText(page, money(row.amount), RIGHT - 10, y, 9, regular);
    }
    y -= 22;
    page.drawRectangle({ x: 330, y: y + 14, width: RIGHT - 330, height: 1, color: brandRed });
    page.drawText('Gesamtbetrag:', { x: 340, y, size: 11, font: bold, color: black });
    rightText(page, money(data.total), RIGHT - 10, y, 11, bold, brandRed);
    y -= 34;

    // ── Payment information ──
    if (hasQr) {
      // The payment part carries everything the payer needs: one line is enough.
      const line = `Zahlbar bis ${fmtDate(data.dueDate)} mit dem Einzahlungsschein (QR-Rechnung)${data.qrReference ? `, Referenz ${formatReference(data.qrReference)}` : ''}.`;
      const lines = this.wrapText(line, regular, 9, W - 2 * M);
      if (y - lines.length * 14 < 90) ({ page, y } = startPage());
      for (const l of lines) {
        page.drawText(l, { x: M, y, size: 9, font: regular, color: gray });
        y -= 14;
      }
    } else {
      const paymentLines: string[] = [
        `Bitte überweisen Sie den Betrag bis zum ${fmtDate(data.dueDate)} auf folgendes Konto:`,
        `Kontoinhaber: ${company.name}`,
      ];
      if (company.bankName) paymentLines.push(`Bank: ${company.bankName}`);
      if (company.iban) paymentLines.push(`IBAN: ${company.iban}`);
      paymentLines.push(`Zahlungsvermerk: ${data.invoiceNumber}`);
      const paymentH = 28 + paymentLines.length * 14;
      if (y - paymentH < 90) ({ page, y } = startPage());
      page.drawText('Zahlungsinformationen', { x: M, y, size: 11, font: bold, color: black });
      y -= 5;
      page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1, color: brandRed });
      y -= 18;
      for (const line of paymentLines.flatMap((l) => this.wrapText(l, regular, 9, W - 2 * M))) {
        page.drawText(line, { x: M, y, size: 9, font: regular, color: gray });
        y -= 14;
      }
    }

    // ── Notes ──
    if (data.notes) {
      const noteLines = this.wrapText(data.notes, regular, 9, W - 2 * M);
      if (y - (36 + noteLines.length * 14) < 90) ({ page, y } = startPage());
      y -= 16;
      page.drawText('Bemerkungen:', { x: M, y, size: 10, font: bold, color: gray });
      y -= 16;
      for (const line of noteLines) {
        if (y < 90) ({ page, y } = startPage());
        page.drawText(line, { x: M, y, size: 9, font: regular, color: gray });
        y -= 14;
      }
    }

    // ── Swiss QR bill: on the last page when it fits below the content, else on an extra page ──
    let slipPage: PDFPage | null = null;
    if (hasQr) {
      const qrDoc = await PDFDocument.load(data.qrPage!);
      const [slip] = await pdfDoc.embedPdf(qrDoc, [0]);
      if (y - 10 >= SLIP_H + 6) {
        slipPage = page;
      } else {
        slipPage = pdfDoc.addPage([W, H]);
        slipPage.drawText(`Zahlteil zur Rechnung Nr. ${data.invoiceNumber}`, { x: M, y: H - 60, size: 11, font: bold, color: black });
        slipPage.drawText(`Betrag: ${money(data.total)}, zahlbar bis ${fmtDate(data.dueDate)}`, { x: M, y: H - 78, size: 9, font: regular, color: gray });
      }
      slipPage.drawPage(slip, { x: 0, y: 0, width: W, height: H });
    }

    // ── Page numbers + legal footer (not on the page that carries the slip) ──
    const legal = [company.name, `${company.street}, ${company.zip} ${company.city}`, company.uid].filter(Boolean).join(' | ');
    pages.forEach((p, i) => {
      if (pages.length > 1) rightText(p, `Seite ${i + 1} / ${pages.length}`, RIGHT, H - 30, 8, regular, gray);
      if (p === slipPage) return;
      p.drawRectangle({ x: M, y: 43, width: W - 2 * M, height: 0.7, color: rgb(0.9, 0.9, 0.9) });
      p.drawText(legal, { x: M, y: 30, size: 7, font: regular, color: PDF_COLORS.muted });
    });

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
    page.drawText(label, { x, y, size: 10, font, color: PDF_COLORS.gray });
    page.drawText(value, { x: x + 90, y, size: 10, font: boldFont, color: PDF_COLORS.black });
  }

  /**
   * Greedy word wrap that honours explicit line breaks and splits words longer than the line.
   * Control characters are dropped (the font has no glyph for them).
   */
  wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\t/g, ' ');
    const lines: string[] = [];
    for (const paragraph of clean.split(/\r?\n/)) {
      let current = '';
      for (const rawWord of paragraph.split(' ')) {
        let word = rawWord;
        // Break words that are wider than a whole line
        while (word && font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          let cut = word.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), fontSize) > maxWidth) cut--;
          if (current) {
            lines.push(current);
            current = '';
          }
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        const test = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(test, fontSize) > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  /** Re-exported so callers can decide whether a booking time is a real time or a legacy whole day. */
  static hasTimeOfDay = hasTimeOfDay;
}
