import { PDFPage, rgb } from 'pdf-lib';
import { formatLicensePlate } from '../../domain/services/LicensePlate';
import { fmtDate, fmtDateMaybeTime, fmtMoney } from '../format';
import { PDF_COLORS, type PdfService } from './PdfService';
import type { CompanyInfo } from './SettingsService';

export interface DriverExportInput {
  company: CompanyInfo;
  fine: {
    reference: string;
    authority: string;
    occurredAt: Date;
    place: string;
    licensePlate: string;
    amount: number;
    currency: string;
    description: string;
  };
  vehicle: { brand: string; model: string } | null;
  booking: {
    id: string;
    customerName: string;
    customerPhone: string | null;
    driverStreet: string | null;
    driverZip: string | null;
    driverCity: string | null;
    driverCountry: string | null;
    driverBirthDate: Date | null;
    driverLicenseNumber: string | null;
    driverLicenseCountry: string | null;
    startDate: Date;
    endDate: Date;
  };
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 50;

/** "Fahrerangaben" for the authority: who rented the vehicle when the fine was issued. */
export class FineDocumentService {
  constructor(private pdf: PdfService) {}

  async generateDriverExport(input: DriverExportInput): Promise<Uint8Array> {
    const { pdfDoc, regular, bold } = await this.pdf.createDocument();
    const { brandRed, black, gray } = PDF_COLORS;
    const { company, fine, booking } = input;
    const page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const RIGHT = PAGE_W - M;

    page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 76, color: rgb(0.97, 0.97, 0.97) });
    this.pdf.drawLogo(page, await this.pdf.embedLogo(pdfDoc), { x: M, y: PAGE_H - 48, width: 160 }, bold);
    page.drawText('Fahrerangaben / Halterauskunft', { x: M, y: PAGE_H - 64, size: 10, font: regular, color: gray });
    [company.name, `${company.street}, ${company.zip} ${company.city}`, company.phone, company.email, company.uid]
      .filter(Boolean)
      .forEach((line, i) => {
        const w = regular.widthOfTextAtSize(line, 7.5);
        page.drawText(line, { x: RIGHT - w, y: PAGE_H - 24 - i * 11, size: 7.5, font: regular, color: gray });
      });

    let y = PAGE_H - 108;
    const text = (value: string, size = 10, font = regular, color = black) => {
      for (const line of this.pdf.wrapText(value, font, size, RIGHT - M)) {
        page.drawText(line, { x: M, y, size, font, color });
        y -= size + 4;
      }
    };
    const heading = (value: string) => {
      y -= 8;
      page.drawText(value, { x: M, y, size: 11, font: bold, color: black });
      page.drawRectangle({ x: M, y: y - 5, width: RIGHT - M, height: 1, color: brandRed });
      y -= 22;
    };
    const rowOf = (label: string, value: string | null | undefined) => {
      page.drawText(label, { x: M, y, size: 9, font: regular, color: gray });
      const lines = this.pdf.wrapText(value?.trim() ? value : 'nicht erfasst', bold, 10, RIGHT - M - 130);
      lines.forEach((line, i) => page.drawText(line, { x: M + 130, y: y - i * 13, size: 10, font: bold, color: value?.trim() ? black : gray }));
      y -= Math.max(1, lines.length) * 13 + 3;
    };

    if (fine.authority) text(fine.authority, 10, bold);
    text(`${company.city}, ${fmtDate(new Date())}`, 9, regular, gray);
    y -= 10;
    text(`Betrifft: Busse / Verfügung${fine.reference ? ` Nr. ${fine.reference}` : ''}, Kontrollschild ${formatLicensePlate(fine.licensePlate)}`, 11, bold);
    y -= 6;
    text(
      'Sehr geehrte Damen und Herren, als Halterin des genannten Fahrzeugs teilen wir Ihnen mit, dass das Fahrzeug zum Zeitpunkt des Vorfalls an die folgende Person vermietet war. Die Angaben stammen aus dem Mietvertrag.',
    );

    heading('Angaben zum Vorfall');
    rowOf('Referenz', fine.reference);
    rowOf('Behörde', fine.authority);
    rowOf('Datum / Zeit', fmtDateMaybeTime(fine.occurredAt));
    rowOf('Ort', fine.place);
    rowOf('Kontrollschild', formatLicensePlate(fine.licensePlate));
    rowOf('Betrag', fmtMoney(fine.amount, fine.currency));
    if (fine.description.trim()) rowOf('Beschreibung', fine.description);

    heading('Halterin und Fahrzeug');
    rowOf('Halterin', `${company.name}, ${company.street}, ${company.zip} ${company.city}`);
    rowOf('Fahrzeug', input.vehicle ? `${input.vehicle.brand} ${input.vehicle.model}` : null);

    heading('Fahrer / Mieter');
    rowOf('Name', booking.customerName);
    const address = [booking.driverStreet, [booking.driverZip, booking.driverCity].filter(Boolean).join(' '), booking.driverCountry]
      .filter((l): l is string => !!l && l.trim() !== '')
      .join(', ');
    rowOf('Adresse', address);
    rowOf('Geburtsdatum', booking.driverBirthDate ? fmtDate(booking.driverBirthDate) : null);
    rowOf(
      'Führerausweis',
      booking.driverLicenseNumber ? `${booking.driverLicenseNumber}${booking.driverLicenseCountry ? ` (${booking.driverLicenseCountry})` : ''}` : null,
    );
    rowOf('Telefon', booking.customerPhone);

    heading('Mietdauer');
    rowOf('Übergabe', fmtDateMaybeTime(booking.startDate));
    rowOf('Rückgabe', fmtDateMaybeTime(booking.endDate));
    rowOf('Mietvertrag Nr.', booking.id.substring(0, 8).toUpperCase());

    y -= 14;
    text('Der Mietvertrag mit den vollständigen Angaben kann auf Anfrage nachgereicht werden.', 9, regular, gray);
    y -= 44;
    page.drawRectangle({ x: M, y, width: 200, height: 0.8, color: rgb(0.6, 0.6, 0.6) });
    page.drawText(`${company.city}, Datum / Unterschrift (${company.name})`, { x: M, y: y - 12, size: 8, font: regular, color: gray });

    page.drawRectangle({ x: M, y: 36, width: RIGHT - M, height: 0.6, color: rgb(0.88, 0.88, 0.88) });
    page.drawText(`${company.name} | ${company.street}, ${company.zip} ${company.city}`, { x: M, y: 24, size: 7, font: regular, color: PDF_COLORS.muted });

    return pdfDoc.save();
  }
}
