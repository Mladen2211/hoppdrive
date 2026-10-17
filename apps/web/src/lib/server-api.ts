/**
 * Server-side API helpers for Next.js Server Components & generateMetadata.
 * Uses internal Docker URL when available (for production SSR), falls back to public URL.
 */

import type { VehicleDto, PricingCalculation } from '@hoppdrive/shared';

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
  createdAt: string;
  updatedAt: string;
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

export async function getVehicle(id: string): Promise<VehicleDetail | null> {
  return serverFetch<VehicleDetail>(`/vehicles/${id}`, 60);
}

export async function getAllVehicles(): Promise<VehicleDto[]> {
  const data = await serverFetch<VehicleDto[]>('/vehicles', 60);
  return data ?? [];
}

/**
 * Like getAllVehicles, but throws when the API is unreachable instead of
 * returning []. Use it where an empty fleet would lead to notFound(): during
 * ISR revalidation a thrown error keeps the last good page cached, whereas
 * notFound() would replace indexed pages with 404s for the whole outage.
 */
export async function getAllVehiclesOrThrow(): Promise<VehicleDto[]> {
  const data = await serverFetch<VehicleDto[]>('/vehicles', 60);
  if (!data) throw new Error('Vehicle API unavailable');
  return data;
}

export async function getSetting<T = any>(key: string): Promise<T | null> {
  return serverFetch<T>(`/settings/${key}`, 120);
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

export async function getTestimonials(): Promise<TestimonialItem[]> {
  const data = await serverFetch<TestimonialItem[]>('/testimonials', 120);
  return data ?? [];
}

export async function getFaqItems(): Promise<FaqItemData[]> {
  const data = await serverFetch<FaqItemData[]>('/faq', 120);
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

export async function getHomepageSections(): Promise<HomepageSectionData[]> {
  const data = await serverFetch<HomepageSectionData[]>('/homepage-sections', 60);
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
