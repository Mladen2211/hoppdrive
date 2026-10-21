'use client';

/**
 * "Preis für Ihre Mietdauer": vehicle select, day slider (1 to 60), total and
 * average per day, computed with the day tiers (same maths as the API). The
 * button hands vehicle and duration over to the contact form.
 *
 * Variants: 'card' (pricing section) and 'sidebar' (sticky column next to the
 * fleet on ultra-wide screens, with the proof list under the button).
 */
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { Button, Field, Select, cn } from '@/components/ui';
import { useSelectedVehicle } from '@/components/b2c/SelectedVehicleContext';
import { useSiteFormatters } from '@/i18n/CurrencyProvider';
import { priceFor } from '@/lib/pricing';

interface PriceCalculatorProps {
  variant?: 'card' | 'sidebar';
  /** Reports the chosen vehicle's base price, so a ladder next to the calculator can follow it. */
  onVehicleChange?: (vehicleId: string | null) => void;
  className?: string;
}

export function PriceCalculator({ variant = 'card', onVehicleChange, className }: PriceCalculatorProps) {
  const t = useTranslations('calculator');
  const f = useSiteFormatters();
  const { vehicles, tiers, selection, selectVehicle } = useSelectedVehicle();
  const uid = useId();
  const [ownId, setOwnId] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  // The calculator's own pick, else the vehicle chosen elsewhere (quick bar, card), else the first one.
  const effectiveId =
    ownId ?? (selection.vehicleId && vehicles.some((v) => v.id === selection.vehicleId) ? selection.vehicleId : null) ?? vehicles[0]?.id ?? null;
  const vehicle = vehicles.find((v) => v.id === effectiveId) ?? null;

  // A vehicle chosen elsewhere (card, quick bar) becomes the calculator's vehicle too.
  useEffect(() => {
    if (selection.vehicleId) setOwnId(selection.vehicleId);
  }, [selection.vehicleId]);

  useEffect(() => {
    onVehicleChange?.(effectiveId);
  }, [effectiveId, onVehicleChange]);

  if (vehicles.length === 0 || !vehicle) {
    return (
      <div className={cn('card flex flex-col gap-3', className)}>
        <h3 className="h3">{t('title')}</h3>
        <p className="mut">{t('unavailable')}</p>
        <Button href="#contact-form" fullWidth>
          {t('cta')}
        </Button>
      </div>
    );
  }

  const result = priceFor(vehicle.basePricePerDay, days, tiers);
  const sidebar = variant === 'sidebar';
  const daysText = t('days', { days });

  return (
    <div
      className={cn(
        'flex flex-col gap-[18px] rounded-20 border border-line bg-white',
        sidebar ? 'p-7' : 'p-7 max-md:p-5',
        className,
      )}
    >
      <h3 className="h3">{t('title')}</h3>

      <Field label={t('vehicle')} htmlFor={`${uid}-car`}>
        <Select
          value={vehicle.id}
          onChange={(event) => {
            setOwnId(event.target.value);
          }}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {t('vehicleOption', { name: v.name, price: f.money(v.basePricePerDay, { decimals: 0 }) })}
            </option>
          ))}
        </Select>
      </Field>

      <div className="fld">
        <label htmlFor={`${uid}-days`} className="fld-label flex justify-between">
          <span>{t('duration')}</span>
          <b className="num text-xl">{daysText}</b>
        </label>
        <input
          id={`${uid}-days`}
          type="range"
          className="range"
          min={1}
          max={60}
          step={1}
          value={days}
          aria-valuetext={daysText}
          onChange={(event) => setDays(Number(event.target.value))}
        />
      </div>

      <div className="flex items-baseline justify-between border-t border-line pt-4" aria-live="polite" aria-atomic="true">
        <span className="mut">{t('total')}</span>
        <b className="num text-[40px] font-bold leading-none text-ruby-dark">{result ? f.money(result.total) : '–'}</b>
      </div>
      <p className="text-sm leading-[1.45] text-graphite">
        {result ? t('average', { price: f.money(result.perDay) }) : ''}
        {sidebar ? t('noteSidebar') : t('noteCard')}
      </p>

      <Button
        size={sidebar ? 'lg' : 'md'}
        fullWidth
        href="#contact-form"
        onClick={(event) => {
          event.preventDefault();
          selectVehicle({ vehicleId: vehicle.id, days });
        }}
      >
        {t('cta')}
      </Button>

      {sidebar && (
        <ul className="flex flex-col gap-2 pt-1 text-[15px] font-medium">
          {[t('proofFree'), t('proofCover')].map((text) => (
            <li key={text} className="flex items-center gap-2.5">
              <Check size={20} strokeWidth={2.4} className="flex-none text-ruby" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
