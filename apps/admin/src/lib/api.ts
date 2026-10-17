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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(res: { data: { data: any } }) {
  return res.data.data;
}

// ─── Public API Object ──────────────────────────────────────
export const api = {
  // ─── Auth (interceptor attaches token automatically) ───────
  login: (data: { email: string; password: string }) =>
    client.post('/auth/login', data).then(unwrap) as Promise<any>,
  refreshToken: () =>
    client.post('/auth/refresh').then(unwrap) as Promise<any>,
  logout: () =>
    client.post('/auth/logout').then(unwrap) as Promise<any>,
  resetPassword: (data: { newPassword: string }) =>
    client.post('/auth/reset-password', data).then(unwrap) as Promise<any>,
  getProfile: () =>
    client.get('/auth/profile').then(unwrap) as Promise<any>,
  updateProfile: (data: { firstName?: string; lastName?: string; email?: string; phone?: string; currentPassword?: string; newPassword?: string }) =>
    client.put('/auth/profile', data).then(unwrap) as Promise<any>,
  updateSignature: (signatureData: string) =>
    client.put('/auth/profile/signature', { signatureData }).then(unwrap) as Promise<any>,

  // ─── Dashboard ─────────────────────────────────────────────
  getDashboardStats: () =>
    client.get('/dashboard').then(unwrap) as Promise<any>,

  // ─── Vehicles ──────────────────────────────────────────────
  getVehicles: () =>
    client.get('/vehicles').then(unwrap) as Promise<any[]>,
  getAllVehicles: () =>
    client.get('/vehicles/admin/all').then(unwrap) as Promise<any[]>,
  createVehicle: (data: any) =>
    client.post('/vehicles', data).then(unwrap) as Promise<any>,
  updateVehicle: (id: string, data: any) =>
    client.patch(`/vehicles/${id}`, data).then(unwrap) as Promise<any>,
  deleteVehicle: (id: string) =>
    client.delete(`/vehicles/${id}`).then(unwrap) as Promise<any>,
  uploadVehicleImage: (vehicleId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    // Let the browser set Content-Type (with the required multipart boundary) —
    // the client's default 'application/json' header must be explicitly cleared.
    return client
      .post(`/vehicles/${vehicleId}/images`, formData, {
        headers: { 'Content-Type': undefined },
      })
      .then(unwrap) as Promise<any>;
  },
  deleteVehicleImage: (vehicleId: string, imageId: string) =>
    client.delete(`/vehicles/${vehicleId}/images/${imageId}`).then(unwrap) as Promise<any>,

  // ─── Inquiries / Contact ──────────────────────────────────
  getContactRequests: (params?: { page?: number; limit?: number }) =>
    client.get('/contact', { params }).then(unwrap) as Promise<{ items: any[]; total: number; page: number; totalPages: number }>,
  updateContactStatus: (id: string, status: string) =>
    client.patch(`/contact/${id}/status`, { status }).then(unwrap) as Promise<any>,
  approveInquiry: (id: string, data: { vehicleId: string; totalPrice?: number }) =>
    client.post(`/contact/${id}/approve`, data).then(unwrap) as Promise<any>,
  denyInquiry: (id: string, data?: { reason?: string }) =>
    client.post(`/contact/${id}/deny`, data || {}).then(unwrap) as Promise<any>,

  // ─── Bookings ──────────────────────────────────────────────
  getBookings: () =>
    client.get('/bookings').then(unwrap) as Promise<{ items: any[]; total: number }>,
  createBooking: (data: any) =>
    client.post('/bookings', data).then(unwrap) as Promise<any>,
  updateBooking: (id: string, data: { customerEmail?: string; notes?: string }) =>
    client.patch(`/bookings/${id}`, data).then(unwrap) as Promise<any>,
  transitionBookingStatus: (id: string, status: 'active' | 'completed' | 'cancelled') =>
    client.patch(`/bookings/${id}/status`, { status }).then(unwrap) as Promise<any>,
  getBookingReport: (from: string, to: string) =>
    client.get('/bookings/report', { params: { from, to } }).then(unwrap) as Promise<any>,
  finalizeContract: (id: string, data: { signature: string; customerEmail?: string }) =>
    client.post(`/bookings/${id}/finalize-contract`, data).then(unwrap) as Promise<any>,
  downloadContract: (id: string) =>
    client.get(`/bookings/${id}/download-contract`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,
  getContractPreview: (id: string) =>
    client.get(`/bookings/${id}/contract-preview`).then(unwrap) as Promise<any>,

  // ─── Settings (CMS) ───────────────────────────────────────
  getSettings: () =>
    client.get('/settings').then(unwrap) as Promise<Record<string, any>>,
  getSetting: (key: string) =>
    client.get(`/settings/${key}`).then(unwrap) as Promise<any>,
  updateSetting: (key: string, value: any) =>
    client.put(`/settings/${key}`, { value }).then(unwrap) as Promise<any>,

  // ─── Pricing Rules (real discount tiers, not marketing copy) ──
  getPricingRules: () =>
    client.get('/pricing/rules').then(unwrap) as Promise<any[]>,
  createPricingRule: (data: { fromDay: number; toDay: number | null; discountPercent: number }) =>
    client.post('/pricing/rules', data).then(unwrap) as Promise<any>,
  updatePricingRule: (id: string, data: { fromDay: number; toDay: number | null; discountPercent: number }) =>
    client.patch(`/pricing/rules/${id}`, data).then(unwrap) as Promise<any>,
  deletePricingRule: (id: string) =>
    client.delete(`/pricing/rules/${id}`).then(unwrap) as Promise<any>,

  // ─── Vehicle Maintenance / Decommission Periods ────────────
  getMaintenance: (vehicleId?: string) =>
    client.get('/maintenance', { params: vehicleId ? { vehicleId } : {} }).then(unwrap) as Promise<any[]>,
  createMaintenance: (data: { vehicleId: string; startDate: string; endDate: string; reason: 'repair' | 'accident' | 'other'; notes?: string }) =>
    client.post('/maintenance', data).then(unwrap) as Promise<any>,
  deleteMaintenance: (id: string) =>
    client.delete(`/maintenance/${id}`).then(unwrap) as Promise<any>,

  // ─── Locations (Standorte) ────────────────────────────────
  getLocations: () =>
    client.get('/locations').then(unwrap) as Promise<any[]>,
  createLocation: (data: { name: string; address: string; zip: string; city: string; country?: string; phone?: string; email?: string }) =>
    client.post('/locations', data).then(unwrap) as Promise<any>,
  updateLocation: (id: string, data: any) =>
    client.patch(`/locations/${id}`, data).then(unwrap) as Promise<any>,
  deleteLocation: (id: string) =>
    client.delete(`/locations/${id}`).then(unwrap) as Promise<any>,

  // ─── Notifications ────────────────────────────────────────
  getNotifications: (unreadOnly?: boolean) =>
    client.get('/notifications', { params: unreadOnly ? { unreadOnly: 'true' } : {} }).then(unwrap) as Promise<{ items: any[]; unreadCount: number }>,
  markNotificationRead: (id: string) =>
    client.patch(`/notifications/${id}/read`).then(unwrap) as Promise<any>,
  markAllNotificationsRead: () =>
    client.patch('/notifications/read-all').then(unwrap) as Promise<any>,

  // ─── Invoices ─────────────────────────────────────────────
  getInvoices: (params?: { status?: string; bookingId?: string }) =>
    client.get('/invoices', { params }).then(unwrap) as Promise<any[]>,
  createInvoice: (data: { bookingId: string; periodStart: string; periodEnd: string; notes?: string; vatRate?: number; dueDays?: number }) =>
    client.post('/invoices', data).then(unwrap) as Promise<any>,
  toggleInvoiceStatus: (id: string, status: 'PENDING' | 'PAID') =>
    client.patch(`/invoices/${id}/status`, { status }).then(unwrap) as Promise<any>,
  reissueInvoice: (id: string, data: { penalty: number; notes?: string }) =>
    client.post(`/invoices/${id}/reissue`, data).then(unwrap) as Promise<any>,
  downloadInvoice: (id: string) =>
    client.get(`/invoices/${id}/download`, { responseType: 'blob' }).then((res) => res.data) as Promise<Blob>,

  // ─── Search ───────────────────────────────────────────────
  globalSearch: (q: string) =>
    client.get('/search', { params: { q } }).then(unwrap) as Promise<any>,

  // ─── Testimonials ─────────────────────────────────────────
  getTestimonials: () =>
    client.get('/testimonials/all').then(unwrap) as Promise<any[]>,
  createTestimonial: (data: { name: string; location?: string; text: string; rating?: number; avatarUrl?: string; isActive?: boolean; sortOrder?: number }) =>
    client.post('/testimonials', data).then(unwrap) as Promise<any>,
  updateTestimonial: (id: string, data: any) =>
    client.patch(`/testimonials/${id}`, data).then(unwrap) as Promise<any>,
  deleteTestimonial: (id: string) =>
    client.delete(`/testimonials/${id}`).then(unwrap) as Promise<any>,

  // ─── FAQ Items ────────────────────────────────────────────
  getFaqItems: () =>
    client.get('/faq/all').then(unwrap) as Promise<any[]>,
  createFaqItem: (data: { question: string; answer: string; category?: string; isActive?: boolean; sortOrder?: number }) =>
    client.post('/faq', data).then(unwrap) as Promise<any>,
  updateFaqItem: (id: string, data: any) =>
    client.patch(`/faq/${id}`, data).then(unwrap) as Promise<any>,
  deleteFaqItem: (id: string) =>
    client.delete(`/faq/${id}`).then(unwrap) as Promise<any>,

  // ─── Homepage Sections ────────────────────────────────────
  getHomepageSections: () =>
    client.get('/homepage-sections/all').then(unwrap) as Promise<any[]>,
  updateHomepageSection: (key: string, data: { content?: any; sortOrder?: number; isActive?: boolean }) =>
    client.put(`/homepage-sections/${key}`, data).then(unwrap) as Promise<any>,
  toggleHomepageSection: (key: string) =>
    client.patch(`/homepage-sections/${key}/toggle`).then(unwrap) as Promise<any>,
};
