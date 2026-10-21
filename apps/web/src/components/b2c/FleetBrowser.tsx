'use client';

import { SearchX, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/b2c/EmptyState';
import { VehicleGrid } from '@/components/b2c/VehicleGrid';
import { Button, Chip, Field, Select, Sheet, Switch, cn } from '@/components/ui';
import { useSiteFormatters } from '@/i18n/CurrencyProvider';
import type { PricingTier } from '@/lib/pricing';
import { translateFuel } from '@/lib/seo';
import type { VehicleCardData } from '@/lib/vehicles';

/**
 * Fleet list with client-side filters (Antrieb, Sitzplätze, Max. Preis, Nur
 * verfügbare), sorting, the "x von y Fahrzeugen" line and "Weitere N Fahrzeuge
 * laden" (9 per step). Desktop: filter column; mobile/tablet: "Filter" button
 * that opens a bottom sheet.
 *
 * All matching cards are rendered; the ones beyond the current page are only
 * hidden (display: none), so every vehicle page stays linked in the HTML.
 */

const PAGE_SIZE = 9;
const FUEL_ORDER = ['petrol', 'diesel', 'hybrid', 'electric'];

interface Filters {
  fuels: string[];
  /** 0 = egal, otherwise minimum number of seats */
  seats: number;
  maxPrice: number;
  onlyAvailable: boolean;
}

type SortKey = 'price-asc' | 'price-desc' | 'name';

const SORT_KEYS: { value: SortKey; messageKey: string }[] = [
  { value: 'price-asc', messageKey: 'sortPriceAsc' },
  { value: 'price-desc', messageKey: 'sortPriceDesc' },
  { value: 'name', messageKey: 'sortName' },
];

const nameOf = (v: VehicleCardData) => `${v.brand} ${v.model}`;

function applyFilters(list: VehicleCardData[], f: Filters): VehicleCardData[] {
  return list.filter(
    (v) =>
      (f.fuels.length === 0 || f.fuels.includes(v.specs.fuelType)) &&
      (f.seats === 0 || v.specs.seats >= f.seats) &&
      v.basePricePerDay <= f.maxPrice &&
      (!f.onlyAvailable || (v.availableNow ?? v.isAvailable ?? true)),
  );
}

function sortList(list: VehicleCardData[], sort: SortKey, locale: string): VehicleCardData[] {
  const copy = [...list];
  if (sort === 'name') return copy.sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale));
  const dir = sort === 'price-asc' ? 1 : -1;
  return copy.sort((a, b) => dir * (a.basePricePerDay - b.basePricePerDay) || nameOf(a).localeCompare(nameOf(b), locale));
}

interface FilterPanelProps {
  value: Filters;
  onChange: (next: Filters) => void;
  bounds: { min: number; max: number };
  fuelCounts: { fuel: string; count: number }[];
  seatOptions: { value: number; label: string }[];
  layout: 'sidebar' | 'sheet';
}

