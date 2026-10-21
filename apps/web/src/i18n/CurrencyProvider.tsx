'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useFormatters } from '@/i18n/useFormatters';
import { DEFAULT_CURRENCY } from '@/lib/format';

/**
 * The display currency of the site (`currency` setting, fetched once in the locale layout).
 * Client components format prices with `useSiteFormatters()`; Server Components get the code
 * as a prop (hooks with context do not run there).
 */
const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

export function CurrencyProvider({ currency, children }: { currency: string; children: ReactNode }) {
  return <CurrencyContext.Provider value={currency || DEFAULT_CURRENCY}>{children}</CurrencyContext.Provider>;
}

/** ISO code of the site currency ('CHF' without a provider). */
export function useCurrency(): string {
  return useContext(CurrencyContext);
}

/** `useFormatters` bound to the site currency (client components only). */
export function useSiteFormatters() {
  return useFormatters(useCurrency());
}
