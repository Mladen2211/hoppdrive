import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// ─── Axios Instance ──────────────────────────────────────────
const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api',
  withCredentials: true, // always send HttpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: attach access token automatically ──
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response Interceptor: transparent 401 refresh ───────────
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post(
    `${client.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const newToken: string = data.data.accessToken;
  sessionStorage.setItem('accessToken', newToken);
  if (data.data.admin) {
    sessionStorage.setItem('admin', JSON.stringify(data.data.admin));
  }
  return newToken;
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ error?: string }>) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    // Only attempt refresh on 401, never retry refresh / login endpoints
    if (
      error.response?.status === 401 &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login') &&
      !(original as any)._retried
    ) {
      (original as any)._retried = true;

      try {
        // Deduplicate concurrent refreshes
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        // Refresh failed — clear session, auth guard will redirect to /login
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('admin');
        return Promise.reject(error);
      }
    }

    // Surface the server error message
    const message =
      error.response?.data?.error || error.message || 'Ein Fehler ist aufgetreten';
    return Promise.reject(new Error(message));
  },
);

// ─── Helper: unwrap { success, data } envelope ──────────────
function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

// ─── Public API Object ──────────────────────────────────────
export const api = {
  // ─── Auth (interceptor attaches token automatically) ───────
  login: (data: { email: string; password: string }) =>
    client.post('/auth/login', data).then(unwrap),
  refreshToken: () =>
    client.post('/auth/refresh').then(unwrap),
  logout: () =>
    client.post('/auth/logout').then(unwrap),
  resetPassword: (data: { newPassword: string }) =>
    client.post('/auth/reset-password', data).then(unwrap),

  // ─── Dashboard ─────────────────────────────────────────────
  getDashboardStats: () =>
    client.get('/dashboard').then(unwrap),

  // ─── Vehicles ──────────────────────────────────────────────
  getVehicles: () =>
    client.get<{ data: any[] }>('/vehicles').then(unwrap),
  getAllVehicles: () =>
    client.get<{ data: any[] }>('/vehicles/admin/all').then(unwrap),
  createVehicle: (data: any) =>
    client.post('/vehicles', data).then(unwrap),
  updateVehicle: (id: string, data: any) =>
    client.patch(`/vehicles/${id}`, data).then(unwrap),
  deleteVehicle: (id: string) =>
    client.delete(`/vehicles/${id}`).then(unwrap),

  // ─── Inquiries / Contact ──────────────────────────────────
  getContactRequests: (params?: { page?: number; limit?: number }) =>
    client.get('/contact', { params }).then(unwrap),
  updateContactStatus: (id: string, status: string) =>
    client.patch(`/contact/${id}/status`, { status }).then(unwrap),

  // ─── Bookings ──────────────────────────────────────────────
  getBookings: () =>
    client.get<{ data: any[] }>('/bookings').then(unwrap),
  createBooking: (data: any) =>
    client.post('/bookings', data).then(unwrap),
};
