import type { MetadataRoute } from 'next';

// The admin CMS must never be indexed. The layout already sets a noindex
// meta tag; this additionally keeps crawlers from even requesting its pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
