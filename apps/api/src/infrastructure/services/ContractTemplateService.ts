import {
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFPage,
  PDFSignature,
  PDFTextField,
  rgb,
} from 'pdf-lib';
import {
  CONTRACT_SIGNATURE_FIELDS,
  CONTRACT_TEMPLATE_FIELDS,
  type ContractTemplateFieldReport,
} from '@hoppdrive/shared';
import { AppError } from '../../application/errors';
import { formatLicensePlate } from '../../domain/services/LicensePlate';
import { fmtAmount, fmtDate, fmtDateMaybeTime, fmtDateTime, fmtMoney, rentalDays } from '../format';
import { damageListText, type DamageLike } from './damageText';
import { PDF_COLORS, type PdfService } from './PdfService';
import type { CompanyInfo } from './SettingsService';

const KNOWN_KEYS = new Set(CONTRACT_TEMPLATE_FIELDS.map((f) => f.key));
const SIGNATURE_KEYS = new Set(CONTRACT_SIGNATURE_FIELDS.map((f) => f.key));

/** Everything the contract fields are filled from. */
export interface ContractFillInput {
  bookingId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  driverAddressLines: string[];
  driverBirthDate?: Date | null;
  driverLicenseNumber?: string | null;
  driverLicenseCountry?: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear?: number | null;
  licensePlate?: string | null;
  startDate: Date;
  endDate: Date;
  /** Final price (after the discount). */
  totalPrice: number;
  discountAmount?: number;
  currency: string;
  locationName?: string | null;
  notes?: string | null;
  /** OPEN damages of the vehicle at contract time, in display order. */
  existingDamages: DamageLike[];
  /** Customer signing time (null for the pre-filled draft). */
  signedAt?: Date | null;
  company: CompanyInfo;
  /** PNG data URL of the signing admin (drawn into companySignature). */
  companySignatureData?: string | null;
  /** PNG data URL of the renter (drawn into customerSignature). */
  customerSignatureData?: string | null;
}

