/**
 * Invoice editor model (damage / fine / other invoices): line items as typed in the form, totals that
 * mirror the server (VAT per rate group, rounded per group), validation (message keys) and the request
 * body. Rental invoices keep the original booking + period flow and need none of this.
 */
import type {
  CreateCustomInvoiceRequest,
  CreateInvoiceItemInput,
  FeeDto,
  InvoiceDebtor,
  InvoiceType,
  VehicleDamageDto,
} from '@hoppdrive/shared';
import { parseDecimal } from '@/lib/fee-model';
import { tr } from '@/i18n/active';

export type InvoiceKind = InvoiceType;
export const INVOICE_KINDS: InvoiceKind[] = ['RENTAL', 'DAMAGE', 'FINE', 'OTHER'];

export interface InvoiceLine {
  /** Stable React key. */
  key: string;
  description: string;
  /** typed numbers */
  quantity: string;
  unitPrice: string;
  /** '' = default rate */
  vat: string;
  feeId?: string | null;
  damageId?: string | null;
}

export interface DebtorForm {
  name: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export const EMPTY_DEBTOR: DebtorForm = { name: '', email: '', street: '', zip: '', city: '', country: '' };

let lineCounter = 0;
export const newLineKey = () => `line-${Date.now().toString(36)}-${lineCounter++}`;

export const emptyLine = (vat: string): InvoiceLine => ({ key: newLineKey(), description: '', quantity: '1', unitPrice: '', vat });

/**
 * Rate preset of a new line: fines are passed on at cost (no VAT), everything else leaves the field empty = the default
 * rate of the invoice settings (shown as placeholder, so it follows the settings even before they have loaded).
 */
export const defaultVatFor = (kind: InvoiceKind): string => (kind === 'FINE' ? '0' : '');

export function lineFromFee(fee: FeeDto, defaultRate: number): InvoiceLine {
  return {
    key: newLineKey(),
    description: fee.name,
    quantity: '1',
    unitPrice: String(fee.defaultAmount),
    vat: fee.vatRate === null ? String(defaultRate) : String(fee.vatRate),
    feeId: fee.id,
  };
}

/** "Kratzer: Stossstange vorne (leicht)": the damage as an invoice line, amount still to be entered. */
export function lineFromDamage(damage: VehicleDamageDto, vat: string): InvoiceLine {
  const description = [tr(`invoiceEditor.damageType.${damage.type}`), damage.zone].filter(Boolean).join(': ');
  return { key: newLineKey(), description, quantity: '1', unitPrice: '', vat, damageId: damage.id };
}

export function debtorFromBooking(b: {
  customerName?: string | null;
  customerEmail?: string | null;
  driverStreet?: string | null;
  driverZip?: string | null;
  driverCity?: string | null;
  driverCountry?: string | null;
} | null): DebtorForm {
  if (!b) return { ...EMPTY_DEBTOR };
  return {
    name: b.customerName ?? '',
    email: b.customerEmail ?? '',
    street: b.driverStreet ?? '',
    zip: b.driverZip ?? '',
    city: b.driverCity ?? '',
    country: b.driverCountry ?? '',
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface InvoiceTotals {
  lines: { total: number; vatRate: number }[];
  subtotal: number;
  vatBreakdown: { rate: number; base: number; amount: number }[];
  vatAmount: number;
  total: number;
}

/** Same arithmetic as the server (InvoiceService.computeTotals): the preview matches the invoice that is created. */
export function computeTotals(lines: InvoiceLine[], defaultRate: number): InvoiceTotals {
  const computed = lines.map((l) => {
    const qty = parseDecimal(l.quantity);
    const unit = parseDecimal(l.unitPrice);
    const rate = l.vat.trim() === '' ? defaultRate : parseDecimal(l.vat);
    return {
      total: Number.isFinite(qty) && Number.isFinite(unit) ? round2(qty * unit) : 0,
      vatRate: Number.isFinite(rate) ? rate : defaultRate,
    };
  });
  const groups = new Map<number, number>();
  for (const l of computed) groups.set(l.vatRate, round2((groups.get(l.vatRate) ?? 0) + l.total));
  const vatBreakdown = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base, amount: round2((base * rate) / 100) }));
  const subtotal = round2(computed.reduce((sum, l) => sum + l.total, 0));
  const vatAmount = round2(vatBreakdown.reduce((sum, g) => sum + g.amount, 0));
  return { lines: computed, subtotal, vatBreakdown, vatAmount, total: round2(subtotal + vatAmount) };
}

