'use client';

/**
 * "Fahrerdaten" block shared by the new-booking dialog and the booking editor: Telefon, Strasse, PLZ,
 * Ort, Land (default CH), Geburtsdatum, Führerausweis-Nr. and Ausstellungsland. All fields are optional
 * here; the contract and authority requests use them when present.
 */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Field, Input } from '@/components/ui';
import { toInputDate } from '@/lib/format';
import type { DriverErrors, DriverField, DriverForm } from '@/lib/driver';

const COUNTRIES = ['CH', 'DE', 'AT', 'FR', 'IT', 'LI'];

export interface DriverFieldsProps {
  value: DriverForm;
  onChange: (patch: Partial<DriverForm>) => void;
  errors?: DriverErrors;
  disabled?: boolean;
  /** Replaces the default heading. */
  title?: string;
  /** Replaces the default hint ("all optional"); null hides it. */
  hint?: string | null;
  /** Fields marked as required (asterisk). Validation stays with the caller. */
  required?: readonly DriverField[];
}

export function DriverFields({ value, onChange, errors = {}, disabled, title, hint, required = [] }: DriverFieldsProps) {
  const t = useTranslations();
  const listId = useId();
  const set = (field: DriverField) => (e: { target: { value: string } }) => onChange({ [field]: e.target.value });
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4" disabled={disabled}>
      <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">{title ?? t('driver.title')}</legend>
      {hint !== null && <p className="sm mut -mt-1">{hint ?? t('driver.hint')}</p>}
      <div className="grid grid-cols-6 gap-3 max-sm:grid-cols-2">
        <Field label={t('common.telefon')} error={errors.phone} required={required.includes('phone')} className="col-span-3 max-sm:col-span-2">
          <Input type="tel" inputMode="tel" autoComplete="off" value={value.phone} onChange={set('phone')} placeholder="+41 79 123 45 67" />
        </Field>
        <Field label={t('driver.birthDate')} error={errors.birthDate} required={required.includes('birthDate')} className="col-span-3 max-sm:col-span-2">
          <Input type="date" value={value.birthDate} onChange={set('birthDate')} min="1900-01-01" max={toInputDate(new Date())} autoComplete="off" />
        </Field>
        <Field label={t('driver.street')} error={errors.street} required={required.includes('street')} className="col-span-6 max-sm:col-span-2">
          <Input value={value.street} onChange={set('street')} autoComplete="off" maxLength={120} />
        </Field>
        <Field label={t('driver.zip')} error={errors.zip} required={required.includes('zip')} className="col-span-2 max-sm:col-span-1">
          <Input value={value.zip} onChange={set('zip')} autoComplete="off" maxLength={20} className="num" />
        </Field>
        <Field label={t('driver.city')} error={errors.city} required={required.includes('city')} className="col-span-2 max-sm:col-span-1">
          <Input value={value.city} onChange={set('city')} autoComplete="off" maxLength={80} />
        </Field>
        <Field label={t('driver.country')} error={errors.country} required={required.includes('country')} className="col-span-2 max-sm:col-span-2">
          <Input value={value.country} onChange={set('country')} list={listId} autoComplete="off" maxLength={60} />
        </Field>
        <Field label={t('driver.licenseNumber')} error={errors.licenseNumber} required={required.includes('licenseNumber')} className="col-span-3 max-sm:col-span-2">
          <Input value={value.licenseNumber} onChange={set('licenseNumber')} autoComplete="off" maxLength={40} className="num" />
        </Field>
        <Field label={t('driver.licenseCountry')} error={errors.licenseCountry} required={required.includes('licenseCountry')} className="col-span-3 max-sm:col-span-2">
          <Input value={value.licenseCountry} onChange={set('licenseCountry')} list={listId} autoComplete="off" maxLength={60} />
        </Field>
      </div>
      <datalist id={listId}>
        {COUNTRIES.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
    </fieldset>
  );
}
