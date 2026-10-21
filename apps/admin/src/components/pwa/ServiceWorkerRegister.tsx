'use client';

/**
 * Registers /sw.js (production builds only) and handles updates:
 *  - a new worker that finished installing while another one controls the page waits;
 *    the user gets the toast "Neue Version verfügbar" with the action "Neu laden"
 *  - "Neu laden" sends SKIP_WAITING to the waiting worker; the page reloads once the new
 *    worker has taken control (controllerchange)
 * The worker never touches API traffic (see public/sw.js), so an update is always safe to apply.
 */
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui';
import { tr } from '@/i18n/active';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function ServiceWorkerRegister() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let reloadRequested = false;
    let promptShown = false;
    let registration: ServiceWorkerRegistration | undefined;
    let interval: number | undefined;
    let cancelled = false;

    const onControllerChange = () => {
      // Only reload when the user asked for the update (not on the very first install).
      if (reloadRequested) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const promptUpdate = (worker: ServiceWorker) => {
      if (promptShown) return;
      promptShown = true;
      toastRef.current.info(tr('pwa.neueVersionVerfuegbar'), tr('pwa.ladenSieDieSeite'), {
        duration: 0,
        action: {
          label: tr('pwa.neuLaden'),
          onClick: () => {
            reloadRequested = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => undefined);
    };

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(installing);
          });
        });
        interval = window.setInterval(() => reg.update().catch(() => undefined), UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', onVisible);
      })
      .catch(() => {
        /* registration failed (e.g. insecure origin): the app works without the worker */
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return null;
}
