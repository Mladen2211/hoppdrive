/* HoppDrive Admin service worker.
 *
 * Goals: installable PWA + a branded offline page. It is deliberately NOT a data cache.
 *
 *  - Precache on install: /offline (and the static assets that page needs), icons, logos.
 *  - Cache-first: same-origin /_next/static/* (content-hashed, immutable).
 *  - Stale-while-revalidate: same-origin /logos/*, /icons/* and the root icon files (not hashed, so
 *    they refresh in the background; bump VERSION to drop them immediately).
 *  - Network-first for same-origin navigations; when the network fails, the cached /offline page.
 *    Navigation responses are never cached (the HTML belongs to a signed-in session).
 *  - Pass-through (the worker does not respond, the browser handles it untouched):
 *      cross-origin requests (the API lives on another origin), /api/*, any request carrying an
 *      Authorization header, every non-GET method (POST / PUT / PATCH / DELETE), range requests,
 *      Server-Sent Events, Next.js data (RSC) requests and everything else.
 *    => no API response and no authenticated content can ever end up in Cache Storage.
 *
 * Update flow: a new worker waits until the page sends { type: 'SKIP_WAITING' } (the app shows
 * "Neue Version verfügbar" with the action "Neu laden"). Old caches are removed on activate.
 * Bump VERSION whenever this file or the precached assets change in a way that needs a fresh cache.
 */

const VERSION = '2026-10-19.1';
const CACHE_PREFIX = 'hoppdrive-admin-';
const CACHE = CACHE_PREFIX + VERSION;
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/logos/logo-mark.svg',
  '/logos/logo-wordmark.svg',
  '/logos/logo-stacked.svg',
  '/logos/logo-stacked-white.svg',
  '/logos/logo-horizontal.svg',
  '/logos/logo-horizontal-white.svg',
];

const STATIC_PATH = /^\/_next\/static\//;
const REVALIDATED_PATH = /^\/(logos|icons)\//;
const ROOT_ICON = /^\/(favicon[^/]*|android-chrome-[^/]+|apple-touch-icon[^/]*)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // The offline page is required: without it the worker is not installed (it retries later).
      const offlineResponse = await fetch(OFFLINE_URL, { credentials: 'same-origin', cache: 'reload' });
      if (!offlineResponse.ok) throw new Error('offline page unavailable');
      const html = await offlineResponse.clone().text();
      await cache.put(OFFLINE_URL, offlineResponse);

      // Everything else is best effort.
      const assetUrls = new Set(PRECACHE_URLS);
      // Scripts, styles and fonts the offline page references, so it renders and works offline.
      for (const match of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) assetUrls.add(match[0]);
      await Promise.all(
        Array.from(assetUrls).map(async (url) => {
          try {
            const response = await fetch(url, { credentials: 'same-origin' });
            if (!response.ok) return;
            await cache.put(url, response.clone());
            // Fonts are referenced from the CSS files: precache those too.
            if (url.endsWith('.css')) {
              const css = await response.text();
              for (const font of css.matchAll(/url\((\/_next\/static\/[^)"']+)\)/g)) {
                try {
                  const fontResponse = await fetch(font[1], { credentials: 'same-origin' });
                  if (fontResponse.ok) await cache.put(font[1], fontResponse);
                } catch (error) {
                  /* ignore: the page falls back to system fonts */
                }
              }
            }
          } catch (error) {
            /* ignore */
          }
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isCacheable(response) {
  return response && response.ok && response.status === 200 && response.type === 'basic';
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone()).catch(() => undefined);
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone()).catch(() => undefined);
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    refresh.catch(() => undefined);
    return cached;
  }
  const response = await refresh;
  return response || Response.error();
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never touch anything that is not a plain GET.
  if (request.method !== 'GET') return;
  // Never touch requests carrying credentials in a header, or partial/streaming requests.
  if (request.headers.has('authorization') || request.headers.has('range')) return;
  if (request.headers.get('accept') === 'text/event-stream') return;

  const url = new URL(request.url);
  // Cross-origin (API, Mapbox, fonts CDN ...) and the same-origin /api proxy: pass through.
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  // The worker itself and the manifest are always fetched fresh from the network.
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_PATH.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (REVALIDATED_PATH.test(url.pathname) || ROOT_ICON.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Everything else (RSC payloads, image optimizer, ...): pass through.
});
