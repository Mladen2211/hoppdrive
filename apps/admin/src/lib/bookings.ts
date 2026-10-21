/**
 * Booking list with a page size.
 *
 * `api.getBookings()` sends no query, so the API answers with its default page of the 20 newest
 * bookings: older bookings silently disappeared from the contracts list, the overlap checks and the
 * dashboard. `GET /bookings?pageSize=` is supported by the API, so this helper asks for a big page.
 * It uses its own axios call (api.ts is owned by another agent) with the same base URL and bearer
 * token; if that fails for any reason (e.g. an expired token that needs the shared refresh logic) it
 * falls back to `api.getBookings()`, which refreshes the session and returns the default page.
 */
import axios from 'axios';
import { api } from '@/lib/api';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api',
  withCredentials: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBookings(pageSize = 500): Promise<{ items: any[]; total: number }> {
  try {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
    const res = await client.get('/bookings', {
      params: { pageSize },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = res.data?.data;
    if (data && Array.isArray(data.items)) return { items: data.items, total: Number(data.total) || data.items.length };
  } catch {
    /* fall back below */
  }
  const fallback = await api.getBookings();
  return { items: fallback.items || [], total: fallback.total ?? (fallback.items || []).length };
}
