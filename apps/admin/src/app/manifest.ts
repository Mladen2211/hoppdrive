import type { MetadataRoute } from 'next';

/**
 * Web app manifest of the admin PWA (served as /manifest.webmanifest and linked by Next).
 * The maskable icons (public/icons) have 20 % safe-zone padding on white; the "any" icons
 * (android-chrome-*) are the plain mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'HoppDrive Admin',
    short_name: 'HoppDrive',
    description: 'Verwaltungspanel für HoppDrive: Anfragen, Verträge, Kalender und Flotte.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#FFFFFF',
    background_color: '#F2F2F2',
    lang: 'de-CH',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
