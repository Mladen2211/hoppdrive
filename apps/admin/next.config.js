/** @type {import('next').NextConfig} */

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

let apiHostname = 'localhost';
try { apiHostname = new URL(apiUrl).hostname; } catch {}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: apiHostname },
      { protocol: 'http', hostname: apiHostname },
    ],
  },
  async headers() {
    // /manifest.webmanifest (app/manifest.ts) keeps Next's own `public, max-age=0, must-revalidate` + ETag.
    return [
      {
        // The service worker must always be re-checked by the browser and may control the whole origin.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
