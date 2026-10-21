'use client';

/**
 * Interactive parts of the vehicle page: the price card (ladder, Von/Bis with a
 * live Richtpreis, CTA) and the sticky price/CTA bar on small screens. Both
 * share the chosen period through a small provider, and the CTA carries
 * vehicle and dates into the contact form:
 *   /?vehicle=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD#contact-form   (localised per language)
 */
import { useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { PriceLadder } from '@/components/b2c/PriceLadder';
import { Alert, Button, Field, Input, PricePill } from '@/components/ui';
import { useCurrency, useSiteFormatters } from '@/i18n/CurrencyProvider';
import { describeEstimate } from '@/lib/estimate';
import { daysBetween, parseDate, toInputDate } from '@/lib/format';
import { ladder, priceFor, type PricingTier } from '@/lib/pricing';

interface VehiclePricingValue {
  vehicleId: string;
  basePricePerDay: number;
  tiers: PricingTier[];
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  days: number | null;
  invalid: boolean;
  ctaHref: string;
}

const VehiclePricingContext = createContext<VehiclePricingValue | null>(null);

function usePricing() {
  const ctx = useContext(VehiclePricingContext);
  if (!ctx) throw new Error('Vehicle price components must be used within VehiclePricingProvider');
  return ctx;
}

export function VehiclePricingProvider({
  vehicleId,
  basePricePerDay,
  tiers,
  children,
}: {
  vehicleId: string;
  basePricePerDay: number;
  tiers: PricingTier[];
  children: ReactNode;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const value = useMemo<VehiclePricingValue>(() => {
    let days: number | null = null;
    let invalid = false;
    if (parseDate(from) && parseDate(to)) {
      const n = daysBetween(from, to, { inclusive: true });
      if (n < 1) invalid = true;
      else days = n;
    }
    const params = new URLSearchParams({ vehicle: vehicleId });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return {
      vehicleId,
      basePricePerDay,
      tiers,
      from,
      to,
      setFrom,
      setTo,
      days,
      invalid,
      ctaHref: `/?${params.toString()}#contact-form`,
    };
  }, [vehicleId, basePricePerDay, tiers, from, to]);

  return <VehiclePricingContext.Provider value={value}>{children}</VehiclePricingContext.Provider>;
}

interface VehicleBuyPanelProps {
  name: string;
  /** "Kombi · 2024" */
  meta: string;
  /** Spec line for small screens: "150 PS", "Automatik", ... */
  specLine: string[];
  available: boolean;
}

export function VehicleBuyPanel({ name, meta, specLine, available }: VehicleBuyPanelProps) {
  const t = useTranslations('vehiclePanel');
  const tEstimate = useTranslations('estimate');
  const tPricing = useTranslations('pricing');
  const f = useSiteFormatters();
  const currency = useCurrency();
  const { basePricePerDay, tiers, from, to, setFrom, setTo, days, invalid, ctaHref } = usePricing();
  const uid = useId();
  const [today, setToday] = useState('');
  useEffect(() => setToday(toInputDate(new Date())), []);

  const steps = ladder(basePricePerDay, tiers, tPricing);
  const result = days ? priceFor(basePricePerDay, days, tiers) : null;
  const text = describeEstimate({ t: tEstimate, locale: f.locale, currency, basePricePerDay, days, result, invalid });

  return (
    <aside
      aria-label={t('aria')}
      className="flex flex-col gap-5 lg:sticky lg:top-6 lg:rounded-20 lg:border lg:border-line lg:bg-white lg:p-7"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm text-graphite">{meta}</span>
        <h1 className="h2 !text-[36px] max-lg:!text-[30px]">{name}</h1>
        <ul className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-graphite lg:hidden">
          {specLine.map((spec) => (
            <li key={spec}>{spec}</li>
          ))}
        </ul>
      </div>

      {!available && (
        <Alert tone="warn" title={t('reservedTitle')}>
          {t('reservedText')}
        </Alert>
      )}

      <div className="flex items-baseline gap-2">
        <span className="text-graphite">{t('from')}</span>
        <b className="num text-[52px] font-bold leading-none max-lg:text-[46px]">
          {f.money(basePricePerDay, { decimals: 0 })}
        </b>
        <span className="text-graphite">{t('perDay')}</span>
      </div>

      <div className="flex flex-col gap-3.5 rounded-20 border border-line bg-white p-[18px] lg:gap-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
        <h2 className="h3 !text-lg lg:hidden">{t('ladderTitle')}</h2>

        {/* Small screens: the ladder as bars */}
        <PriceLadder tiers={tiers} basePricePerDay={basePricePerDay} compact className="lg:hidden" />

        {/* Desktop: the ladder as a table */}
        <table className="w-full border-collapse text-[15px] max-lg:hidden" aria-label={t('ladderTitle')}>
          <thead>
            <tr className="text-left text-graphite">
              <th scope="col" className="py-2 font-medium">
                {t('duration')}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t('discount')}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {t('perDayColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.fromDay} className="border-t border-line">
                <td className="py-2.5">{step.label}</td>
                <td>{step.discountPercent > 0 ? `${step.discountPercent} %` : '–'}</td>
                <td className="num text-right font-semibold">{f.money(step.pricePerDay)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('dateFrom')} htmlFor={`${uid}-from`}>
            <Input type="date" value={from} min={today || undefined} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field
            label={t('dateTo')}
            htmlFor={`${uid}-to`}
            error={invalid ? t('dateOrderError') : undefined}
          >
            <Input type="date" value={to} min={from || today || undefined} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>

        <PricePill
          live
          label={result && days ? tEstimate('labelForDays', { days }) : tEstimate('label')}
          price={text.price}
          sub={
            result && days
              ? t('averagePerDay', { price: f.money(result.perDay) })
              : invalid
                ? undefined
                : text.sub
          }
          className="!h-auto !py-3"
        />
      </div>

      <div className="flex flex-col gap-3 max-lg:hidden">
        <Button href={ctaHref} size="lg" fullWidth>
          {t('cta')}
        </Button>
        <p className="text-center text-sm leading-[1.45] text-graphite">{t('ctaNote')}</p>
      </div>
    </aside>
  );
}

/** Sticky "Ab CHF 79 / Tag" + "Anfragen" bar for screens below 1024 px. Place it after the footer. */
export function VehicleStickyCta() {
  const t = useTranslations('vehiclePanel');
  const f = useSiteFormatters();
  const { basePricePerDay, ctaHref } = usePricing();
  return (
    <div className="sticky bottom-0 z-[5] flex items-center gap-3 border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,.1)] lg:hidden">
      <div className="flex min-w-0 flex-col leading-[1.1]">
        <span className="text-sm text-graphite">{t('from')}</span>
        <b className="num text-[26px] font-bold">
          {f.money(basePricePerDay, { decimals: 0 })} {t('perDay')}
        </b>
      </div>
      <Button href={ctaHref} size="lg" className="min-w-0 flex-1">
        {t('stickyCta')}
      </Button>
    </div>
  );
}