function FilterPanel({ value, onChange, bounds, fuelCounts, seatOptions, layout }: FilterPanelProps) {
  const t = useTranslations('browser');
  const tLabels = useTranslations('labels');
  const f = useSiteFormatters();
  const uid = useId();
  const sheet = layout === 'sheet';
  const toggleFuel = (fuel: string) =>
    onChange({
      ...value,
      fuels: value.fuels.includes(fuel) ? value.fuels.filter((fuelType) => fuelType !== fuel) : [...value.fuels, fuel],
    });

  return (
    <>
      {fuelCounts.length > 1 && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className="fld-label mb-2 p-0">{t('fuel')}</legend>
          {sheet ? (
            <div className="chips">
              {fuelCounts.map(({ fuel }) => (
                <Chip key={fuel} pressed={value.fuels.includes(fuel)} onClick={() => toggleFuel(fuel)}>
                  {translateFuel(fuel, tLabels)}
                </Chip>
              ))}
            </div>
          ) : (
            fuelCounts.map(({ fuel, count }) => (
              <label key={fuel} className="chk min-h-11 items-center">
                <input type="checkbox" checked={value.fuels.includes(fuel)} onChange={() => toggleFuel(fuel)} />
                <span>
                  {translateFuel(fuel, tLabels)} <span className="mut">({count})</span>
                </span>
              </label>
            ))
          )}
        </fieldset>
      )}

      {seatOptions.length > 1 &&
        (sheet ? (
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="fld-label mb-1.5 p-0">{t('seats')}</legend>
            <div className="chips">
              {seatOptions.map((option) => (
                <Chip
                  key={option.value}
                  pressed={value.seats === option.value}
                  onClick={() => onChange({ ...value, seats: option.value })}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        ) : (
          <Field label={t('seats')} htmlFor={`${uid}-seats`}>
            <Select value={value.seats} onChange={(event) => onChange({ ...value, seats: Number(event.target.value) })}>
              {seatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ))}

      {bounds.max > bounds.min && (
        <div className="fld">
          <label htmlFor={`${uid}-price`} className="fld-label flex justify-between">
            <span>{t('maxPrice')}</span>
            <b className="num text-lg">{f.money(value.maxPrice, { decimals: 0 })}</b>
          </label>
          <input
            id={`${uid}-price`}
            type="range"
            className="range"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={value.maxPrice}
            aria-valuetext={t('maxPriceValue', { price: f.money(value.maxPrice, { decimals: 0 }) })}
            onChange={(event) => onChange({ ...value, maxPrice: Number(event.target.value) })}
          />
          {!sheet && (
            <div className="hint flex justify-between">
              <span>{f.money(bounds.min, { decimals: 0 })}</span>
              <span>{f.money(bounds.max, { decimals: 0 })}</span>
            </div>
          )}
        </div>
      )}

      <Switch
        labelPosition="left"
        label={t('onlyAvailable')}
        checked={value.onlyAvailable}
        onChange={(checked) => onChange({ ...value, onlyAvailable: checked })}
      />
    </>
  );
}

interface FleetBrowserProps {
  vehicles: VehicleCardData[];
  tiers: PricingTier[];
  /** Server-rendered category links for the sticky bar on small screens. */
  chips?: ReactNode;
}

export function FleetBrowser({ vehicles, tiers, chips }: FleetBrowserProps) {
  const t = useTranslations('browser');
  const f = useSiteFormatters();
  const uid = useId();
  const bounds = useMemo(() => {
    const prices = vehicles.map((v) => v.basePricePerDay);
    return prices.length > 0 ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : { min: 0, max: 0 };
  }, [vehicles]);

  const initial = useMemo<Filters>(
    () => ({ fuels: [], seats: 0, maxPrice: bounds.max, onlyAvailable: false }),
    [bounds.max],
  );

  const fuelCounts = useMemo(
    () =>
      FUEL_ORDER.map((fuel) => ({ fuel, count: vehicles.filter((v) => v.specs.fuelType === fuel).length })).filter(
        (entry) => entry.count > 0,
      ),
    [vehicles],
  );

  const seatOptions = useMemo(() => {
    const maxSeats = vehicles.reduce((max, v) => Math.max(max, v.specs.seats), 0);
    const options = [{ value: 0, label: t('seatsAny') }];
    if (maxSeats >= 5) options.push({ value: 5, label: t('seatsFive') });
    if (maxSeats >= 7) options.push({ value: 7, label: t('seatsSeven') });
    return options;
  }, [vehicles, t]);

  const [filters, setFilters] = useState<Filters>(initial);
  const [draft, setDraft] = useState<Filters>(initial);
  const [sort, setSort] = useState<SortKey>('price-asc');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => sortList(applyFilters(vehicles, filters), sort, f.locale),
    [vehicles, filters, sort, f.locale],
  );
  const draftCount = useMemo(() => applyFilters(vehicles, draft).length, [vehicles, draft]);
  const shown = Math.min(visible, results.length);
  const remaining = results.length - shown;

  const activeCount =
    (filters.fuels.length > 0 ? 1 : 0) +
    (filters.seats > 0 ? 1 : 0) +
    (filters.maxPrice < bounds.max ? 1 : 0) +
    (filters.onlyAvailable ? 1 : 0);

  // After "Weitere laden" focus moves to the first newly shown card.
  useEffect(() => {
    if (pendingFocus === null) return;
    const card = gridRef.current?.querySelectorAll('article')[pendingFocus];
    card?.querySelector<HTMLElement>('h3 a')?.focus();
    setPendingFocus(null);
  }, [pendingFocus, visible]);

  function changeFilters(next: Filters) {
    setFilters(next);
    setVisible(PAGE_SIZE);
  }

  function resetFilters() {
    changeFilters(initial);
  }

  function openSheet() {
    setDraft(filters);
    setSheetOpen(true);
  }

  function loadMore() {
    setPendingFocus(shown);
    setVisible((n) => n + PAGE_SIZE);
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<SearchX size={34} />}
        title={t('emptyAllTitle')}
        text={t('emptyAllText')}
        actions={<Button href="/#contact-form">{t('emptyAllCta')}</Button>}
      />
    );
  }

  const sortSelect = (id: string, className?: string) => (
    <select
      id={id}
      className={cn('in', className)}
      value={sort}
      aria-label={t('sortLabel')}
      onChange={(event) => {
        setSort(event.target.value as SortKey);
        setVisible(PAGE_SIZE);
      }}
    >
      {SORT_KEYS.map((option) => (
        <option key={option.value} value={option.value}>
          {t(option.messageKey)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-8 max-lg:grid-cols-1">
      {/* Desktop: filter column */}
      <aside className="card sticky top-6 flex flex-col gap-6 !p-6 max-lg:hidden" aria-label={t('filterTitle')}>
        <div className="flex items-center justify-between">
          <h2 className="h3">{t('filterTitle')}</h2>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ruby-dark underline underline-offset-2"
          >
            {t('reset')}
          </button>
        </div>
        <FilterPanel
          layout="sidebar"
          value={filters}
          onChange={changeFilters}
          bounds={bounds}
          fuelCounts={fuelCounts}
          seatOptions={seatOptions}
        />
      </aside>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Mobile/tablet: sticky category chips + Filter + Sort */}
        <div className="sticky top-0 z-[5] -mx-5 flex flex-col gap-3 border-b border-line-soft bg-paper px-5 py-3 md:-mx-8 md:px-8 lg:hidden">
          {chips}
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={openSheet} iconLeft={<SlidersHorizontal size={20} aria-hidden="true" />}>
              {t('filterTitle')}
              {activeCount > 0 && (
                <span className="badge b-ruby !h-[22px] !px-2" aria-label={t('activeFilters', { count: activeCount })}>
                  {activeCount}
                </span>
              )}
            </Button>
            {sortSelect(`${uid}-sort-m`, '!h-12')}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p aria-live="polite">
            {t.rich('count', {
              shown,
              total: results.length,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
          <div className="flex items-center gap-2.5 max-lg:hidden">
            <label htmlFor={`${uid}-sort`} className="fld-label">
              {t('sortLabel')}
            </label>
            {sortSelect(`${uid}-sort`, '!h-11 !w-auto')}
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState
            icon={<SearchX size={34} />}
            title={t('emptyFilterTitle')}
            text={t('emptyFilterText')}
            actions={<Button onClick={resetFilters}>{t('emptyFilterCta')}</Button>}
          />
        ) : (
          <div ref={gridRef}>
            <VehicleGrid
              vehicles={results}
              tiers={tiers}
              columns="browse"
              priorityCount={3}
              cardClassName={(index) => (index >= visible ? 'hidden' : undefined)}
            />
          </div>
        )}

        {remaining > 0 && (
          <div className="flex justify-center pt-3 max-md:[&>*]:w-full">
            <Button variant="outline" size="lg" onClick={loadMore}>
              {t('loadMore', { count: Math.min(PAGE_SIZE, remaining) })}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile/tablet: filters as a bottom sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('filterTitle')}
        headerAction={
          <button
            type="button"
            onClick={() => setDraft(initial)}
            className="inline-flex min-h-11 items-center font-semibold text-ruby-dark underline underline-offset-2"
          >
            {t('reset')}
          </button>
        }
        footer={
          <>
            <Button variant="outline" className="!flex-none" onClick={() => setSheetOpen(false)}>
              {t('sheetCancel')}
            </Button>
            <Button
              size="lg"
              onClick={() => {
                changeFilters(draft);
                setSheetOpen(false);
              }}
            >
              {t('sheetShow', { count: draftCount })}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[18px]">
          <FilterPanel
            layout="sheet"
            value={draft}
            onChange={setDraft}
            bounds={bounds}
            fuelCounts={fuelCounts}
            seatOptions={seatOptions}
          />
        </div>
      </Sheet>
    </div>
  );
}
