'use client';

/**
 * Busse erfassen / bearbeiten. Create can start from the lookup (plate, time and renter prefilled; the new
 * fine is then assigned to that booking) or blank. The document (PDF / JPG / PNG, <= 10 MB) is attached on
 * create; for an existing fine it is managed in the drawer.
 */
import { FileText, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { FineDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, IconButton, Input, Modal, Select, Textarea } from '@/components/ui';
import { FileDropzone } from '@/components/settings/FileDropzone';
import { api, type ApiError } from '@/lib/api';
import { fmtFileSize } from '@/lib/doc-pdf';
import { errorText } from '@/lib/errors';
import { toInputDate } from '@/lib/format';
import {
  emptyFineForm,
  fineFormToRequest,
  fineToForm,
  validateFineForm,
  type FineForm,
  type FineFormErrors,
} from '@/lib/fine-model';
import { formatPlate } from '@/lib/plate';
import { tr } from '@/i18n/active';
import type { FinePrefill } from './LookupCard';

const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

export interface FineSaveResult {
  fine: FineDto;
  created: boolean;
  /** The fine was assigned to the prefilled renter; false when that step failed after the fine was created. */
  assigned: boolean | null;
}

export function FineModal({
  fine,
  prefill,
  currency,
  onClose,
  onSaved,
}: {
  fine: FineDto | null;
  prefill?: FinePrefill | null;
  currency: 'CHF' | 'EUR';
  onClose: () => void;
  onSaved: (result: FineSaveResult) => void;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<FineForm>(() => {
    if (fine) return fineToForm(fine);
    const base = emptyFineForm(currency);
    return prefill
      ? { ...base, licensePlate: formatPlate(prefill.licensePlate), date: prefill.date, time: prefill.time }
      : { ...base, date: '' };
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FineFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidate = !fine ? prefill?.candidate : undefined;

  const set = (patch: Partial<FineForm>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateFineForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = fineFormToRequest(form);
      if (fine) {
        const updated = await api.updateFine(fine.id, body);
        onSaved({ fine: updated, created: false, assigned: null });
        return;
      }
      let created = await api.createFine(body, file ?? undefined);
      let assigned: boolean | null = null;
      if (candidate) {
        try {
          created = await api.assignFine(created.id, candidate.bookingId);
          assigned = true;
        } catch {
          assigned = false;
        }
      }
      onSaved({ fine: created, created: true, assigned });
    } catch (err) {
      const e = err as Partial<ApiError>;
      if (e.code === 'invalid_plate') setErrors({ licensePlate: tr('fines.errPlateFormat') });
      else if (e.status === 415) setError(tr('fines.documentUnsupported'));
      else setError(errorText(err, tr('fines.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fine ? t('fines.editTitle') : t('fines.addTitle')}
      description={candidate ? t('fines.addForRenter', { name: candidate.customerName }) : undefined}
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="fine-form" loading={saving}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id="fine-form" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}

        <div className="grid grid-cols-6 gap-3 max-sm:grid-cols-2">
          <Field label={t('fines.plate')} required error={errors.licensePlate ? t(errors.licensePlate) : undefined} className="col-span-2 max-sm:col-span-2">
            <Input
              value={form.licensePlate}
              onChange={(e) => set({ licensePlate: e.target.value.toUpperCase() })}
              onBlur={() => set({ licensePlate: form.licensePlate.trim() ? formatPlate(form.licensePlate) : '' })}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              placeholder="ZH 123 456"
              className="num uppercase"
              data-autofocus={!fine && !prefill ? true : undefined}
            />
          </Field>
          <Field label={t('fines.date')} required error={errors.date ? t(errors.date) : undefined} className="col-span-2 max-sm:col-span-1">
            <Input type="date" value={form.date} max={toInputDate(new Date())} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label={t('fines.time')} hint={t('fines.timeHint')} className="col-span-2 max-sm:col-span-1">
            <Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
          <Field label={t('fines.place')} className="col-span-6 max-sm:col-span-2">
            <Input value={form.place} onChange={(e) => set({ place: e.target.value })} maxLength={200} autoComplete="off" />
          </Field>
          <Field label={t('fines.authority')} className="col-span-3 max-sm:col-span-2">
            <Input value={form.authority} onChange={(e) => set({ authority: e.target.value })} maxLength={200} autoComplete="off" placeholder={t('fines.authorityPlaceholder')} />
          </Field>
          <Field label={t('fines.reference')} className="col-span-3 max-sm:col-span-2">
            <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={200} autoComplete="off" className="num" />
          </Field>
          <Field label={t('fines.amount')} required error={errors.amount ? t(errors.amount) : undefined} className="col-span-3 max-sm:col-span-1">
            <Input type="number" inputMode="decimal" min="0" step="0.05" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" className="num" />
          </Field>
          <Field label={t('fines.currency')} className="col-span-3 max-sm:col-span-1">
            <Select value={form.currency} onChange={(e) => set({ currency: e.target.value as 'CHF' | 'EUR' })}>
              <option value="CHF">CHF</option>
              <option value="EUR">EUR</option>
            </Select>
          </Field>
        </div>

        <Field label={t('fines.description')} hint={t('fines.descriptionHint')}>
          <Textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000} />
        </Field>
        <Field label={t('fines.notes')} hint={t('fines.notesHint')}>
          <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={4000} />
        </Field>

        {!fine && (
          <div className="flex flex-col gap-1.5">
            <span className="lbl">{t('fines.document')}</span>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <FileText size={20} aria-hidden="true" className="flex-none text-graphite" />
                <span className="min-w-0 flex-1 break-all text-sm">
                  {file.name} <span className="mut">· {fmtFileSize(file.size)}</span>
                </span>
                <IconButton aria-label={t('fines.removeFile')} onClick={() => setFile(null)}>
                  <X size={18} aria-hidden="true" />
                </IconButton>
              </div>
            ) : (
              <FileDropzone
                compact
                accept={DOCUMENT_ACCEPT}
                maxMb={10}
                title={t('fines.dropTitle')}
                hint={t('fines.dropHint')}
                wrongTypeText={t('fines.documentUnsupported')}
                onFile={setFile}
              />
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
