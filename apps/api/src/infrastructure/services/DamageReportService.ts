import sharp from 'sharp';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import {
  CAR_DIAGRAM,
  DAMAGE_VIEW_LABELS,
  INSPECTION_TYPE_LABELS,
  type CarDiagramViewKey,
  type InspectionType,
} from '@hoppdrive/shared';
import { formatLicensePlate } from '../../domain/services/LicensePlate';
import { fmtDate, fmtDateMaybeTime, fmtDateTime } from '../format';
import { areaLabel, severityLabel, typeLabel } from './damageText';
import { PDF_COLORS, type PdfService } from './PdfService';
import type { PrivateStorageService } from './PrivateStorageService';
import type { CompanyInfo } from './SettingsService';

export interface ReportDamage {
  id: string;
  view: string;
  x: number;
  y: number;
  zone: string;
  type: string;
  severity: string;
  description: string;
  createdAt: Date;
  /** Storage keys of the (private) JPEG photos. */
  photoKeys: string[];
}

export interface DamageReportInput {
  company: CompanyInfo;
  type: InspectionType;
  at: Date;
  mileage?: number | null;
  /** Percent 0-100. */
  fuelLevel?: number | null;
  notes?: string;
  booking: { id: string; customerName: string; startDate: Date; endDate: Date };
  vehicle: { brand: string; model: string; licensePlate: string | null };
  /** Open damages at inspection time, numbered 1..n in this order. */
  damages: ReportDamage[];
  /** Damages found at this (return) inspection: marked "neu". */
  newDamageIds?: Set<string>;
  /** PNG data URL of the signing admin (drawn above the company signature line). */
  companySignatureData?: string | null;
  signerName?: string | null;
}

const RUBY = rgb(0x9b / 255, 0x1b / 255, 0x1b / 255);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const RIGHT = PAGE_W - M;
/** Content must stay above this y (footer area). */
const BOTTOM = 52;
const MAX_PHOTOS_PER_DAMAGE = 8;

/**
 * "Fahrzeugkontrolle" PDF: header, the five car views with numbered ruby pins (same paths as the admin UI, see
 * CAR_DIAGRAM in @hoppdrive/shared), damage table, photo thumbnails and signature lines for renter and company.
 */
export class DamageReportService {
  constructor(
    private pdf: PdfService,
    private storage: PrivateStorageService,
  ) {}

