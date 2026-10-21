import type { ReactNode } from 'react';

/**
 * Pass-through root layout. The real document (<html lang>, fonts, providers, JSON-LD) lives in
 * app/[locale]/layout.tsx so that `lang` follows the language of the page.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
