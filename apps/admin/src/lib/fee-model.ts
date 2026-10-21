/**
 * Fee catalog form (Einstellungen > Gebühren): string-typed form state, validation (message keys, the
 * view translates them) and the request body for POST /fees and PATCH /fees/:id.
 */
import type { CreateFeeRequest, FeeCategory, FeeDto } from '@hoppdrive/shared';

export interface FeeForm {
  name: string;
  category: FeeCategory;
  /** Number as typed ('150', '12.50'). */
  amount: string;
  /** '' = the VAT rate of the invoice settings. */
  vat: string;
  active: boolean;
}

export type FeeFormErrors = Partial<Record<'name' | 'amount' | 'vat', string>>;

export const EMPTY_FEE_FORM: FeeForm = { name: '', category: 'OTHER', amount: '', vat: '', active: true };

export function feeToForm(fee: FeeDto): FeeForm {
  return {
    name: fee.name,
    category: fee.category,
    amount: String(fee.defaultAmount),
    vat: fee.vatRate === null ? '' : String(fee.vatRate),
    active: fee.active,
  };
}

/** Accepts '12,5' as well as '12.5'. NaN when the text is not a number. */
export function parseDecimal(text: string): number {
  const normalised = text.trim().replace(',', '.');
  return normalised === '' ? NaN : Number(normalised);
}

export function validateFeeForm(form: FeeForm): FeeFormErrors {
  const errors: FeeFormErrors = {};
  if (!form.name.trim()) errors.name = 'fees.errName';
  const amount = parseDecimal(form.amount);
  if (!Number.isFinite(amount) || amount < 0) errors.amount = 'fees.errAmount';
  if (form.vat.trim() !== '') {
    const vat = parseDecimal(form.vat);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) errors.vat = 'fees.errVat';
  }
  return errors;
}

export function feeFormToRequest(form: FeeForm): CreateFeeRequest {
  const amount = Math.round(parseDecimal(form.amount) * 100) / 100;
  return {
    name: form.name.trim(),
    category: form.category,
    defaultAmount: amount,
    vatRate: form.vat.trim() === '' ? null : parseDecimal(form.vat),
    active: form.active,
  };
}