const clean = (v: string | number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

/**
 * Fillable contract PDFs: analyses uploaded templates (AcroForm), generates the starter template and fills a template
 * with a booking (text fields with the embedded Unicode font, signature images drawn into the signature widgets,
 * flattened, AGB appended).
 */
export class ContractTemplateService {
  constructor(private pdf: PdfService) {}

  /* ──────────────────────────────────────────────────────────── *
   *  Analysis of an uploaded template                            *
   * ──────────────────────────────────────────────────────────── */

  /** Field names of the AcroForm, matched against the supported list. Rejects PDFs that cannot be used. */
  async analyse(bytes: Uint8Array): Promise<ContractTemplateFieldReport> {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes, { updateMetadata: false });
    } catch (err) {
      const encrypted = /encrypt/i.test(err instanceof Error ? err.message : '');
      throw new AppError(
        encrypted
          ? 'Das PDF ist passwortgeschützt oder verschlüsselt und kann nicht verwendet werden.'
          : 'Die Datei ist kein lesbares PDF.',
        422,
        'invalid_pdf',
      );
    }

    let fields: string[];
    try {
      fields = doc.getForm().getFields().map((f) => f.getName());
    } catch {
      throw new AppError('Die Datei ist kein lesbares PDF.', 422, 'invalid_pdf');
    }
    if (fields.length === 0) {
      throw new AppError(
        'Das PDF enthält keine ausfüllbaren Formularfelder. Laden Sie die Starter-Vorlage herunter und bearbeiten Sie diese in Adobe Acrobat.',
        422,
        'no_form_fields',
      );
    }

    const keyOf = (name: string): string => (KNOWN_KEYS.has(name) || SIGNATURE_KEYS.has(name) ? name : name.split('.').pop() ?? name);
    const known = fields.filter((n) => KNOWN_KEYS.has(keyOf(n)));
    const signatureFields = fields.filter((n) => SIGNATURE_KEYS.has(keyOf(n)));
    const unknown = fields.filter((n) => !KNOWN_KEYS.has(keyOf(n)) && !SIGNATURE_KEYS.has(keyOf(n)));
    const present = new Set(fields.map(keyOf));
    const missingRecommended = [...CONTRACT_TEMPLATE_FIELDS, ...CONTRACT_SIGNATURE_FIELDS]
      .filter((f) => f.recommended && !present.has(f.key))
      // vehicleName is not needed when brand and model are both present
      .filter((f) => !(f.key === 'vehicleName' && present.has('vehicleBrand') && present.has('vehicleModel')))
      .map((f) => f.key);

    return { fields, known, unknown, signatureFields, missingRecommended };
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Values                                                      *
   * ──────────────────────────────────────────────────────────── */

  /** The text of every supported field for this booking (German, Swiss number and date formats). */
  buildValues(input: ContractFillInput): Record<string, string> {
    const { company } = input;
    const days = rentalDays(input.startDate, input.endDate);
    const discount = input.discountAmount && input.discountAmount > 0 ? input.discountAmount : 0;
    const beforeDiscount = input.totalPrice + discount;
    const license = input.driverLicenseNumber
      ? `${input.driverLicenseNumber}${input.driverLicenseCountry ? ` (${input.driverLicenseCountry})` : ''}`
      : '';
    return {
      contractNumber: input.bookingId.substring(0, 8).toUpperCase(),
      issueDate: fmtDate(input.signedAt ?? new Date()),
      companyName: company.name,
      companyAddress: [company.street, `${company.zip} ${company.city}`.trim()].filter(Boolean).join(', '),
      companyUid: company.uid,
      customerName: input.customerName,
      customerEmail: clean(input.customerEmail),
      customerPhone: clean(input.customerPhone),
      driverAddress: input.driverAddressLines.join('\n'),
      driverBirthDate: input.driverBirthDate ? fmtDate(input.driverBirthDate) : '',
      driverLicenseNumber: license,
      vehicleName: `${input.vehicleBrand} ${input.vehicleModel}`.trim(),
      vehicleBrand: input.vehicleBrand,
      vehicleModel: input.vehicleModel,
      vehicleYear: clean(input.vehicleYear),
      licensePlate: formatLicensePlate(input.licensePlate),
      pickupAt: fmtDateMaybeTime(input.startDate),
      returnAt: fmtDateMaybeTime(input.endDate),
      rentalDays: String(days),
      pricePerDay: fmtMoney(beforeDiscount / days, input.currency),
      discount: discount ? `- ${fmtMoney(discount, input.currency)}` : '',
      totalPrice: fmtMoney(input.totalPrice, input.currency),
      currency: input.currency,
      location: clean(input.locationName),
      notes: clean(input.notes),
      existingDamages: damageListText(input.existingDamages),
      signedAt: input.signedAt ? fmtDateTime(input.signedAt).replace(', ', ' ') : '',
      signedPlace: company.city,
    };
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Fill                                                        *
   * ──────────────────────────────────────────────────────────── */

  /**
   * Fills the template: text fields (appearances rebuilt with the embedded Unicode font), signature images into the
   * widget rectangles of companySignature / customerSignature (aspect ratio kept), flatten, AGB appended.
   */
  async fill(templateBytes: Uint8Array, input: ContractFillInput): Promise<Uint8Array> {
    const doc = await PDFDocument.load(templateBytes, { updateMetadata: false });
    const { regular } = await this.pdf.attachFonts(doc);
    const form = doc.getForm();
    const values = this.buildValues(input);

    const signatureImages: Record<string, string | null | undefined> = {
      companySignature: input.companySignatureData,
      customerSignature: input.customerSignatureData,
    };

    for (const field of form.getFields()) {
      const name = field.getName();
      const key = KNOWN_KEYS.has(name) || SIGNATURE_KEYS.has(name) ? name : name.split('.').pop() ?? name;
      if (SIGNATURE_KEYS.has(key)) {
        await this.drawSignatureInto(doc, form, field, signatureImages[key]);
        continue;
      }
      if (!KNOWN_KEYS.has(key)) continue;
      this.setFieldValue(field, values[key] ?? '', regular);
    }

    // Rebuild every appearance with the embedded Fira Sans so č ć đ š ž (and any Latin text) print.
    form.updateFieldAppearances(regular);
    this.dropFieldsWithoutAppearance(doc, form);
    form.flatten({ updateFieldAppearances: false });

    await this.pdf.appendAgb(doc);
    return doc.save();
  }

  /**
   * pdf-lib cannot flatten a widget that has no appearance stream (typical for empty digital-signature fields drawn in
   * Acrobat). Such fields are removed; an unsigned signature box keeps a thin outline so the page still shows the box.
   */
  private dropFieldsWithoutAppearance(doc: PDFDocument, form: ReturnType<PDFDocument['getForm']>): void {
    for (const field of form.getFields()) {
      const widgets = field.acroField.getWidgets();
      const hasAppearance =
        widgets.length > 0 &&
        widgets.every((w) => {
          try {
            return !!w.getNormalAppearance();
          } catch {
            return false; // no /AP /N at all
          }
        });
      if (hasAppearance && !(field instanceof PDFSignature)) continue;
      const name = field.getName();
      const outline = SIGNATURE_KEYS.has(KNOWN_KEYS.has(name) || SIGNATURE_KEYS.has(name) ? name : name.split('.').pop() ?? name);
      const boxes: { page: PDFPage; x: number; y: number; width: number; height: number }[] = [];
      for (const widget of widgets) {
        const ref = doc.context.getObjectRef(widget.dict);
        const page = ref ? doc.findPageForAnnotationRef(ref) : undefined;
        if (page) boxes.push({ page, ...widget.getRectangle() });
      }
      this.removeFieldSafely(doc, form, field);
      if (outline) {
        for (const b of boxes) {
          b.page.drawRectangle({ x: b.x, y: b.y, width: b.width, height: b.height, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.6 });
        }
      }
    }
  }

  /**
   * Removes a field and its widgets. pdf-lib's own removeField() throws for widgets without an appearance stream
   * (digital-signature fields), so the annotations are detached by hand.
   */
  private removeFieldSafely(doc: PDFDocument, form: ReturnType<PDFDocument['getForm']>, field: PDFField): void {
    for (const widget of field.acroField.getWidgets()) {
      const ref = doc.context.getObjectRef(widget.dict);
      if (!ref) continue;
      doc.findPageForAnnotationRef(ref)?.node.removeAnnot(ref);
      doc.context.delete(ref);
    }
    form.acroForm.removeField(field.acroField);
    doc.context.delete(field.ref);
  }

  private setFieldValue(field: PDFField, value: string, font: PDFFont): void {
    try {
      if (field instanceof PDFTextField) {
        field.setMaxLength(undefined);
        // A single-line field cannot show line breaks: join the lines.
        field.setText(field.isMultiline() ? value : value.replace(/\s*\n\s*/g, '; '));
        if (field.isMultiline()) this.fitMultilineFontSize(field, value, font);
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (!value) return;
        if (!field.getOptions().includes(value)) field.addOptions([value]);
        field.select(value);
      }
    } catch (err) {
      console.error(`[ContractTemplate] Could not fill field "${field.getName()}":`, err);
    }
  }

  /**
   * Multi-line fields with "auto" font size (size 0 in the default appearance, the Acrobat default) would be laid out by
   * pdf-lib with a huge font for short texts. Pick a size from 10 down to 6 pt that fits the text into the widget instead.
   */
  private fitMultilineFontSize(field: PDFTextField, value: string, font: PDFFont): void {
    try {
      const da = field.acroField.getDefaultAppearance() ?? '';
      const size = Number(/(-?\d+(?:\.\d+)?)\s+Tf/.exec(da)?.[1] ?? 0);
      if (size > 0) return; // an explicit size of the template author is respected
      const widget = field.acroField.getWidgets()[0];
      if (!widget) return;
      const { width, height } = widget.getRectangle();
      let chosen = 6;
      for (let candidate = 10; candidate >= 6; candidate -= 0.5) {
        const lines = this.pdf.wrapText(value, font, candidate, Math.max(10, width - 6)).length;
        if (lines * candidate * 1.2 <= height - 4) {
          chosen = candidate;
          break;
        }
      }
      field.setFontSize(chosen);
    } catch {
      /* keep pdf-lib's own layout */
    }
  }

  /** Draws the signature into every widget of the field (and removes the field), or leaves the empty box when none. */
  private async drawSignatureInto(
    doc: PDFDocument,
    form: ReturnType<PDFDocument['getForm']>,
    field: PDFField,
    dataUrl: string | null | undefined,
  ): Promise<void> {
    if (!dataUrl) return;
    const image = await this.pdf.embedImageDataUrl(doc, dataUrl);
    if (!image) return;

    const widgets = field.acroField.getWidgets();
    const targets: { page: PDFPage; x: number; y: number; width: number; height: number }[] = [];
    for (const widget of widgets) {
      const rect = widget.getRectangle();
      const ref = doc.context.getObjectRef(widget.dict);
      const page = ref ? doc.findPageForAnnotationRef(ref) : undefined;
      if (page && rect.width > 0 && rect.height > 0) targets.push({ page, ...rect });
    }
    if (targets.length === 0) return;

    this.removeFieldSafely(doc, form, field);
    for (const t of targets) {
      const pad = 2;
      const scale = Math.min((t.width - pad * 2) / image.width, (t.height - pad * 2) / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      t.page.drawImage(image, { x: t.x + (t.width - w) / 2, y: t.y + (t.height - h) / 2, width: w, height: h });
    }
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Starter template                                            *
   * ──────────────────────────────────────────────────────────── */

  /** A fillable A4 PDF with every supported field (and both signature boxes), laid out like a simple contract. */
  async generateStarter(): Promise<Uint8Array> {
    const { pdfDoc, regular, bold } = await this.pdf.createDocument();
    pdfDoc.setTitle('HoppDrive Mietvertrag (Vorlage)');
    pdfDoc.setSubject('Ausfüllbare Vertragsvorlage: Feldnamen nicht ändern, Layout frei anpassen.');
    const form = pdfDoc.getForm();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { brandRed, black, gray, rule } = PDF_COLORS;
    const X0 = 40;
    const X1 = 555;

    const labelOf = new Map<string, string>(
      [...CONTRACT_TEMPLATE_FIELDS, ...CONTRACT_SIGNATURE_FIELDS].map((f) => [f.key, f.label]),
    );
    const multiline = new Set(CONTRACT_TEMPLATE_FIELDS.filter((f) => f.multiline).map((f) => f.key));

    /** Creates the field and prints its small label above it. */
    const place = (name: string, x: number, bottom: number, width: number, height = 18, label = labelOf.get(name) ?? name) => {
      page.drawText(label, { x, y: bottom + height + 3, size: 7, font: regular, color: gray });
      const field = form.createTextField(name);
      if (multiline.has(name) || height > 24) field.enableMultiline();
      field.addToPage(page, {
        x,
        y: bottom,
        width,
        height,
        borderWidth: 0.6,
        borderColor: rgb(0.7, 0.7, 0.7),
        textColor: black,
      });
      field.setFontSize(9); // (needs the default appearance that addToPage creates)
      // The tooltip tells Acrobat users what the field is for (the field name itself must not change).
      field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(`${label} [${name}]`));
    };

    /* Header */
    this.pdf.drawLogo(page, await this.pdf.embedLogo(pdfDoc), { x: X0, y: 810, width: 150 }, bold);
    page.drawText('Mietvertrag', { x: X0, y: 787, size: 22, font: bold, color: brandRed });
    page.drawText('Rental Agreement', { x: X0, y: 774, size: 9, font: regular, color: gray });
    place('contractNumber', 335, 784, 105, 18);
    place('issueDate', 450, 784, 105, 18);

    let top = 766;
    const heading = (text: string) => {
      top -= 8;
      page.drawText(text, { x: X0, y: top, size: 11, font: bold, color: black });
      page.drawRectangle({ x: X0, y: top - 5, width: X1 - X0, height: 1, color: brandRed });
      top -= 14;
    };
    /** One row of fields below the cursor: [name, x, width, height?] */
    const row = (items: [string, number, number, number?][], label?: Record<string, string>) => {
      const height = Math.max(...items.map((i) => i[3] ?? 18));
      const bottom = top - 11 - height;
      for (const [name, x, width, h] of items) place(name, x, bottom + (height - (h ?? 18)), width, h ?? 18, label?.[name]);
      top = bottom - 8;
    };

    heading('Vermieter');
    row([['companyName', X0, 195], ['companyAddress', 245, 200], ['companyUid', 455, 100]]);

    heading('Mieter');
    row([['customerName', X0, 195], ['customerEmail', 245, 200], ['customerPhone', 455, 100]]);
    row([['driverAddress', X0, 300, 30], ['driverBirthDate', 350, 95], ['driverLicenseNumber', 455, 100]]);

    heading('Fahrzeug');
    row([['vehicleName', X0, 195], ['licensePlate', 245, 100], ['location', 355, 200]]);
    row([['vehicleBrand', X0, 150], ['vehicleModel', 200, 145], ['vehicleYear', 355, 70]]);

    heading('Mietdauer & Preis');
    row([['pickupAt', X0, 150], ['returnAt', 200, 150], ['rentalDays', 360, 65]]);
    row([['pricePerDay', X0, 110], ['discount', 160, 110], ['totalPrice', 280, 110], ['currency', 400, 60]]);

    heading('Bemerkungen');
    row([['notes', X0, X1 - X0, 26]]);

    heading('Bestehende Schäden');
    row([['existingDamages', X0, X1 - X0, 70]]);

    heading('Unterschriften');
    row(
      [['companySignature', X0, 250, 52], ['customerSignature', 305, 250, 52]],
      { companySignature: 'Vermieter', customerSignature: 'Mieter' },
    );
    row([['signedPlace', X0, 120], ['signedAt', 170, 120]]);

    page.drawRectangle({ x: X0, y: 30, width: X1 - X0, height: 0.6, color: rule });
    page.drawText('Die Allgemeinen Geschäftsbedingungen (AGB) werden automatisch als Anhang beigefügt.', {
      x: X0,
      y: 19,
      size: 7,
      font: regular,
      color: PDF_COLORS.muted,
    });

    return pdfDoc.save();
  }

  /** Placeholder data for the preview of a template without a booking. */
  sampleInput(company: CompanyInfo, companySignatureData: string | null): ContractFillInput {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 3);
    return {
      bookingId: '00000000-0000-4000-8000-000000000000',
      customerName: 'Max Muster',
      customerEmail: 'max.muster@example.ch',
      customerPhone: '+41 79 123 45 67',
      driverAddressLines: ['Musterstrasse 12', '8000 Zürich', 'Schweiz'],
      driverBirthDate: new Date(Date.UTC(1990, 4, 17)),
      driverLicenseNumber: '1234567',
      driverLicenseCountry: 'CH',
      vehicleBrand: 'Škoda',
      vehicleModel: 'Kodiaq',
      vehicleYear: 2024,
      licensePlate: 'ZH123456',
      startDate: start,
      endDate: end,
      totalPrice: 405,
      discountAmount: 45,
      currency: 'CHF',
      locationName: company.city ? `${company.city} (${company.street})` : null,
      notes: 'Muster-Vorschau: Diese Angaben sind frei erfunden.',
      existingDamages: [
        { view: 'left', zone: 'Tür vorne links', type: 'KRATZER', severity: 'minor', description: 'Kleiner Kratzer, ca. 5 cm' },
        { view: 'front', zone: 'Stossstange vorne', type: 'LACK', severity: 'medium', description: '' },
      ],
      signedAt: null,
      company,
      companySignatureData,
      customerSignatureData: null,
    };
  }
}

