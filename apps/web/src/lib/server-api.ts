/**
 * Server-side API helpers for Next.js Server Components & generateMetadata.
 * Uses internal Docker URL when available (for production SSR), falls back to public URL.
 */

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

export interface VehicleListItem {
  id: string;
  brand: string;
  model: string;
  type: string;
  year: number;
  basePricePerDay: number;
  currency: string;
  thumbnailUrl: string | null;
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

export async function getAllVehicles(): Promise<VehicleListItem[]> {
  const data = await serverFetch<VehicleListItem[]>('/vehicles', 60);
  return data ?? [];
}

export async function getSetting(key: string): Promise<any | null> {
  return serverFetch<any>(`/settings/${key}`, 120);
}
