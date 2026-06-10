import type {
  VehicleDto,
  PricingCalculation,
  CreateContactRequestPayload,
} from '@hoppdrive/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Ein Fehler ist aufgetreten');
  }

  return json.data as T;
}

export interface HomepageSectionDto {
  sectionKey: string;
  isActive: boolean;
  sortOrder: number;
  content: Record<string, unknown>;
}

export interface TestimonialDto {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
}

export interface FaqItemDto {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const api = {
  getVehicles: () => request<VehicleDto[]>('/vehicles'),
  getVehicle: (id: string) => request<VehicleDto>(`/vehicles/${id}`),
  calculatePricing: (vehicleId: string, days: number) =>
    request<PricingCalculation>(`/pricing?vehicleId=${vehicleId}&days=${days}`),
  submitContact: (data: CreateContactRequestPayload) =>
    request<{ id: string }>('/contact', { method: 'POST', body: JSON.stringify(data) }),
  getSetting: <T = unknown>(key: string) => request<T>(`/settings/${key}`),
  getTestimonials: () => request<TestimonialDto[]>('/testimonials'),
  getFaq: () => request<FaqItemDto[]>('/faq'),
  getHomepageSections: () => request<HomepageSectionDto[]>('/homepage-sections'),
};