  async generate(input: DamageReportInput): Promise<Uint8Array> {
    const { pdfDoc, regular, bold } = await this.pdf.createDocument();
    const { black, gray, lightGray, brandRed } = PDF_COLORS;
    const typeText = INSPECTION_TYPE_LABELS[input.type];
    const title = input.type === 'PICKUP' ? 'Übergabeprotokoll' : 'Rückgabeprotokoll';
    const logo = await this.pdf.embedLogo(pdfDoc);
    const pages: PDFPage[] = [];

    const newPage = (first: boolean): { page: PDFPage; y: number } => {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      if (first) {
        page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 76, color: rgb(0.97, 0.97, 0.97) });
        this.pdf.drawLogo(page, logo, { x: M, y: PAGE_H - 48, width: 160 }, bold);
        page.drawText(`Fahrzeugkontrolle – ${title}`, { x: M, y: PAGE_H - 64, size: 10, font: regular, color: gray });
        const lines = [input.company.name, `${input.company.street}, ${input.company.zip} ${input.company.city}`, input.company.phone, input.company.email].filter(Boolean);
        lines.forEach((line, i) => {
          const w = regular.widthOfTextAtSize(line, 7.5);
          page.drawText(line, { x: RIGHT - w, y: PAGE_H - 28 - i * 11, size: 7.5, font: regular, color: gray });
        });
        return { page, y: PAGE_H - 100 };
      }
      page.drawRectangle({ x: 0, y: PAGE_H - 40, width: PAGE_W, height: 40, color: rgb(0.97, 0.97, 0.97) });
      this.pdf.drawLogo(page, logo, { x: M, y: PAGE_H - 26, width: 95 }, bold);
      page.drawText(`Fahrzeugkontrolle – ${title} (Fortsetzung)`, { x: 150, y: PAGE_H - 26, size: 9, font: regular, color: gray });
      return { page, y: PAGE_H - 66 };
    };

    let { page, y } = newPage(true);
    const ensure = (height: number) => {
      if (y - height < BOTTOM) ({ page, y } = newPage(false));
    };
    const section = (text: string) => {
      ensure(40);
      page.drawText(text, { x: M, y, size: 11, font: bold, color: black });
      page.drawRectangle({ x: M, y: y - 5, width: RIGHT - M, height: 1, color: brandRed });
      y -= 22;
    };

    /* ── Facts ─────────────────────────────────────────────── */
    const ref = input.booking.id.substring(0, 8).toUpperCase();
    const vehicleName = `${input.vehicle.brand} ${input.vehicle.model}`;
    const left: [string, string][] = [
      ['Art', typeText],
      ['Datum / Zeit', fmtDateTime(input.at)],
      ['Mieter', input.booking.customerName],
      ['Buchung', ref],
      ['Mietdauer', `${fmtDateMaybeTime(input.booking.startDate)} – ${fmtDateMaybeTime(input.booking.endDate)}`],
    ];
    const right: [string, string][] = [
      ['Fahrzeug', vehicleName],
      ['Kennzeichen', formatLicensePlate(input.vehicle.licensePlate) || '–'],
      ['Kilometerstand', input.mileage !== null && input.mileage !== undefined ? `${new Intl.NumberFormat('de-CH').format(input.mileage)} km` : '–'],
      ['Tank / Ladestand', input.fuelLevel !== null && input.fuelLevel !== undefined ? `${input.fuelLevel} %` : '–'],
    ];
    const factsTop = y;
    const drawFacts = (rows: [string, string][], x: number, valueX: number, width: number) => {
      let ry = factsTop;
      for (const [label, value] of rows) {
        page.drawText(label, { x, y: ry, size: 8, font: regular, color: gray });
        const wrapped = this.pdf.wrapText(value, bold, 9, width);
        wrapped.forEach((line, i) => page.drawText(line, { x: valueX, y: ry - i * 11, size: 9, font: bold, color: black }));
        ry -= Math.max(1, wrapped.length) * 11 + 5;
      }
      return ry;
    };
    const yLeft = drawFacts(left, M, M + 78, 190);
    const yRight = drawFacts(right, 320, 320 + 88, 147);
    y = Math.min(yLeft, yRight) - 4;

    if (input.notes?.trim()) {
      ensure(30);
      page.drawText('Bemerkungen', { x: M, y, size: 8, font: regular, color: gray });
      y -= 12;
      for (const line of this.pdf.wrapText(input.notes.trim(), regular, 9, RIGHT - M)) {
        ensure(14);
        page.drawText(line, { x: M, y, size: 9, font: regular, color: black });
        y -= 12;
      }
    }
    y -= 14;

    /* ── Diagram ──────────────────────────────────────────── */
    section('Fahrzeugzustand');
    const numbered = input.damages.map((d, i) => ({ ...d, n: i + 1 }));
    // Row 1: left | right side view. Row 2: front | top | rear.
    const rowOneH = 12 + CAR_DIAGRAM.views.left.height * 0.62;
    const rowTwoH = 12 + CAR_DIAGRAM.views.top.height * 0.5;
    ensure(rowOneH + rowTwoH + 24);
    const sideScale = 0.62;
    const sideW = CAR_DIAGRAM.views.left.width * sideScale;
    this.drawView(page, regular, bold, 'left', M + 4, y, sideScale, numbered);
    this.drawView(page, regular, bold, 'right', RIGHT - sideW - 4, y, sideScale, numbered);
    y -= rowOneH + 14;
    const endScale = 0.7;
    const topScale = 0.5;
    const topW = CAR_DIAGRAM.views.top.width * topScale;
    const endW = CAR_DIAGRAM.views.front.width * endScale;
    const gap = (RIGHT - M - topW - 2 * endW) / 4;
    this.drawView(page, regular, bold, 'front', M + gap, y, endScale, numbered);
    this.drawView(page, regular, bold, 'top', M + gap * 2 + endW, y, topScale, numbered);
    this.drawView(page, regular, bold, 'rear', M + gap * 3 + endW + topW, y, endScale, numbered);
    y -= rowTwoH + 14;

    /* ── Table ────────────────────────────────────────────── */
    section(numbered.length > 0 ? `Festgestellte Schäden (${numbered.length})` : 'Festgestellte Schäden');
    if (numbered.length === 0) {
      page.drawText('Keine Schäden festgehalten: Das Fahrzeug ist nach aktuellem Stand schadenfrei.', { x: M, y, size: 9, font: regular, color: gray });
      y -= 22;
    } else {
      const col = { no: M + 4, area: M + 32, type: M + 150, sev: M + 222, desc: M + 280, since: RIGHT - 52 };
      const header = () => {
        ensure(40);
        page.drawRectangle({ x: M, y: y - 5, width: RIGHT - M, height: 18, color: lightGray });
        const hy = y;
        page.drawText('Nr.', { x: col.no, y: hy, size: 8, font: bold, color: black });
        page.drawText('Bereich', { x: col.area, y: hy, size: 8, font: bold, color: black });
        page.drawText('Art', { x: col.type, y: hy, size: 8, font: bold, color: black });
        page.drawText('Schwere', { x: col.sev, y: hy, size: 8, font: bold, color: black });
        page.drawText('Beschreibung', { x: col.desc, y: hy, size: 8, font: bold, color: black });
        page.drawText('seit', { x: col.since, y: hy, size: 8, font: bold, color: black });
        y -= 20;
      };
      header();
      for (const d of numbered) {
        const area = this.pdf.wrapText(`${areaLabel(d)} (${DAMAGE_VIEW_LABELS[d.view as CarDiagramViewKey] ?? d.view})`, regular, 8.5, 112);
        const desc = this.pdf.wrapText(d.description.trim() || '–', regular, 8.5, col.since - col.desc - 8);
        const isNew = !!input.newDamageIds?.has(d.id);
        const lines = Math.max(area.length, desc.length, isNew ? 2 : 1);
        const rowH = lines * 11 + 8;
        if (y - rowH < BOTTOM) {
          ({ page, y } = newPage(false));
          header();
        }
        this.drawPin(page, bold, col.no + 6, y + 3, d.n);
        area.forEach((l, i) => page.drawText(l, { x: col.area, y: y - i * 11, size: 8.5, font: regular, color: black }));
        page.drawText(typeLabel(d.type), { x: col.type, y, size: 8.5, font: regular, color: black });
        page.drawText(severityLabel(d.severity), { x: col.sev, y, size: 8.5, font: regular, color: black });
        desc.forEach((l, i) => page.drawText(l, { x: col.desc, y: y - i * 11, size: 8.5, font: regular, color: black }));
        page.drawText(fmtDate(d.createdAt), { x: col.since, y, size: 8, font: regular, color: gray });
        if (isNew) {
          page.drawText('NEU', { x: col.since, y: y - 11, size: 7.5, font: bold, color: RUBY });
        }
        page.drawRectangle({ x: M, y: y - (lines - 1) * 11 - 5, width: RIGHT - M, height: 0.6, color: rgb(0.88, 0.88, 0.88) });
        y -= rowH;
      }
      y -= 14;
    }

    /* ── Photos ───────────────────────────────────────────── */
    const withPhotos = numbered.filter((d) => d.photoKeys.length > 0);
    if (withPhotos.length > 0) {
      const cols = 3;
      const cellW = (RIGHT - M - (cols - 1) * 10) / cols;
      const cellH = cellW * 0.75;
      ensure(40 + 24 + cellH); // the heading never sits alone at the bottom of a page
      section('Fotos');
      for (const d of withPhotos) {
        ensure(24 + cellH);
        this.drawPin(page, bold, M + 7, y + 3, d.n);
        page.drawText(`${areaLabel(d)} – ${typeLabel(d.type)}`, { x: M + 20, y, size: 9, font: bold, color: black });
        y -= 16;
        const keys = d.photoKeys.slice(0, MAX_PHOTOS_PER_DAMAGE);
        for (let i = 0; i < keys.length; i += cols) {
          ensure(cellH + 10);
          for (let c = 0; c < cols && i + c < keys.length; c++) {
            const image = await this.thumbnail(pdfDoc, keys[i + c]);
            if (!image) continue;
            const scale = Math.min(cellW / image.width, cellH / image.height);
            const w = image.width * scale;
            const h = image.height * scale;
            const x = M + c * (cellW + 10);
            page.drawRectangle({ x, y: y - cellH, width: cellW, height: cellH, color: rgb(0.96, 0.96, 0.96) });
            page.drawImage(image, { x: x + (cellW - w) / 2, y: y - cellH + (cellH - h) / 2, width: w, height: h });
            this.drawPin(page, bold, x + 9, y - 9, d.n);
          }
          y -= cellH + 10;
        }
        y -= 4;
      }
    }

    /* ── Signatures ───────────────────────────────────────── */
    ensure(150);
    y -= 6;
    section('Bestätigung');
    const statement =
      input.type === 'PICKUP'
        ? 'Der Mieter bestätigt, das Fahrzeug im oben dokumentierten Zustand übernommen zu haben.'
        : 'Die Rückgabe des Fahrzeugs wurde im oben dokumentierten Zustand festgehalten.';
    page.drawText(statement, { x: M, y, size: 9, font: regular, color: gray });
    y -= 70;
    const lineW = 215;
    const sigBottom = y;
    page.drawRectangle({ x: M, y: sigBottom, width: lineW, height: 0.8, color: rgb(0.6, 0.6, 0.6) });
    page.drawRectangle({ x: RIGHT - lineW, y: sigBottom, width: lineW, height: 0.8, color: rgb(0.6, 0.6, 0.6) });
    await this.pdf.drawSignature(pdfDoc, page, input.companySignatureData, { x: RIGHT - lineW, y: sigBottom + 3, width: lineW, height: 58 });
    page.drawText(`Mieter: ${input.booking.customerName}`, { x: M, y: sigBottom - 12, size: 8, font: regular, color: gray });
    page.drawText(`Vermieter: ${input.signerName ? `${input.signerName}, ` : ''}${input.company.name}`.slice(0, 70), {
      x: RIGHT - lineW,
      y: sigBottom - 12,
      size: 8,
      font: regular,
      color: gray,
    });
    page.drawText(`Ort, Datum: ${input.company.city}, ${fmtDate(input.at)}`, { x: M, y: sigBottom - 24, size: 8, font: regular, color: gray });

    /* ── Footer ───────────────────────────────────────────── */
    const footer = `${input.company.name} | ${vehicleName} ${formatLicensePlate(input.vehicle.licensePlate)} | Buchung ${ref}`;
    pages.forEach((p, i) => {
      p.drawRectangle({ x: M, y: 36, width: RIGHT - M, height: 0.6, color: rgb(0.88, 0.88, 0.88) });
      p.drawText(footer, { x: M, y: 24, size: 7, font: regular, color: PDF_COLORS.muted });
      const label = `Seite ${i + 1} / ${pages.length}`;
      p.drawText(label, { x: RIGHT - regular.widthOfTextAtSize(label, 7), y: 24, size: 7, font: regular, color: PDF_COLORS.muted });
    });

    return pdfDoc.save();
  }

  /** One car view with its label and the pins of the damages located in it. `top` = PDF y of the label baseline. */
  private drawView(
    page: PDFPage,
    regular: PDFFont,
    bold: PDFFont,
    key: CarDiagramViewKey,
    x: number,
    top: number,
    scale: number,
    damages: { n: number; view: string; x: number; y: number }[],
  ) {
    const view = CAR_DIAGRAM.views[key];
    page.drawText(DAMAGE_VIEW_LABELS[key], { x, y: top, size: 8, font: bold, color: PDF_COLORS.gray });
    const originY = top - 6; // top edge of the drawing
    // Fill first, then the light detail lines, then the dark outline on top (so nothing hides the glass / door lines).
    for (const d of view.paths) {
      page.drawSvgPath(d, { x, y: originY, scale, color: rgb(0.965, 0.965, 0.965) });
    }
    for (const d of view.details) {
      page.drawSvgPath(d, { x, y: originY, scale, borderColor: rgb(0.55, 0.6, 0.62), borderWidth: 0.8 / scale });
    }
    for (const d of view.paths) {
      page.drawSvgPath(d, { x, y: originY, scale, borderColor: rgb(0.13, 0.13, 0.13), borderWidth: 1.3 / scale });
    }
    for (const d of damages) {
      if (d.view !== key) continue;
      this.drawPin(page, bold, x + d.x * view.width * scale, originY - d.y * view.height * scale, d.n);
    }
    void regular;
  }

  /** Numbered ruby pin centred at (cx, cy). */
  private drawPin(page: PDFPage, bold: PDFFont, cx: number, cy: number, n: number) {
    const r = 6.5;
    page.drawCircle({ x: cx, y: cy, size: r, color: RUBY, borderColor: rgb(1, 1, 1), borderWidth: 1 });
    const text = String(n);
    const size = text.length > 1 ? 6.5 : 8;
    const w = bold.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - w / 2, y: cy - size * 0.35, size, font: bold, color: rgb(1, 1, 1) });
  }

  /** The stored JPEG as a small embedded image (keeps the PDF light enough to e-mail). */
  private async thumbnail(pdfDoc: PDFDocument, key: string) {
    try {
      const bytes = await this.storage.read(key);
      const small = await sharp(bytes).rotate().resize({ width: 560, height: 420, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      return await pdfDoc.embedJpg(small);
    } catch (err) {
      console.error(`[DamageReport] Photo ${key} skipped:`, err);
      return null;
    }
  }
}
