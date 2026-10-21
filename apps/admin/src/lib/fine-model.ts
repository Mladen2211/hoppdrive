/**
 * Fines (Bussen): form state, validation (message keys), request bodies and small display helpers.
 *
 * Times are entered in Swiss time. A fine without a time of day ("Uhrzeit unbekannt") is sent as a
 * bare date ('YYYY-MM-DD'): the API then matches every booking that touches that day.
 */
import type { CreateFineRequest, FineDto, FineStatus } from '@hoppdrive/shared';
import { parseDecimal } from '@/lib/fee-model';
import { normalizePlate } from '@/lib/plate';
import { fmtZurichDate, fmtZurichDateTime, zurichParts, zurichToIso } from '@/lib/zurich';
import { tr } from '@/i18n/active';

export const FINE_STATUSES: FineStatus[] = ['NEW', 'ASSIGNED', 'FORWARDED', 'INVOICED', 'CLOSED'];

/** Status colour (StatusPill tone names). */
export const FINE_STATUS_TONE: Record<FineStatus, 'amber' | 'blue' | 'vio' | 'green' | 'gray'> = {
  NEW: 'amber',
  ASSIGNED: 'blue',
  FORWARDED: 'vio',
  INVOICED: 'green',
  CLOSED: 'gray',
};

export interface FineForm {
  licensePlate: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm or '' = unknown */
  time: string;
  place: string;
  authority: string;
  reference: string;
  amount: string;
  currency: 'CHF' | 'EUR';
  description: string;
  notes: string;
}

export type FineFormErrors = Partial<Record<'licensePlate' | 'date' | 'amount', string>>;

export const emptyFineForm = (currency: 'CHF' | 'EUR' = 'CHF'): FineForm => ({
  licensePlate: '',
  date: '',
  time: '',
  place: '',
  authority: '',
  reference: '',
  amount: '',
  currency,
  description: '',
  notes: '',
});

/** ISO instant (or bare date) for the API: Swiss wall time, or the date alone when the time is unknown. */
export function occurredAtFor(date: string, time: string): string {
  if (!date) return '';
  return time.trim() ? zurichToIso(date, time.trim()) : date;
}

/** True when the stored time is 00:00 Swiss time = "Uhrzeit unbekannt". */
export function isTimeUnknown(iso: string): boolean {
  return zurichParts(iso)?.time === '00:00';
}

export function fineToForm(fine: FineDto): FineForm {
  const parts = zurichParts(fine.occurredAt);
  return {
    licensePlate: fine.licensePlate,
    date: parts?.date ?? '',
    time: parts && parts.time !== '00:00' ? parts.time : '',
    place: fine.place,
    authority: fine.authority,
    reference: fine.reference,
    amount: String(fine.amount),
    currency: fine.currency === 'EUR' ? 'EUR' : 'CHF',
    description: fine.description,
    notes: fine.notes,
  };
}

export function validateFineForm(form: FineForm): FineFormErrors {
  const errors: FineFormErrors = {};
  if (normalizePlate(form.licensePlate).length < 2) errors.licensePlate = 'fines.errPlate';
  if (!form.date) errors.date = 'fines.errDate';
  else if (form.time.trim() && !zurichToIso(form.date, form.time.trim())) errors.date = 'fines.errDate';
  const amount = parseDecimal(form.amount);
  if (!Number.isFinite(amount) || amount < 0) errors.amount = 'fines.errAmount';
  return errors;
}

export function fineFormToRequest(form: FineForm): CreateFineRequest {
  return {
    licensePlate: form.licensePlate.trim(),
    occurredAt: occurredAtFor(form.date, form.time),
    place: form.place.trim(),
    authority: form.authority.trim(),
    reference: form.reference.trim(),
    amount: Math.round(parseDecimal(form.amount) * 100) / 100,
    currency: form.currency,
    description: form.description.trim(),
    notes: form.notes.trim(),
  };
}

/** '23.11.2026, 09:40' or '23.11.2026 (Uhrzeit unbekannt)'. */
export function fmtFineTime(iso: string): string {
  return isTimeUnknown(iso) ? `${fmtZurichDate(iso)} (${tr('fines.timeUnknownShort')})` : fmtZurichDateTime(iso);
}

/** Current status index for the progress display. */
export const fineStatusIndex = (status: FineStatus): number => FINE_STATUSES.indexOf(status);
