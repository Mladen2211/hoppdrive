const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...rest,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Ein Fehler ist aufgetreten');
  }

  return json.data;
}

export const api = {
  // ─── Auth ──────────────────────────────────────────────────
  login: (data: { email: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data), credentials: 'include' }),
  refreshToken: () =>
    request<any>('/auth/refresh', { method: 'POST', credentials: 'include' }),
  logout: () =>
    request<any>('/auth/logout', { method: 'POST', credentials: 'include' }),
  resetPassword: (data: { newPassword: string }, token: string) =>
    request<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  // ─── Dashboard ─────────────────────────────────────────────
  getDashboardStats: (token: string) =>
    request<any>('/dashboard', { token }),

  // ─── Vehicles ──────────────────────────────────────────────
  getVehicles: () =>
    request<any[]>('/vehicles'),
  getAllVehicles: (token: string) =>
    request<any[]>('/vehicles/admin/all', { token }),
  createVehicle: (data: any, token: string) =>
    request<any>('/vehicles', { method: 'POST', body: JSON.stringify(data), token }),
  updateVehicle: (id: string, data: any, token: string) =>
    request<any>(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
  deleteVehicle: (id: string, token: string) =>
    request<any>(`/vehicles/${id}`, { method: 'DELETE', token }),

  // ─── Inquiries / Contact ──────────────────────────────────
  getContactRequests: (token: string, params?: { page?: number; limit?: number }) => {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()}`
      : '';
    return request<any>(`/contact${qs}`, { token });
  },
  updateContactStatus: (id: string, status: string, token: string) =>
    request<any>(`/contact/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      token,
    }),

  // ─── Bookings ──────────────────────────────────────────────
  getBookings: (token: string) =>
    request<any[]>('/bookings', { token }),
  createBooking: (data: any, token: string) =>
    request<any>('/bookings', { method: 'POST', body: JSON.stringify(data), token }),
};
