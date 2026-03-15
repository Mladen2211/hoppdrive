'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { CookieBanner } from './CookieBanner';

interface ConsentState {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface ConsentContextType {
  consent: ConsentState | null;
  showBanner: boolean;
  acceptAll: () => void;
  declineNonEssential: () => void;
  savePreferences: (prefs: Partial<ConsentState>) => void;
  reopenBanner: () => void;
}

const ConsentContext = createContext<ConsentContextType | null>(null);

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within CookieConsentProvider');
  return ctx;
}

const COOKIE_KEY = 'hoppdrive_consent';

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Read consent from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (stored) {
      try {
        setConsent(JSON.parse(stored));
      } catch {
        setShowBanner(true);
      }
    } else {
      setShowBanner(true);
    }
  }, []);

  // When consent changes, inject/remove scripts
  useEffect(() => {
    if (!consent) return;

    if (consent.analytics) {
      injectGA4();
    }
    // Marketing scripts would go here
  }, [consent]);

  const persistConsent = useCallback((state: ConsentState) => {
    setConsent(state);
    localStorage.setItem(COOKIE_KEY, JSON.stringify(state));
    setShowBanner(false);
  }, []);

  const acceptAll = useCallback(() => {
    persistConsent({ essential: true, analytics: true, marketing: true });
  }, [persistConsent]);

  const declineNonEssential = useCallback(() => {
    persistConsent({ essential: true, analytics: false, marketing: false });
  }, [persistConsent]);

  const savePreferences = useCallback(
    (prefs: Partial<ConsentState>) => {
      persistConsent({
        essential: true,
        analytics: prefs.analytics ?? false,
        marketing: prefs.marketing ?? false,
      });
    },
    [persistConsent],
  );

  const reopenBanner = useCallback(() => {
    setShowBanner(true);
  }, []);

  return (
    <ConsentContext.Provider
      value={{ consent, showBanner, acceptAll, declineNonEssential, savePreferences, reopenBanner }}
    >
      {children}
      {showBanner && <CookieBanner />}
    </ConsentContext.Provider>
  );
}

/**
 * Only inject GA4 after user explicitly opts in (FADP zero-cookie load).
 */
function injectGA4() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || typeof window === 'undefined') return;
  if (document.getElementById('ga4-script')) return;

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(inlineScript);
}
