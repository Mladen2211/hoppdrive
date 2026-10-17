/** @type {import('next').NextConfig} */

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

// The API's origin without the `/api` suffix — e.g. uploads are served by
// the API's express.static at `${apiOrigin}/uploads`, not under `/api`.
const apiOrigin = apiUrl.replace(/\/api\/?$/, '');

// Extract hostname from the API URL for next/image remotePatterns
let apiHostname = 'localhost';
try { apiHostname = new URL(apiUrl).hostname; } catch {}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Allow images served from the API uploads endpoint
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: apiHostname },
      { protocol: 'http', hostname: apiHostname },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
      // Uploaded vehicle images are stored as relative `/uploads/<uuid>.webp`
      // and served by the API's express.static at `/uploads`. Proxying them
      // under the site's own domain resolves OG images, JSON-LD images and
      // gallery images, which otherwise point to nothing on the site origin.
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
