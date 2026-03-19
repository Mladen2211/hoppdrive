const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Ein Fehler ist aufgetreten');
  }

  return json.data;
}

export const api = {
  getVehicles: () => request<any[]>('/vehicles'),
  getVehicle: (id: string) => request<any>(`/vehicles/${id}`),
  calculatePricing: (vehicleId: string, days: number) =>
    request<any>(`/pricing?vehicleId=${vehicleId}&days=${days}`),
  submitContact: (data: any) =>
    request<any>('/contact', { method: 'POST', body: JSON.stringify(data) }),
  getSetting: (key: string) => request<any>(`/settings/${key}`),
  getTestimonials: () => request<any[]>('/testimonials'),
  getFaq: () => request<any[]>('/faq'),
  getHomepageSections: () => request<any[]>('/homepage-sections'),
};
