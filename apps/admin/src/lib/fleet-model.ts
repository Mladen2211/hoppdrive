/**
 * Pure helpers for the Flotte page: German labels, the "Stand" of a vehicle today, the edit form
 * (conversion, validation, API payload), the price-tier preview and the maintenance timeline.
 */
import type { PricingTierDto, TranslatableLocale, Translations, VehicleTranslation } from '@hoppdrive/shared';
import { daysBetween, fmtDate, fmtDateShort, fmtNumber, parseDate, toInputDate } from '@/lib/format';
import { formatPlate } from '@/lib/plate';
import { cleanTranslations, TRANSLATABLE_LOCALES } from '@/lib/translations';
import { tr } from '@/i18n/active';

// ─── Types ──────────────────────────────────────────────────────

export interface FleetImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary?: boolean;
}

export interface FleetVehicle {
  id: string;
  brand: string;
  model: string;
  type: string;
  year: number;
  basePricePerDay: number;
  /** ISO currency code of the price (CHF / EUR); follows the currency setting. */
  currency?: string;
  isAvailable: boolean;
  description?: string | null;
  /** Normalised plate (ZH123456). */
  licensePlate?: string | null;
  /** { en: { description }, ... } (admin endpoints only). */
  translations?: Translations<VehicleTranslation> | null;
  images: FleetImage[];
  specs: {
    horsepower: number;
    transmission: string;
    seats: number;
    fuelType: string;
    range?: string | null;
  };
  updatedAt?: string;
}

export interface FleetBooking {
  id: string;
  vehicleId: string;
  status: string;
  startDate: string;
  endDate: string;
  customerName?: string;
}

export interface FleetMaintenance {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string | null;
}

// ─── Labels ─────────────────────────────────────────────────────

export const VEHICLE_TYPES = ['sedan', 'suv', 'estate', 'coupe', 'convertible', 'electric', 'van'] as const;
export const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid'] as const;
export const TRANSMISSIONS = ['automatic', 'manual'] as const;
export const MAINTENANCE_REASONS = ['repair', 'accident', 'other'] as const;

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  get sedan() { return tr('fleetModel.limousine'); },
  suv: 'SUV',
  get estate() { return tr('fleetModel.kombi'); },
  get coupe() { return tr('fleetModel.coupe'); },
  get convertible() { return tr('fleetModel.cabrio'); },
  get electric() { return tr('fleetModel.elektro'); },
  get van() { return tr('fleetModel.van'); },
};
export const FUEL_TYPE_LABELS: Record<string, string> = {
  get petrol() { return tr('fleetModel.benzin'); },
  get diesel() { return tr('fleetModel.diesel'); },
  get electric() { return tr('fleetModel.elektrisch'); },
  get hybrid() { return tr('fleetModel.hybrid'); },
};
export const TRANSMISSION_LABELS: Record<string, string> = {
  get automatic() { return tr('fleetModel.automatik'); },
  get manual() { return tr('fleetModel.schaltgetriebe'); },
};
export const MAINTENANCE_REASON_LABELS: Record<string, string> = {
  get repair() { return tr('fleetModel.reparatur'); },
  get accident() { return tr('fleetModel.unfall'); },
  get other() { return tr('fleetModel.sonstiges'); },
};

/** The image shown as the vehicle's face: the primary image, else the first one. */
export function primaryImage<T extends { isPrimary?: boolean }>(images: T[] | undefined | null): T | undefined {
  if (!images || images.length === 0) return undefined;
  return images.find((i) => i.isPrimary) ?? images[0];
}

/** 'Škoda Kodiaq' */
export const vehicleName = (v: Pick<FleetVehicle, 'brand' | 'model'>): string => `${v.brand} ${v.model}`;

/** 'Kombi · Diesel · 5 Sitze' */
export function vehicleMeta(v: FleetVehicle): string {
  return [
    VEHICLE_TYPE_LABELS[v.type] ?? v.type,
    FUEL_TYPE_LABELS[v.specs.fuelType] ?? v.specs.fuelType,
    `${v.specs.seats} ${tr('fleetModel.sitzN', { count: Number(v.specs.seats) })}`,
  ].join(' · ');
}

