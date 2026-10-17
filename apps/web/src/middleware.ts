import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  const host = stripPort(request.headers.get('host') || '');

  if (REDIRECT_HOSTS.has(host)) {
    const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 301);
  }

  // Any other non-canonical, non-local host (tunnel/staging hostnames) is
  // served normally but told not to be indexed — avoids duplicate-content
  // penalties without breaking previews.
  if (host !== CANONICAL_HOST && !isLocalhost(host)) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
