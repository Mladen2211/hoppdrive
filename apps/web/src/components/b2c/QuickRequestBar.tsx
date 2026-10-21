'use client';

/**
 * Quick-request bar under the hero: vehicle, Von, Bis, a live Richtpreis and
 * "Verfügbarkeit prüfen". It edits the shared selection (SelectedVehicleContext),
 * so what is entered here is already filled in when the visitor reaches the
 * contact form, which is where the button scrolls to.
 */
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, PricePill, Select } from '@/components/ui';
import { scrollToContactForm, useEstimate, useSelectedVehicle } from '@/components/b2c/SelectedVehicleContext';
import { useCurrency, useSiteFormatters } from '@/i18n/CurrencyProvider';
import { describeEstimate } from '@/lib/estimate';
import { toInputDate } from '@/lib/format';

export function QuickRequestBar() {
  const t = useTranslations('quick');
  const tEstimate = useTranslations('estimate');
  const f = useSiteFormatters();
  const currency = useCurrency();
  const { vehicles, selection, setVehicleId, setFrom, setTo } = useSelectedVehicle();
  const estimate = useEstimate();
  const ids = useId();
  // "Today" is computed after mount so server and client markup match.
  const [today, setToday] = useState('');
  useEffect(() => setToday(toInputDate(new Date())), []);

  const minPrice = vehicles.length > 0 ? Math.min(...vehicles.map((v) => v.basePricePerDay)) : null;
  const text = describeEstimate({
    t: tEstimate,
    locale: f.locale,
    currency,
    basePricePerDay: estimate.vehicle?.basePricePerDay ?? null,
    days: estimate.days,
    result: estimate.result,
    invalid: estimate.invalid,
    fallbackMin: minPrice,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    scrollToContactForm();
  }

  return (
    <form
      aria-label={t('ariaLabel')}
      onSubmit={submit}
      className="relative z-[2] mt-7 grid grid-cols-[1.5fr_1fr_1fr_1.15fr_auto] items-end gap-4 rounded-20 bg-white p-[22px] shadow-qbar max-lg:mt-6 max-lg:grid-cols-2 max-md:mt-5 max-md:grid-cols-1 max-md:gap-3.5 max-md:p-[18px] 3xl:grid-cols-[1.6fr_1fr_1fr_1.1fr_auto]"
    >
      <Field label={t('vehicle')} htmlFor={`${ids}-car`} className="max-lg:col-span-2 max-md:col-span-1">
        <Select
          value={selection.vehicleId ?? ''}
          onChange={(event) => setVehicleId(event.target.value || null)}
        >
          <option value="">{t('anyVehicle')}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {t('vehicleOption', { name: v.name, price: f.money(v.basePricePerDay, { decimals: 0 }) })}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('from')} htmlFor={`${ids}-from`}>
        <Input type="date" value={selection.from} min={today || undefined} onChange={(event) => setFrom(event.target.value)} />
      </Field>

      <Field
        label={t('to')}
        htmlFor={`${ids}-to`}
        error={estimate.invalid ? t('dateOrderError') : undefined}
      >
        <Input
          type="date"
          value={selection.to}
          min={selection.from || today || undefined}
          onChange={(event) => setTo(event.target.value)}
        />
      </Field>

      <div className="fld">
        <span className="fld-label">{text.label ?? tEstimate('label')}</span>
        <PricePill price={text.price} sub={estimate.invalid ? undefined : text.sub} live />
      </div>

      <div className="flex flex-col justify-end max-lg:col-span-1 max-md:col-span-1">
        <Button type="submit" size="lg" fullWidth className="max-lg:!h-13 max-lg:!min-h-[52px]">
          {t('cta')}
        </Button>
      </div>
    </form>
  );
}
