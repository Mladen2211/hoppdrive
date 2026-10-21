import type { PrismaClient } from '@prisma/client';

/** Everything the PDFs, QR bills and e-mails need to know about the company (the creditor). */
export interface CompanyInfo {
  name: string;
  street: string;
  zip: string;
  city: string;
  /** Display name for the PDFs ("Schweiz") or an ISO code ("CH"); see countryCode(). */
  country: string;
  phone: string;
  email: string;
  /** Swiss UID / VAT number (MwSt-Nr.), e.g. "CHE-123.456.789 MWST". */
  uid: string;
  iban: string;
  /** QR-IBAN (IID 30000-31999). With a QR-IBAN the QR bill uses a QRR reference. */
  qrIban: string;
  bankName: string;
}

export interface InvoiceSettingsInfo {
  vatRate: number;
  /** Default of the "Mit QR-Rechnung" checkbox. */
  defaultWithQrBill: boolean;
  /** Payment term in days. */
  dueDays: number;
}

export type CurrencyCode = 'CHF' | 'EUR';
export const CURRENCY_CODES: readonly CurrencyCode[] = ['CHF', 'EUR'];

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Euro-Abschleppservice GmbH',
  street: 'Industriestrasse 10',
  zip: '8305',
  city: 'Dietlikon',
  country: 'Schweiz',
  phone: '+41 44 833 33 33',
  email: 'info@hoppdrive.ch',
  uid: '',
  iban: '',
  qrIban: '',
  bankName: '',
};

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

/**
 * Typed access to the CMS key/value settings that the backend itself needs.
 * Reads are cheap (two rows), so nothing is cached: a change in the settings page applies at once.
 */
export class SettingsService {
  constructor(private prisma: PrismaClient) {}

  async getValue<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key } });
    return (row?.value as T | undefined) ?? null;
  }

  /** `company` + `invoice_settings` merged into one profile. Missing values fall back to the defaults. */
  async getCompany(): Promise<CompanyInfo> {
    const rows = await this.prisma.siteSetting.findMany({ where: { key: { in: ['company', 'invoice_settings'] } } });
    const by = new Map(rows.map((r) => [r.key, (r.value ?? {}) as Record<string, unknown>]));
    const company = by.get('company') ?? {};
    const invoice = by.get('invoice_settings') ?? {};
    return {
      name: str(company.name, DEFAULT_COMPANY.name),
      street: str(company.street, DEFAULT_COMPANY.street),
      zip: str(company.zip, DEFAULT_COMPANY.zip),
      city: str(company.city, DEFAULT_COMPANY.city),
      country: str(company.country, DEFAULT_COMPANY.country),
      phone: str(company.phone, DEFAULT_COMPANY.phone),
      email: str(company.inquiryEmail, DEFAULT_COMPANY.email),
      // The UID historically lived in invoice_settings; `company.uid` wins when set.
      uid: str(company.uid, str(invoice.uid, DEFAULT_COMPANY.uid)),
      iban: str(invoice.iban),
      qrIban: str(invoice.qrIban),
      bankName: str(invoice.bankName),
    };
  }

  async getInvoiceSettings(): Promise<InvoiceSettingsInfo> {
    const value = (await this.getValue<Record<string, unknown>>('invoice_settings')) ?? {};
    const vat = Number(value.vatRate);
    const due = Number(value.dueDays);
    return {
      vatRate: Number.isFinite(vat) && vat >= 0 ? vat : 8.1,
      defaultWithQrBill: value.defaultWithQrBill === true,
      dueDays: Number.isFinite(due) && due > 0 ? Math.round(due) : 30,
    };
  }

  /** Active currency (`currency` setting {code}); CHF when unset. */
  async getCurrency(): Promise<CurrencyCode> {
    const value = await this.getValue<{ code?: unknown }>('currency');
    const code = typeof value?.code === 'string' ? value.code.toUpperCase() : '';
    return (CURRENCY_CODES as readonly string[]).includes(code) ? (code as CurrencyCode) : 'CHF';
  }

  /** Admin whose stored signature signs contracts for the company (`contract.signerAdminId`), if configured. */
  async getContractSignerId(): Promise<string | null> {
    const value = await this.getValue<{ signerAdminId?: unknown }>('contract');
    return typeof value?.signerAdminId === 'string' && value.signerAdminId ? value.signerAdminId : null;
  }
}

/** Two-letter ISO country code for QR bills ("Schweiz" / "Switzerland" / "CH" -> "CH"). */
export function countryCode(country: string | null | undefined): string {
  const c = (country ?? '').trim();
  if (!c) return 'CH';
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  const map: Record<string, string> = {
    schweiz: 'CH', switzerland: 'CH', suisse: 'CH', svizzera: 'CH', svizra: 'CH',
    deutschland: 'DE', germany: 'DE', allemagne: 'DE', germania: 'DE',
    österreich: 'AT', oesterreich: 'AT', austria: 'AT', autriche: 'AT',
    liechtenstein: 'LI',
    frankreich: 'FR', france: 'FR',
    italien: 'IT', italy: 'IT', italie: 'IT', italia: 'IT',
    kroatien: 'HR', croatia: 'HR', croatie: 'HR', croazia: 'HR', hrvatska: 'HR',
  };
  return map[c.toLowerCase()] ?? 'CH';
}
