import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface BookingData {
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
  signatureData?: string | null;
  signedAt?: Date | null;
  notes?: string | null;
}

/**
 * Generates rental contract PDFs on-the-fly.
 * If a blank PDF template exists at templates/contract-template.pdf, it is used.
 * Otherwise, a clean PDF is generated from scratch.
 */
export class PdfGeneratorService {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'templates', 'contract-template.pdf');
  }

  async generateContract(booking: BookingData): Promise<Uint8Array> {
    let pdfDoc: PDFDocument;

    // Try loading a template; if none exists, create from scratch
    try {
      const templateBytes = await fs.readFile(this.templatePath);
      pdfDoc = await PDFDocument.load(templateBytes);
    } catch {
      pdfDoc = await PDFDocument.create();
    }

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const brandRed = rgb(0.65, 0.055, 0.055); // #A60E0E
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.93, 0.93, 0.93);

    // ─── Page 1: Contract details ─────────────────────────
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 60;

    // Header
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.97, 0.97, 0.97) });
    page.drawText('HOPPDRIVE', { x: 50, y: height - 50, size: 24, font: helveticaBold, color: brandRed });
    page.drawText('Mietvertrag / Rental Agreement', { x: 50, y: height - 70, size: 10, font: helvetica, color: gray });

    // Contract reference
    y = height - 110;
    page.drawText(`Vertragsnr.: ${booking.id.substring(0, 8).toUpperCase()}`, {
      x: 50, y, size: 9, font: helvetica, color: gray,
    });
    page.drawText(`Datum: ${new Date().toLocaleDateString('de-CH')}`, {
      x: 380, y, size: 9, font: helvetica, color: gray,
    });

    // Section: Customer Data
    y -= 35;
    page.drawText('Kundendaten', { x: 50, y, size: 13, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    this.drawLabelValue(page, 'Name:', booking.customerName, 50, y, helvetica, helveticaBold);
    y -= 20;
    if (booking.customerEmail) {
      this.drawLabelValue(page, 'E-Mail:', booking.customerEmail, 50, y, helvetica, helveticaBold);
      y -= 20;
    }

    // Section: Vehicle
    y -= 15;
    page.drawText('Fahrzeug', { x: 50, y, size: 13, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    this.drawLabelValue(page, 'Fahrzeug:', `${booking.vehicleBrand} ${booking.vehicleModel}`, 50, y, helvetica, helveticaBold);
    y -= 20;
    if (booking.licensePlate) {
      this.drawLabelValue(page, 'Kennzeichen:', booking.licensePlate, 50, y, helvetica, helveticaBold);
      y -= 20;
    }

    // Section: Rental Period
    y -= 15;
    page.drawText('Mietdauer', { x: 50, y, size: 13, font: helveticaBold, color: black });
    y -= 5;
    page.drawRectangle({ x: 50, y, width: width - 100, height: 1, color: brandRed });

    y -= 22;
    const startStr = booking.startDate.toLocaleDateString('de-CH');
    const endStr = booking.endDate.toLocaleDateString('de-CH');
    const days = Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24));
    this.drawLabelValue(page, 'Von:', startStr, 50, y, helvetica, helveticaBold);
    this.drawLabelValue(page, 'Bis:', endStr, 300, y, helvetica, helveticaBold);
    y -= 20;
    this.drawLabelValue(page, 'Tage:', `${days}`, 50, y, helvetica, helveticaBold);

    // Section: Pricing
    y -= 35;
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 35, color: lightGray });
    page.drawText('Gesamtpreis:', { x: 60, y: y + 5, size: 12, font: helveticaBold, color: black });
    page.drawText(`${booking.currency} ${booking.totalPrice.toFixed(2)}`, {
      x: 380, y: y + 5, size: 14, font: helveticaBold, color: brandRed,
    });

    // Notes
    if (booking.notes) {
      y -= 50;
      page.drawText('Bemerkungen:', { x: 50, y, size: 10, font: helveticaBold, color: gray });
      y -= 16;
      // Wrap notes text
      const noteLines = this.wrapText(booking.notes, helvetica, 9, width - 120);
      for (const line of noteLines) {
        page.drawText(line, { x: 50, y, size: 9, font: helvetica, color: gray });
        y -= 14;
      }
    }

    // Terms placeholder
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

    // ─── Signature area ────────────────────────────────────
    y -= 30;
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 25;

    // Two columns: Vermieter (left) and Mieter (right)
    page.drawText('Vermieter', { x: 50, y, size: 10, font: helveticaBold, color: black });
    page.drawText('Mieter', { x: 340, y, size: 10, font: helveticaBold, color: black });

    y -= 16;
    page.drawText('Euro-Abschleppservice GmbH', { x: 50, y, size: 9, font: helvetica, color: gray });

    if (booking.signatureData) {
      try {
        const base64Data = booking.signatureData.replace(/^data:image\/png;base64,/, '');
        const signatureImage = await pdfDoc.embedPng(Buffer.from(base64Data, 'base64'));
        const sigDims = signatureImage.scale(0.4);
        const maxW = 180;
        const maxH = 60;
        const scale = Math.min(maxW / sigDims.width, maxH / sigDims.height, 1);

        page.drawImage(signatureImage, {
          x: 340,
          y: y - 55,
          width: sigDims.width * scale,
          height: sigDims.height * scale,
        });
      } catch (err) {
        console.error('[PdfGenerator] Failed to embed signature image:', err);
      }
    }

    y -= 70;
    page.drawRectangle({ x: 50, y, width: 180, height: 1, color: rgb(0.7, 0.7, 0.7) });
    page.drawRectangle({ x: 340, y, width: 180, height: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;
    if (booking.signedAt) {
      const signedDate = booking.signedAt.toLocaleDateString('de-CH');
      const signedTime = booking.signedAt.toLocaleTimeString('de-CH');
      page.drawText(
        `Signiert am: ${signedDate} um ${signedTime}`,
        { x: 50, y, size: 8, font: helvetica, color: gray },
      );
      page.drawText(
        `Signiert am: ${signedDate} um ${signedTime}`,
        { x: 340, y, size: 8, font: helvetica, color: gray },
      );
    } else {
      page.drawText('Datum / Unterschrift', { x: 50, y, size: 8, font: helvetica, color: gray });
      page.drawText('Datum / Unterschrift', { x: 340, y, size: 8, font: helvetica, color: gray });
    }

    // Footer
    page.drawText(
      'HoppDrive – Euro-Abschleppservice GmbH | hoppdrive.ch',
      { x: 50, y: 30, size: 7, font: helvetica, color: rgb(0.6, 0.6, 0.6) },
    );

    return await pdfDoc.save();
  }

  private drawLabelValue(
    page: any,
    label: string,
    value: string,
    x: number,
    y: number,
    font: any,
    boldFont: any,
  ) {
    page.drawText(label, { x, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: x + 90, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  }

  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
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
