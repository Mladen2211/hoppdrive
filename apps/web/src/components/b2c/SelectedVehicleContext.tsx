'use client';

/**
 * Shared selection for the home page: which vehicle and which period the
 * visitor is interested in. It connects the quick-request bar, the fleet cards
 * ("Anfragen"), the price calculator ("Mit diesen Daten anfragen") and the
 * contact form (controlled, so a pre-selection always shows up in the fields).
 *
 * Off the home page every CTA is a plain link that carries the selection in the
 * URL: `/?vehicle=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD#contact-form`. The
 * provider reads those params with `useSearchParams` inside a Suspense
 * boundary, so the page stays statically rendered.
 *
 * `vehicleOfInterest` in the API payload stays the "Brand Model" string; the
 * selection itself is identified by the vehicle id (names are not unique).
 */
import { useSearchParams } from 'next/navigation';
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { daysBetween, parseDate, toInputDate } from '@/lib/format';
import { priceFor, type PriceResult, type PricingTier } from '@/lib/pricing';
import type { VehicleOption } from '@/lib/vehicles';

export interface VehicleSelection {
  vehicleId: string | null;
  /** "Brand Model" of the selected vehicle (what the API stores as vehicleOfInterest). */
  name: string | null;
  /** YYYY-MM-DD or '' */
  from: string;
  /** YYYY-MM-DD or '' */
  to: string;
  /** Duration hint from the price calculator while no dates are chosen yet. */
  days: number | null;
  /** true when the vehicle came from a card, the calculator or a link (not from the form's own select). */
  picked: boolean;
}

export interface SelectVehicleInput {
  vehicleId?: string | null;
  /** Legacy: pick by "Brand Model" name. */
  name?: string | null;
  from?: string;
  to?: string;
  days?: number | null;
}

interface SelectedVehicleContextType {
  vehicles: VehicleOption[];
  tiers: PricingTier[];
  selection: VehicleSelection;
  /** Legacy accessors */
  selectedVehicle: VehicleOption | null;
  selectVehicle: (input: string | SelectVehicleInput, options?: { scroll?: boolean }) => void;
  /** Manual change in a select (does not show the "übernommen" info). */
  setVehicleId: (id: string | null) => void;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  clearVehicle: () => void;
}

const SelectedVehicleContext = createContext<SelectedVehicleContextType | null>(null);

const EMPTY_SELECTION: VehicleSelection = {
  vehicleId: null,
  name: null,
  from: '',
  to: '',
  days: null,
  picked: false,
};

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null | undefined): string {
  return value && DATE_PARAM.test(value) && parseDate(value) ? value : '';
}

function addDays(date: string, amount: number): string {
  const d = parseDate(date);
  if (!d) return '';
  return toInputDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + amount));
}