// ─── Images ─────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

/**
 * Uploaded images are stored as relative '/uploads/<file>' paths that the API serves at its own
 * origin (the admin app does not proxy /uploads), so they are made absolute here.
 */
export function imageSrc(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  try {
    return new URL(url, new URL(API_BASE).origin).toString();
  } catch {
    return url;
  }
}

// ─── Stand (status today) ───────────────────────────────────────

export type FleetState = 'available' | 'rented' | 'reserved' | 'maintenance';
export type FleetFilter = 'all' | FleetState;

const inRange = (todayKey: string, start: string, end: string) => {
  const s = toInputDate(start);
  const e = toInputDate(end);
  return Boolean(s && e) && s <= todayKey && todayKey <= e;
};

/**
 * Wartung today -> "Wartung"; an active booking (picked up, not returned) -> "Vermietet"; a reserved
 * booking that covers today -> "Reserviert"; otherwise "Verfügbar". Cancelled bookings never count.
 */
export function vehicleState(
  vehicleId: string,
  bookings: FleetBooking[],
  maintenance: FleetMaintenance[],
  todayKey: string = toInputDate(new Date()),
): FleetState {
  if (maintenance.some((m) => m.vehicleId === vehicleId && inRange(todayKey, m.startDate, m.endDate))) return 'maintenance';
  const own = bookings.filter((b) => b.vehicleId === vehicleId);
  if (own.some((b) => b.status === 'active')) return 'rented';
  if (own.some((b) => b.status === 'reserved' && inRange(todayKey, b.startDate, b.endDate))) return 'reserved';
  return 'available';
}

/** Open = reserved or active. */
export function openBookingCount(vehicleId: string, bookings: FleetBooking[]): number {
  return bookings.filter((b) => b.vehicleId === vehicleId && (b.status === 'reserved' || b.status === 'active')).length;
}

export function allBookingCount(vehicleId: string, bookings: FleetBooking[]): number {
  return bookings.filter((b) => b.vehicleId === vehicleId).length;
}

// ─── Form ───────────────────────────────────────────────────────

export interface VehicleForm {
  brand: string;
  model: string;
  type: string;
  fuelType: string;
  seats: string;
  transmission: string;
  year: string;
  horsepower: string;
  range: string;
  price: string;
  description: string;
  /** Kennzeichen as typed ("ZH 123 456"); the server stores it normalised. */
  licensePlate: string;
  /** Description per language (German is `description`). */
  translations: Record<TranslatableLocale, string>;
  isAvailable: boolean;
}

export type FormField = keyof VehicleForm;
export type FormErrors = Partial<Record<FormField, string>>;

export const emptyForm = (): VehicleForm => ({
  brand: '',
  model: '',
  type: VEHICLE_TYPES[0],
  fuelType: FUEL_TYPES[0],
  seats: '5',
  transmission: TRANSMISSIONS[0],
  year: String(new Date().getFullYear()),
  horsepower: '',
  range: '',
  price: '',
  description: '',
  licensePlate: '',
  translations: { en: '', fr: '', it: '', hr: '' },
  isAvailable: true,
});

const translationsToForm = (t: Translations<VehicleTranslation> | null | undefined): Record<TranslatableLocale, string> => ({
  en: t?.en?.description ?? '',
  fr: t?.fr?.description ?? '',
  it: t?.it?.description ?? '',
  hr: t?.hr?.description ?? '',
});

export const toForm = (v: FleetVehicle): VehicleForm => ({
  brand: v.brand,
  model: v.model,
  type: v.type,
  fuelType: v.specs.fuelType,
  seats: String(v.specs.seats),
  transmission: v.specs.transmission,
  year: String(v.year),
  horsepower: String(v.specs.horsepower),
  range: v.specs.range ?? '',
  price: v.basePricePerDay != null ? Number(v.basePricePerDay).toFixed(2) : '',
  description: v.description ?? '',
  licensePlate: v.licensePlate ? formatPlate(v.licensePlate) : '',
  translations: translationsToForm(v.translations),
  isAvailable: v.isAvailable,
});

