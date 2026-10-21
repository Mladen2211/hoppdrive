/**
 * Server-side API helpers for Next.js Server Components & generateMetadata.
 * Uses internal Docker URL when available (for production SSR), falls back to public URL.
 */

import type { VehicleDto, PricingCalculation } from '@hoppdrive/shared';
import { DEFAULT_CURRENCY } from '@/lib/format';
import { DEFAULT_TIERS, normalizeTiers, type PricingTier } from '@/lib/pricing';
import type { CompanySetting, PublicLocation } from '@/lib/site';

const API_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:97/api';

export interface VehicleDetail {
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
  images: {
    id: string;
    url: string;
    alt: string;
    sortOrder: number;
    isPrimary: boolean;
  }[];
  isAvailable: boolean;
  /** Computed live by the API (no reserved/active booking or maintenance today). */
  availableNow?: boolean;
  /** Optional marketing text maintained in Flotte -> Beschreibung. */
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Appends `?locale=xx` to a CMS endpoint. The API merges the translations of that locale
 * over the German content (German stays the fallback). Because the locale is part of the
 * URL, Next's fetch cache keeps one entry per language.
 */
function withLocale(endpoint: string, locale: string): string {
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}locale=${encodeURIComponent(locale)}`;
}

async function serverFetch<T>(endpoint: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      next: { revalidate },
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json.data as T;
  } catch {
    return null;
  }
}

export async function getVehicle(id: string, locale: string): Promise<VehicleDetail | null> {
  return serverFetch<VehicleDetail>(withLocale(`/vehicles/${id}`, locale), 60);
}

export async function getAllVehicles(locale: string): Promise<VehicleDto[]> {
  const data = await serverFetch<VehicleDto[]>(withLocale('/vehicles', locale), 60);
  return data ?? [];
}

/**
 * Like getAllVehicles, but throws when the API is unreachable instead of
 * returning []. Use it where an empty fleet would lead to notFound(): during
 * ISR revalidation a thrown error keeps the last good page cached, whereas
 * notFound() would replace indexed pages with 404s for the whole outage.
 */
export async function getAllVehiclesOrThrow(locale: string): Promise<VehicleDto[]> {
  const data = await serverFetch<VehicleDto[]>(withLocale('/vehicles', locale), 60);
  if (!data) throw new Error('Vehicle API unavailable');
  return data;
}

export async function getSetting<T = any>(key: string, locale: string): Promise<T | null> {
  return serverFetch<T>(withLocale(`/settings/${key}`, locale), 120);
}

/**
 * Display currency of the whole site (PUBLIC `GET /settings/currency` -> { code: 'CHF' | 'EUR' }).
 * Every price on the website is formatted with it; CHF when the setting is missing or the API is down.
 * Not localised, so all languages share one cache entry.
 */
export async function getCurrency(): Promise<string> {
  const data = await serverFetch<{ code?: unknown }>('/settings/currency', 120);
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

export interface TestimonialItem {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
  sortOrder: number;
}

export interface FaqItemData {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
}

export async function getTestimonials(locale: string): Promise<TestimonialItem[]> {
  const data = await serverFetch<TestimonialItem[]>(withLocale('/testimonials', locale), 120);
  return data ?? [];
}

export async function getFaqItems(locale: string): Promise<FaqItemData[]> {
  const data = await serverFetch<FaqItemData[]>(withLocale('/faq', locale), 120);
  return data ?? [];
}

export interface HomepageSectionData {
  sectionKey: string;
  isActive: boolean;
  sortOrder: number;
  content: Record<string, any>;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function getHomepageSections(locale: string): Promise<HomepageSectionData[]> {
  const data = await serverFetch<HomepageSectionData[]>(withLocale('/homepage-sections', locale), 60);
  if (!data) return [];

  // Guard against malformed CMS content (e.g. null/array/string instead of an
  // object) so a bad edit degrades to each section's own defaults instead of
  // throwing when a component tries to read a field off it.
  return data.map((section) => ({
    ...section,
    content: isPlainObject(section.content) ? section.content : {},
  }));
}

export interface LocationConfigData {
  visible: boolean;
  title: string;
  address: string;
  lat: number;
  lng: number;
  zoom: number;
}

/**
 * Calls the public `GET /pricing?vehicleId=&days=` endpoint, which runs the
 * real discount-tier calculation (CalculatePricingUseCase) — used to build
 * the vehicle page's price-example table from the actual price a customer
 * would pay, rather than parsing the free-text `pricing` CMS setting.
 */
export async function getPricingQuote(vehicleId: string, days: number): Promise<PricingCalculation | null> {
  return serverFetch<PricingCalculation>(`/pricing?vehicleId=${vehicleId}&days=${days}`, 120);
}

/**
 * Day-tier discount rules (PUBLIC `GET /pricing/tiers`), the input for the
 * client-side price helpers in lib/pricing.ts. The seeded tiers are returned
 * ONLY when the API cannot be reached or answers with something that is not a
 * tier list; an empty list from the API means "no discounts" and is respected.
 */
export async function getPricingTiers(): Promise<PricingTier[]> {
  const data = await serverFetch<unknown>('/pricing/tiers', 120);
  return normalizeTiers(data) ?? DEFAULT_TIERS;
}

/** Active locations incl. phone, e-mail and opening hours (PUBLIC `GET /locations/public`). */
export async function getPublicLocations(): Promise<PublicLocation[]> {
  const data = await serverFetch<PublicLocation[]>('/locations/public', 120);
  return Array.isArray(data) ? data : [];
}

/** The first active location, or null. */
export async function getPrimaryLocation(): Promise<PublicLocation | null> {
  const locations = await getPublicLocations();
  return locations[0] ?? null;
}

/** `company` setting ({ name, phone, inquiryEmail }); null when unset or the API is down. */
export async function getCompany(locale: string): Promise<CompanySetting | null> {
  return getSetting<CompanySetting>('company', locale);
}

export interface MaintenanceMode {
  enabled?: boolean;
  message?: string;
}

/** `maintenance_mode` setting ({ enabled, message }); null when unset or the API is down. */
export async function getMaintenanceMode(locale: string): Promise<MaintenanceMode | null> {
  return getSetting<MaintenanceMode>('maintenance_mode', locale);
}
