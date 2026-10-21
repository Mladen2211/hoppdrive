'use client';

/**
 * Item counts of the three content lists (Bewertungen, FAQ, Standorte) for the tab badges and the
 * homepage section summaries. Loads once; a page that already holds its own list passes the live
 * count of that list as `own` so the badge follows add / delete without another request.
 *
 *   const counts = useContentCounts({ key: 'faq', count: items.length });
 */
import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

export type ContentKey = 'testimonials' | 'faq' | 'locations';
export type ContentCounts = Record<ContentKey, number | null>;

const EMPTY: ContentCounts = { testimonials: null, faq: null, locations: null };

export function useContentCounts(own?: { key: ContentKey; count: number | null }): ContentCounts {
  const { token } = useAdminAuth();
  const [loaded, setLoaded] = useState<ContentCounts>(EMPTY);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.allSettled([api.getTestimonials(), api.getFaqItems(), api.getLocations()]).then(([t, f, l]) => {
      if (cancelled) return;
      setLoaded({
        testimonials: t.status === 'fulfilled' ? t.value.length : null,
        faq: f.status === 'fulfilled' ? f.value.length : null,
        locations: l.status === 'fulfilled' ? l.value.length : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return own && own.count !== null ? { ...loaded, [own.key]: own.count } : loaded;
}
