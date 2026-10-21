import path from 'path';
import fs from 'fs/promises';
import PDFDocument from 'pdfkit';
import { SwissQRBill } from 'swissqrbill/pdf';
import {
  calculateQRReferenceChecksum,
  calculateSCORReferenceChecksum,
  isIBANValid,
  isQRIBAN,
} from 'swissqrbill/utils';
import type { Data } from 'swissqrbill/types';
import { AppError } from '../../application/errors';
import { countryCode, type CompanyInfo } from './SettingsService';

const FONT_DIR = path.join(__dirname, '../../../assets/fonts');

/** The debtor (payer) printed on the payment slip. Optional: without a complete address the box stays blank. */
export interface QrBillDebtor {
  name?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface QrBillInput {
  invoiceNumber: string;
  total: number;
  currency: string;
  debtor?: QrBillDebtor | null;
  company: CompanyInfo;
}

export interface QrBillBuild {
  /** Data object for swissqrbill (also what the tests validate). */
  data: Data;
  /** QRR (27 digits) with a QR-IBAN, SCOR (RF...) with a normal IBAN. */
  reference: string;
  referenceType: 'QRR' | 'SCOR';
  /** The IBAN the payment goes to (no spaces). */
  account: string;
}

const MISSING_LABELS: Record<string, string> = {
  iban: 'IBAN',
  name: 'Firmenname',
  street: 'Strasse',
  zip: 'PLZ',
  city: 'Ort',
  country: 'Land',
  currency: 'Währung (nur CHF oder EUR)',
  amount: 'Betrag',
};

function unavailable(missing: string[], detail?: string): AppError {
  const what = missing.map((m) => MISSING_LABELS[m] ?? m).join(', ');
  return new AppError(
    `QR-Rechnung nicht möglich: ${detail ?? `Es fehlen Angaben zur Gläubigerin (${what})`}. ` +
      'Bitte unter Einstellungen → Firmendaten / Rechnungsinfos ergänzen.',
    422,
    'qr_bill_unavailable',
    { missing },
  );
}

const clip = (value: string | null | undefined, max: number): string => (value ?? '').trim().slice(0, max);

/**
 * Swiss QR bill (payment part + receipt) according to the Swiss Implementation Guidelines.
 *
 *  - Account: the QR-IBAN of invoice_settings when set (QRR reference), else the normal IBAN (SCOR reference).
 *  - Reference: derived from the invoice number, so it is unique per invoice and stable across renderings.
 *      QRR: the digits of the invoice number, zero-padded to 26 digits + mod-10 recursive check digit (27 digits).
 *      SCOR: "RF" + ISO 11649 check digits + the digits of the invoice number.
 *  - The slip is rendered with pdfkit into a single A4 page with the payment part at the bottom
 *    (the invoice PDF then embeds that page, see PdfService.generateInvoice).
 */
export class QrBillService {
  private fonts: { regular: Buffer; bold: Buffer } | null = null;

  /** QR reference (27 digits, mod-10 recursive) of an invoice number. */
  static qrReferenceFor(invoiceNumber: string): string {
    const digits = QrBillService.digitsOf(invoiceNumber).slice(-26).padStart(26, '0');
    return digits + calculateQRReferenceChecksum(digits);
  }

  /** Creditor reference (ISO 11649, "RF" + 2 check digits + max 21 characters) of an invoice number. */
  static scorReferenceFor(invoiceNumber: string): string {
    const base = QrBillService.digitsOf(invoiceNumber).slice(-21);
    return `RF${calculateSCORReferenceChecksum(base)}${base}`;
  }

  private static digitsOf(invoiceNumber: string): string {
    const digits = invoiceNumber.replace(/\D/g, '');
    return digits || '0';
  }

