'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query's match state. Returns `false` on the server and
 * during initial client render (no layout available yet), then syncs to the
 * real value on mount and on every change.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}