export interface LineErrors {
  description?: string;
  quantity?: string;
  unitPrice?: string;
  vat?: string;
}

export interface EditorErrors {
  debtorName?: string;
  debtorEmail?: string;
  items?: string;
  total?: string;
  dueDays?: string;
  lines: Record<string, LineErrors>;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function validateEditor(input: { debtor: DebtorForm; lines: InvoiceLine[]; dueDays: string; sendEmail: boolean; totals: InvoiceTotals }): EditorErrors {
  const errors: EditorErrors = { lines: {} };
  if (!input.debtor.name.trim()) errors.debtorName = 'invoiceEditor.errDebtorName';
  const email = input.debtor.email.trim();
  if (email && !EMAIL_RE.test(email)) errors.debtorEmail = 'invoiceEditor.errEmail';
  else if (input.sendEmail && !email) errors.debtorEmail = 'invoiceEditor.errEmailForSend';
  if (input.lines.length === 0) errors.items = 'invoiceEditor.errNoItems';
  for (const line of input.lines) {
    const e: LineErrors = {};
    if (!line.description.trim()) e.description = 'invoiceEditor.errDescription';
    const qty = parseDecimal(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) e.quantity = 'invoiceEditor.errQuantity';
    const unit = parseDecimal(line.unitPrice);
    if (!Number.isFinite(unit)) e.unitPrice = 'invoiceEditor.errUnitPrice';
    if (line.vat.trim() !== '') {
      const vat = parseDecimal(line.vat);
      if (!Number.isFinite(vat) || vat < 0 || vat > 100) e.vat = 'invoiceEditor.errVat';
    }
    if (Object.keys(e).length > 0) errors.lines[line.key] = e;
  }
  if (input.lines.length > 0 && Object.keys(errors.lines).length === 0 && input.totals.total <= 0) errors.total = 'invoiceEditor.errTotal';
  if (input.dueDays.trim() !== '') {
    const days = Number(input.dueDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) errors.dueDays = 'invoiceEditor.errDueDays';
  }
  return errors;
}

export const hasErrors = (e: EditorErrors): boolean =>
  Boolean(e.debtorName || e.debtorEmail || e.items || e.total || e.dueDays) || Object.keys(e.lines).length > 0;

export function buildCustomRequest(input: {
  type: Exclude<InvoiceKind, 'RENTAL'>;
  bookingId: string;
  debtor: DebtorForm;
  lines: InvoiceLine[];
  dueDays: string;
  notes: string;
  withQrBill: boolean;
  sendEmail: boolean;
}): CreateCustomInvoiceRequest {
  const trimmed = (v: string) => v.trim();
  const debtor: InvoiceDebtor = {
    name: trimmed(input.debtor.name),
    email: trimmed(input.debtor.email) || null,
    street: trimmed(input.debtor.street) || null,
    zip: trimmed(input.debtor.zip) || null,
    city: trimmed(input.debtor.city) || null,
    country: trimmed(input.debtor.country) || null,
  };
  const items: CreateInvoiceItemInput[] = input.lines.map((l) => ({
    description: trimmed(l.description),
    quantity: parseDecimal(l.quantity),
    unitPrice: round2(parseDecimal(l.unitPrice)),
    // Every line states its rate, so the totals the user saw are the totals that are billed.
    vatRate: l.vat.trim() === '' ? null : parseDecimal(l.vat),
    feeId: l.feeId ?? null,
    damageId: l.damageId ?? null,
  }));
  return {
    type: input.type,
    bookingId: input.bookingId || null,
    debtor,
    items,
    ...(input.dueDays.trim() !== '' ? { dueDays: Number(input.dueDays) } : {}),
    ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
    withQrBill: input.withQrBill,
    sendEmail: input.sendEmail,
  };
}

/** The settings (creditor data) a refused QR bill is missing, as a readable list ("IBAN, Strasse, PLZ"). */
export function qrMissingList(missing: string[] | undefined): string {
  const known = (missing ?? []).map((code) => tr(`invoiceEditor.qrMissing.${code}`));
  return known.join(', ');
}

/** Extracts `missing` from a 422 qr_bill_unavailable error (or null for any other error). */
export function qrBillError(err: unknown): { missing: string[]; message: string } | null {
  const e = err as { code?: string; message?: string; data?: { missing?: unknown } } | null;
  if (!e || e.code !== 'qr_bill_unavailable') return null;
  const missing = Array.isArray(e.data?.missing) ? (e.data!.missing as unknown[]).filter((m): m is string => typeof m === 'string') : [];
  return { missing, message: e.message ?? '' };
}