/** Smooth scroll to the contact form (instant under prefers-reduced-motion) and move focus there. */
export function scrollToContactForm(): void {
  const el = document.getElementById('contact-form');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

export function SelectedVehicleProvider({
  vehicles = [],
  tiers,
  children,
}: {
  vehicles?: VehicleOption[];
  tiers: PricingTier[];
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<VehicleSelection>(EMPTY_SELECTION);

  const nameOf = useCallback(
    (id: string | null) => (id ? (vehicles.find((v) => v.id === id)?.name ?? null) : null),
    [vehicles],
  );

  const selectVehicle = useCallback<SelectedVehicleContextType['selectVehicle']>(
    (input, options) => {
      const data: SelectVehicleInput = typeof input === 'string' ? { name: input } : input;
      const byName = data.name ? vehicles.find((v) => v.name === data.name) : undefined;
      const id = data.vehicleId ?? byName?.id ?? null;
      setSelection((prev) => {
        const from = data.from !== undefined ? validDate(data.from) : prev.from;
        let to = data.to !== undefined ? validDate(data.to) : prev.to;
        let days = data.days !== undefined ? data.days : prev.days;
        // A duration from the calculator ("Mit diesen Daten anfragen") applies to an already chosen start.
        if (data.days && from && data.to === undefined) {
          to = addDays(from, data.days - 1);
          days = null;
        }
        return { vehicleId: id, name: nameOf(id) ?? data.name ?? null, from, to, days, picked: true };
      });
      if (options?.scroll !== false) {
        // Let React commit the new field values first, then scroll.
        requestAnimationFrame(() => scrollToContactForm());
      }
    },
    [vehicles, nameOf],
  );

  const setVehicleId = useCallback(
    (id: string | null) => setSelection((prev) => ({ ...prev, vehicleId: id, name: nameOf(id), picked: false })),
    [nameOf],
  );

  const setFrom = useCallback((value: string) => {
    setSelection((prev) => {
      // A duration chosen in the calculator completes the period as soon as the start is known.
      if (value && !prev.to && prev.days) {
        return { ...prev, from: value, to: addDays(value, prev.days - 1), days: null };
      }
      return { ...prev, from: value };
    });
  }, []);

  const setTo = useCallback((value: string) => setSelection((prev) => ({ ...prev, to: value })), []);

  const clearVehicle = useCallback(
    () => setSelection((prev) => ({ ...prev, vehicleId: null, name: null, days: null, picked: false })),
    [],
  );

  const applyUrl = useCallback(
    (params: { vehicle: string | null; from: string | null; to: string | null }) => {
      const vehicle = params.vehicle ? vehicles.find((v) => v.id === params.vehicle) : undefined;
      const from = validDate(params.from);
      const to = validDate(params.to);
      if (!vehicle && !from && !to) return;
      setSelection((prev) => ({
        vehicleId: vehicle ? vehicle.id : prev.vehicleId,
        name: vehicle ? vehicle.name : prev.name,
        from: from || prev.from,
        to: to || prev.to,
        days: null,
        picked: vehicle ? true : prev.picked,
      }));
      if (window.location.hash === '#contact-form') {
        requestAnimationFrame(() => scrollToContactForm());
      }
    },
    [vehicles],
  );

  const value = useMemo<SelectedVehicleContextType>(
    () => ({
      vehicles,
      tiers,
      selection,
      selectedVehicle: selection.vehicleId ? (vehicles.find((v) => v.id === selection.vehicleId) ?? null) : null,
      selectVehicle,
      setVehicleId,
      setFrom,
      setTo,
      clearVehicle,
    }),
    [vehicles, tiers, selection, selectVehicle, setVehicleId, setFrom, setTo, clearVehicle],
  );

  return (
    <SelectedVehicleContext.Provider value={value}>
      <Suspense fallback={null}>
        <SelectionFromUrl onApply={applyUrl} />
      </Suspense>
      {children}
    </SelectedVehicleContext.Provider>
  );
}

/** Reads `?vehicle=&from=&to=` (set by CTAs on other pages) once per change of the query string. */
function SelectionFromUrl({
  onApply,
}: {
  onApply: (params: { vehicle: string | null; from: string | null; to: string | null }) => void;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(query);
    onApply({ vehicle: params.get('vehicle'), from: params.get('from'), to: params.get('to') });
    // onApply changes with the vehicle list only; the query string is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return null;
}

export function useSelectedVehicle() {
  const ctx = useContext(SelectedVehicleContext);
  if (!ctx) throw new Error('useSelectedVehicle must be used within SelectedVehicleProvider');
  return ctx;
}

export interface Estimate {
  vehicle: VehicleOption | null;
  /** Rental days of the chosen period (or the calculator's hint); null when unknown. */
  days: number | null;
  /** Both dates are set but the end lies before the start. */
  invalid: boolean;
  /** Live Richtpreis, null while vehicle or period is missing. */
  result: PriceResult | null;
}

/** Live Richtpreis for the current selection (same maths as the API's PricingService). */
export function useEstimate(): Estimate {
  const { selection, selectedVehicle, tiers } = useSelectedVehicle();
  const { from, to, days: hint } = selection;

  return useMemo(() => {
    let days: number | null = null;
    let invalid = false;
    if (parseDate(from) && parseDate(to)) {
      const n = daysBetween(from, to, { inclusive: true });
      if (n < 1) invalid = true;
      else days = n;
    } else if (hint) {
      days = hint;
    }
    const result = selectedVehicle && days ? priceFor(selectedVehicle.basePricePerDay, days, tiers) : null;
    return { vehicle: selectedVehicle, days, invalid, result };
  }, [from, to, hint, selectedVehicle, tiers]);
}
