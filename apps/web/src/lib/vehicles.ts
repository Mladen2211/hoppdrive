/**
 * Shared, client-safe helpers around vehicle data: the card data shape,
 * labels, silhouette/tone for vehicles without a photo and the fleet filter
 * categories ("Kombi 6", "Hybrid 2" ...).
 */
import type { Translate } from '@/i18n/types';
import { translateFuel, translateTransmission } from '@/lib/seo';

export interface VehicleCardData {
  id: string;
  brand: string;
  model: string;
  type: string;
  year: number;
  basePricePerDay: number;
  currency: string;
  specs: {
    horsepower: number;
    transmission: string;
    seats: number;
    fuelType: string;
    range?: string;
  };
  thumbnailUrl: string | null;
  /** Switched on for the website (public list only returns these). */
  isAvailable?: boolean;
  /** Live: no reserved/active booking or maintenance today. */
  availableNow?: boolean;
  description?: string | null;
}

/** Slim shape the pickers (quick bar, calculator, contact form) need. */
export interface VehicleOption {
  id: string;
  name: string;
  basePricePerDay: number;
}

/**
 * Trims an API vehicle (DTO or detail) to what the cards need, so less data is shipped to the client.
 * `currency` (the `currency` setting) wins over the vehicle's own code, so every price of the site uses
 * the same currency even right after the setting changed.
 */
export function toCardData(v: VehicleCardData & { images?: unknown }, currency?: string): VehicleCardData {
  return {
    id: v.id,
    brand: v.brand,
    model: v.model,
    type: v.type,
    year: v.year,
    basePricePerDay: v.basePricePerDay,
    currency: currency || v.currency,
    specs: v.specs,
    thumbnailUrl: v.thumbnailUrl,
    isAvailable: v.isAvailable,
    availableNow: v.availableNow,
    description: v.description,
  };
}

export function vehicleName(v: { brand: string; model: string }): string {
  return `${v.brand} ${v.model}`;
}

export function toVehicleOption(v: VehicleCardData): VehicleOption {
  return { id: v.id, name: vehicleName(v), basePricePerDay: v.basePricePerDay };
}

/** "Verfügbar" badge: the live flag wins, then the manual website switch. */
export function isAvailableNow(v: Pick<VehicleCardData, 'availableNow' | 'isAvailable'>): boolean {
  return v.availableNow ?? v.isAvailable ?? true;
}

export type SilhouetteKind = 'estate' | 'suv' | 'sedan';

/** Which placeholder silhouette to draw: estate -> Kombi, suv -> SUV, everything else -> Limousine. */
export function silhouetteFor(type: string): SilhouetteKind {
  if (type === 'estate') return 'estate';
  if (type === 'suv') return 'suv';
  return 'sedan';
}

/** Background tint of the photo area (rose = Limousine, blue = electric/hybrid, grey otherwise). */
export function mediaGradient(v: Pick<VehicleCardData, 'type' | 'specs'>): string {
  if (v.specs.fuelType === 'electric' || v.specs.fuelType === 'hybrid' || v.type === 'electric') {
    return 'bg-[linear-gradient(180deg,#E8EEF0_0%,#D2DCE0_100%)]';
  }
  if (v.type === 'sedan') return 'bg-[linear-gradient(180deg,#F1ECEC_0%,#E2D6D6_100%)]';
  return 'bg-[linear-gradient(180deg,#EDEDED_0%,#DCDCDC_100%)]';
}

/**
 * Card spec line: "150 PS", "Automatik", "5 Sitze", "Benzin" / "Elektrisch · 540 km".
 * `t` = translator of the `labels` namespace.
 */
export function specsList(specs: VehicleCardData['specs'], t: Translate): string[] {
  const fuel = translateFuel(specs.fuelType, t);
  return [
    t('spec.hp', { hp: specs.horsepower }),
    translateTransmission(specs.transmission, t),
    t('spec.seats', { count: specs.seats }),
    specs.range ? `${fuel} · ${specs.range}` : fuel,
  ];
}

// ─── Fleet categories (chips with counts) ───────────────────────

export interface FleetCategory {
  key: string;
  label: string;
  predicate: (v: VehicleCardData) => boolean;
}

const CATEGORY_DEFS: { key: string; predicate: (v: VehicleCardData) => boolean }[] = [
  { key: 'estate', predicate: (v) => v.type === 'estate' },
  { key: 'suv', predicate: (v) => v.type === 'suv' },
  { key: 'sedan', predicate: (v) => v.type === 'sedan' },
  { key: 'van', predicate: (v) => v.type === 'van' },
  { key: 'coupe', predicate: (v) => v.type === 'coupe' },
  { key: 'convertible', predicate: (v) => v.type === 'convertible' },
  { key: 'electric', predicate: (v) => v.type === 'electric' || v.specs.fuelType === 'electric' },
  { key: 'hybrid', predicate: (v) => v.specs.fuelType === 'hybrid' },
];

/**
 * Only the categories that contain vehicles, with their counts.
 * `t` = translator of the `fleetCategory` namespace (plural labels: "Limousinen", "Elektro", ...).
 */
export function fleetCategories(vehicles: VehicleCardData[], t: Translate): (FleetCategory & { count: number })[] {
  return CATEGORY_DEFS.map((def) => ({
    ...def,
    label: t(def.key),
    count: vehicles.filter(def.predicate).length,
  })).filter((def) => def.count > 0);
}

/** Lowest base price of the list (null for an empty list). */
export function minPrice(vehicles: Pick<VehicleCardData, 'basePricePerDay'>[]): number | null {
  return vehicles.length > 0 ? Math.min(...vehicles.map((v) => v.basePricePerDay)) : null;
}
