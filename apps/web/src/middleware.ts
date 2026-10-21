import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

// Kept independent of `@/lib/seo` so the middleware stays a minimal, fast edge
// function. Default mirrors the lib/seo.ts default.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hoppdrive.ch').replace(/\/+$/, '');

const CANONICAL_HOST = (() => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return 'hoppdrive.ch';
  }
})();

// Legacy / incorrect domains that should permanently redirect to the
// canonical host rather than serve (and get indexed under) a duplicate.
const REDIRECT_HOSTS = new Set(['hoppdrive.com', 'www.hoppdrive.com', 'www.hoppdrive.ch']);

function stripPort(host: string): string {
  return host.split(':')[0];
}

function isLocalhost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

// Locale detection (Accept-Language + the NEXT_LOCALE cookie) and the locale rewrite/redirect
// of next-intl.
const handleI18nRouting = createIntlMiddleware(routing);

/**
 * Only real page requests go through next-intl. Everything else keeps its URL:
 * the API proxy (/api), uploads (/uploads), Next internals (/_next), any file with an
 * extension (favicon.ico, sitemap.xml, robots.txt, llms.txt, images, ...).
 */
function isPageRequest(pathname: string): boolean {
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;
  if (pathname === '/uploads' || pathname.startsWith('/uploads/')) return false;
  if (pathname === '/_next' || pathname.startsWith('/_next/')) return false;
  return !/\.[^/]+$/.test(pathname);
}

export default function middleware(request: NextRequest) {
  const host = stripPort(request.headers.get('host') || '');

  if (REDIRECT_HOSTS.has(host)) {
    const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 301);
  }

  const response = isPageRequest(request.nextUrl.pathname) ? handleI18nRouting(request) : NextResponse.next();

  // Any other non-canonical, non-local host (tunnel/staging hostnames) is
  // served normally but told not to be indexed — avoids duplicate-content
  // penalties without breaking previews.
  if (host !== CANONICAL_HOST && !isLocalhost(host)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

// The matcher stays broad on purpose: the canonical-host redirect and the noindex header
// must keep applying to /sitemap.xml, /robots.txt, /llms.txt and uploads too. The i18n
// part is limited to page requests by `isPageRequest` above.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
