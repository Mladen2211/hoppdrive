/** @type {import('next').NextConfig} */

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

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
    ];
  },
};

module.exports = nextConfig;
