'use client';

/**
 * The currency of the business (Einstellungen > Währung; CHF unless set). Fetched once per session and
 * shared by every component; `setCurrencyCache` is called after the setting was changed.
 *
 *   const currency = useCurrency();            // 'CHF' | 'EUR'
 *   fmtMoney(79, { currency })
 */
import type { CurrencyCode } from '@hoppdrive/shared';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAdminAuth } from './useAdminAuth';

let cached: CurrencyCode | null = null;
let pending: Promise<CurrencyCode> | null = null;
const listeners = new Set<(code: CurrencyCode) => void>();

function load(): Promise<CurrencyCode> {
  if (!pending) {
    pending = api
      .getCurrency()
      .then((setting) => {
        cached = setting?.code === 'EUR' ? 'EUR' : 'CHF';
        return cached;
      })
      .catch(() => {
        pending = null; // try again next time; show CHF meanwhile
        return 'CHF' as CurrencyCode;
      });
  }
  return pending;
}

/** Updates the shared value (after saving the currency setting) and notifies mounted components. */
export function setCurrencyCache(code: CurrencyCode): void {
  cached = code;
  pending = Promise.resolve(code);
  listeners.forEach((listener) => listener(code));
}

export function useCurrency(): CurrencyCode {
  const { token } = useAdminAuth();
  const [code, setCode] = useState<CurrencyCode>(cached ?? 'CHF');

  useEffect(() => {
    listeners.add(setCode);
    return () => {
      listeners.delete(setCode);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void load().then((value) => {
      if (alive) setCode(value);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  return code;
}
