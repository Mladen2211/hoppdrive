'use client';

/**
 * Step "Fahrerdaten": the renter checks name, phone, address, date of birth and driving licence before
 * signing. Prefilled from the booking; address, date of birth and licence number are required for the
 * contract. Saved with PATCH /bookings/:id, then the contract preview is loaded again so the contract shows
 * the new data.
 */
import type { ContractPreviewDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { DriverFields } from '@/components/booking/DriverFields';
import { ApiError, api } from '@/lib/api';
import {
  DEFAULT_DRIVER_COUNTRY,
  driverEquals,
  driverErrorsFromApi,
  driverFromBooking,
  driverUpdatePayload,
  validateDriver,
  type DriverErrors,
  type DriverField,
  type DriverForm,
} from '@/lib/driver';
import { errorText } from '@/lib/errors';

const REQUIRED: readonly DriverField[] = ['street', 'zip', 'city', 'birthDate', 'licenseNumber'];
const BIG_BUTTON = 'min-h-[52px] text-base';

export interface DriverStepProps {
  preview: ContractPreviewDto;
  onBack: () => void;
  /** The data is saved (or unchanged): continue with the fresh contract preview. */
  onDone: (preview: ContractPreviewDto) => void;
}

export function DriverStep({ preview, onBack, onDone }: DriverStepProps) {
  const t = useTranslations();
  const initial = useRef<{ name: string; driver: DriverForm }>({
    name: preview.booking.customerName,
    driver: (() => {
      const d = driverFromBooking(preview.booking);
      return { ...d, country: d.country || DEFAULT_DRIVER_COUNTRY };
    })(),
  });
  const [name, setName] = useState(initial.current.name);
  const [driver, setDriver] = useState<DriverForm>(initial.current.driver);
  const [errors, setErrors] = useState<DriverErrors>({});
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const focusFirstInvalid = () =>
    window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found: DriverErrors = validateDriver(driver);
    for (const field of REQUIRED) {
      if (!driver[field].trim() && !found[field]) found[field] = t('sign.driverRequired');
    }
    const missingName = !name.trim() ? t('sign.driverRequired') : undefined;
    setErrors(found);
    setNameError(missingName);
    setFormError(null);
    if (missingName || Object.keys(found).length > 0) {
      setFormError(t('sign.driverFixErrors'));
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      const unchanged = name.trim() === initial.current.name.trim() && driverEquals(driver, initial.current.driver);
      if (!unchanged) {
        await api.updateBooking(preview.booking.id, { customerName: name.trim(), ...driverUpdatePayload(driver) });
      }
      const fresh = await api.getContractPreview(preview.booking.id);
      onDone(fresh);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.details) {
        setErrors(driverErrorsFromApi(err.details));
        if (err.details.customerName) setNameError(t('sign.driverRequired'));
        setFormError(t('sign.driverFixErrors'));
        focusFirstInvalid();
      } else {
        setFormError(errorText(err, t('sign.driverSaveFailed')));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-4 p-5" aria-labelledby="driver-h">
      <div>
        <h2 className="h2" id="driver-h">
          {t('sign.stepDriver')}
        </h2>
        <p className="mut mt-1">{t('sign.driverIntro')}</p>
      </div>
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="err">{formError}</Alert>}
        <Field label={t('sign.driverName')} error={nameError} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={120} disabled={saving} />
        </Field>
        <DriverFields
          value={driver}
          onChange={(patch) => setDriver((d) => ({ ...d, ...patch }))}
          errors={errors}
          disabled={saving}
          hint={t('sign.driverHint')}
          required={REQUIRED}
        />
        <div className="flex flex-col-reverse gap-2.5 border-t border-line-soft pt-4 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onBack} disabled={saving} className={BIG_BUTTON}>
            {t('common.zurueck')}
          </Button>
          <Button type="submit" loading={saving} className={BIG_BUTTON}>
            {t('sign.driverNext')}
          </Button>
        </div>
      </form>
    </section>
  );
}