export const hasRange = (fuelType: string) => fuelType === 'electric' || fuelType === 'hybrid';

export function isDirty(a: VehicleForm, b: VehicleForm): boolean {
  const norm = (f: VehicleForm) => ({
    ...f,
    brand: f.brand.trim(),
    model: f.model.trim(),
    range: hasRange(f.fuelType) ? f.range.trim() : '',
    description: f.description.trim(),
    licensePlate: f.licensePlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
    translations: TRANSLATABLE_LOCALES.map((l) => f.translations[l].trim()),
    price: f.price.trim() === '' ? '' : String(Number(f.price)),
  });
  return JSON.stringify(norm(a)) !== JSON.stringify(norm(b));
}

export const maxYear = () => new Date().getFullYear() + 2;
export const MIN_YEAR = 1990;

/** Field messages; the first failing rule per field. Mirrors the API's createVehicleSchema. */
export function validateForm(form: VehicleForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.brand.trim()) errors.brand = tr('fleetModel.bitteGebenSieDie');
  if (!form.model.trim()) errors.model = tr('fleetModel.bitteGebenSieDas');

  const year = Number(form.year);
  if (form.year.trim() === '' || !Number.isInteger(year)) errors.year = tr('fleetModel.bitteGebenSieDas2');
  else if (year < MIN_YEAR || year > maxYear()) errors.year = tr('fleetModel.dasBaujahrMussZwischen', { MIN_YEAR, maxYear: maxYear() });

  const hp = Number(form.horsepower);
  if (form.horsepower.trim() === '' || !Number.isInteger(hp)) errors.horsepower = tr('fleetModel.bitteGebenSieDie2');
  else if (hp < 0) errors.horsepower = tr('fleetModel.dieLeistungDarfNicht');

  const seats = Number(form.seats);
  if (form.seats.trim() === '' || !Number.isInteger(seats)) errors.seats = tr('fleetModel.bitteGebenSieDie3');
  else if (seats < 1 || seats > 12) errors.seats = tr('fleetModel.esSind1Bis');

  const price = Number(form.price);
  if (form.price.trim() === '' || Number.isNaN(price)) errors.price = tr('fleetModel.gebenSieEinenPreis');
  else if (price <= 0) errors.price = tr('fleetModel.derPreisMussGroesser');

  if (form.description.length > 5000) errors.description = tr('fleetModel.dieBeschreibungDarfHoechstens');
  if (form.licensePlate.trim().length > 20) errors.licensePlate = tr('fleetModel.plateTooLong');
  return errors;
}

/** '540' -> '540 km'; free text such as 'ca. 540 km' is kept as typed. */
export function normalizeRange(range: string): string {
  const text = range.trim();
  return /^\d+([.,]\d+)?$/.test(text) ? `${text} km` : text;
}

/**
 * Payload for POST/PATCH /vehicles. The API stores the range as text ("540 km"); the old form sent a
 * number, which the server rejected (422) without anyone noticing. Without a range, it is cleared.
 */
export function toPayload(form: VehicleForm) {
  const range = hasRange(form.fuelType) ? normalizeRange(form.range) : '';
  return {
    brand: form.brand.trim(),
    model: form.model.trim(),
    type: form.type,
    year: Number(form.year),
    basePricePerDay: Number(form.price),
    description: form.description.trim() ? form.description.trim() : null,
    licensePlate: form.licensePlate.trim() ? form.licensePlate.trim() : null,
    // null clears the translations (no language has a text any more)
    translations: cleanTranslations({
      en: { description: form.translations.en },
      fr: { description: form.translations.fr },
      it: { description: form.translations.it },
      hr: { description: form.translations.hr },
    }) as Translations<VehicleTranslation> | null,
    isAvailable: form.isAvailable,
    specs: {
      horsepower: Number(form.horsepower),
      transmission: form.transmission,
      seats: Number(form.seats),
      fuelType: form.fuelType,
      ...(range ? { range } : {}),
    },
  };
}