  /**
   * Validates the creditor / currency / amount and builds the swissqrbill data object.
   * Throws AppError 422 `qr_bill_unavailable` (with `missing`: the settings to complete) when it cannot be built.
   */
  buildData(input: QrBillInput): QrBillBuild {
    const { company } = input;
    const missing: string[] = [];

    // Account: QR-IBAN preferred. Anything in the "IBAN" field that happens to be a QR-IBAN is treated as one.
    const candidates = [company.qrIban, company.iban].map((v) => (v ?? '').replace(/\s+/g, '').toUpperCase()).filter(Boolean);
    const account = candidates.find((a) => isIBANValid(a) && /^(CH|LI)/.test(a));
    if (!account) {
      if (candidates.length > 0) {
        throw unavailable(['iban'], 'Die hinterlegte IBAN ist ungültig oder keine Schweizer / liechtensteinische IBAN');
      }
      missing.push('iban');
    }
    if (!company.name.trim()) missing.push('name');
    if (!company.street.trim()) missing.push('street');
    if (!company.zip.trim()) missing.push('zip');
    if (!company.city.trim()) missing.push('city');

    const currency = input.currency.toUpperCase();
    if (currency !== 'CHF' && currency !== 'EUR') {
      throw unavailable(['currency'], `Die Währung ${input.currency} wird von der QR-Rechnung nicht unterstützt (nur CHF und EUR)`);
    }
    if (missing.length > 0) throw unavailable(missing);

    const qrIban = isQRIBAN(account!);
    const reference = qrIban ? QrBillService.qrReferenceFor(input.invoiceNumber) : QrBillService.scorReferenceFor(input.invoiceNumber);

    const data: Data = {
      currency,
      creditor: {
        account: account!,
        name: clip(company.name, 70),
        address: clip(company.street, 70),
        zip: clip(company.zip, 16),
        city: clip(company.city, 35),
        country: countryCode(company.country),
      },
      reference,
      message: clip(`Rechnung ${input.invoiceNumber}`, 140),
    } as Data;
    // A zero amount makes no sense on a payment slip: leave it open (the payer enters it) instead.
    if (input.total > 0) data.amount = Math.round(input.total * 100) / 100;

    const d = input.debtor;
    if (d && d.name?.trim() && d.street?.trim() && d.zip?.trim() && d.city?.trim()) {
      data.debtor = {
        name: clip(d.name, 70),
        address: clip(d.street, 70),
        zip: clip(d.zip, 16),
        city: clip(d.city, 35),
        country: countryCode(d.country),
      };
    }

    // The SwissQRBill constructor validates everything (lengths, reference vs. IBAN type, ...).
    try {
      new SwissQRBill(data, { language: 'DE' });
    } catch (err) {
      throw new AppError(
        `QR-Rechnung nicht möglich: ${err instanceof Error ? err.message : 'ungültige Daten'}`,
        422,
        'qr_bill_unavailable',
        { missing: [] },
      );
    }

    return { data, reference, referenceType: qrIban ? 'QRR' : 'SCOR', account: account! };
  }

  /** Renders the slip: an A4 PDF whose bottom 105 mm hold the payment part and the receipt. */
  async render(data: Data): Promise<Uint8Array> {
    if (!this.fonts) {
      const [regular, bold] = await Promise.all([
        fs.readFile(path.join(FONT_DIR, 'FiraSans-Regular.ttf')),
        fs.readFile(path.join(FONT_DIR, 'FiraSans-Bold.ttf')),
      ]);
      this.fonts = { regular, bold };
    }

    return new Promise<Uint8Array>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
        doc.on('error', reject);

        // Fira Sans instead of Helvetica: the slip then prints č ć đ š ž (names / addresses of foreign renters).
        doc.registerFont('FiraSans', this.fonts!.regular);
        doc.registerFont('FiraSans-Bold', this.fonts!.bold);
        doc.addPage({ size: 'A4', margin: 0 });

        const bill = new SwissQRBill(data, { language: 'DE', fontName: 'FiraSans' as never });
        bill.attachTo(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