const FIELD_BY_PATH: Record<string, FormField> = {
  brand: 'brand',
  model: 'model',
  type: 'type',
  year: 'year',
  basePricePerDay: 'price',
  description: 'description',
  licensePlate: 'licensePlate',
  'specs.horsepower': 'horsepower',
  'specs.transmission': 'transmission',
  'specs.seats': 'seats',
  'specs.fuelType': 'fuelType',
  'specs.range': 'range',
};

/** Maps a 422 `details` object ({ 'specs.seats': ['…'] }) to field messages in German. */
export function errorsFromApi(details: Record<string, string[]> | undefined): FormErrors {
  const errors: FormErrors = {};
  if (!details) return errors;
  for (const path of Object.keys(details)) {
    const field = FIELD_BY_PATH[path];
    if (field) errors[field] = tr('fleetModel.bittePruefenSieDiese');
  }
  return errors;
}

// ─── Price preview ──────────────────────────────────────────────

export interface TierBox {
  key: string;
  label: string;
  /** Price per day, '–' while the base price is not a number */
  price: string;
  /** '−20 %' or '' */
  discount: string;
}

/**
 * The tier boxes below the base price: 'Tag 1–7 89.00', 'Tag 8–30 71.20 −20 %', 'ab Tag 31 53.40 −40 %'.
 * Days that no tier covers cost the base price, like the API's PricingService.
 */
export function buildTierPreview(base: number | null, tiers: PricingTierDto[]): TierBox[] {
  const sorted = [...tiers].sort((a, b) => a.fromDay - b.fromDay);
  type Seg = { from: number; to: number | null; discount: number };
  const segs: Seg[] = [];
  let cursor = 1;
  for (const t of sorted) {
    if (cursor === Infinity) break;
    const from = Math.max(t.fromDay, cursor);
    if (t.toDay !== null && t.toDay < from) continue;
    if (from > cursor) segs.push({ from: cursor, to: from - 1, discount: 0 });
    segs.push({ from, to: t.toDay, discount: t.discountPercent });
    cursor = t.toDay === null ? Infinity : t.toDay + 1;
  }
  if (cursor !== Infinity) segs.push({ from: cursor, to: null, discount: 0 });

  return segs.map((s) => {
    const label = s.to === null ? (s.from === 1 ? tr('fleetModel.abTag1') : tr('fleetModel.abTag', { from: s.from })) : s.from === s.to ? `Tag ${s.from}` : tr('fleetModel.tag', { from: s.from, to: s.to });
    const price = base !== null && Number.isFinite(base) ? fmtNumber(Math.round(base * (1 - s.discount / 100) * 100) / 100, 2) : '–';
    return {
      key: `${s.from}-${s.to ?? 'x'}`,
      label,
      price,
      discount: s.discount > 0 ? `−${String(s.discount).replace('.', ',')} %` : '',
    };
  });
}

// ─── Maintenance timeline ───────────────────────────────────────

export type MaintenancePhase = 'planned' | 'active' | 'done';

export function maintenancePhase(m: Pick<FleetMaintenance, 'startDate' | 'endDate'>, todayKey: string = toInputDate(new Date())): MaintenancePhase {
  const start = toInputDate(m.startDate);
  const end = toInputDate(m.endDate);
  if (end < todayKey) return 'done';
  if (start > todayKey) return 'planned';
  return 'active';
}

export const PHASE_LABEL: Record<MaintenancePhase, string> = { get planned() { return tr('fleetModel.geplant'); }, get active() { return tr('common.aktiv'); }, get done() { return tr('common.erledigt'); } };

/** '15.09.2026' for one day, '03.12. – 04.12.2026' for a range. */
export function maintenancePeriod(m: Pick<FleetMaintenance, 'startDate' | 'endDate'>): string {
  const a = parseDate(m.startDate);
  const b = parseDate(m.endDate);
  if (!a || !b) return '–';
  if (daysBetween(a, b) <= 0) return fmtDate(a);
  return a.getFullYear() === b.getFullYear() ? `${fmtDateShort(a)} – ${fmtDate(b)}` : `${fmtDate(a)} – ${fmtDate(b)}`;
}

/** Newest first: upcoming and current entries on top, history below. */
export function sortMaintenance<T extends Pick<FleetMaintenance, 'startDate'>>(list: T[]): T[] {
  return [...list].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}
