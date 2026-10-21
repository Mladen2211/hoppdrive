/**
 * next/image only optimizes hosts listed in next.config.js (`remotePatterns`:
 * images.unsplash.com, localhost and the API host) and throws for anything
 * else. Editors can paste arbitrary URLs into the CMS (hero image, avatars),
 * so those are rendered as-is (`unoptimized`) instead of crashing the page.
 * Relative `/uploads/...` paths are served through the site's own rewrite and
 * are always optimizable.
 */
const API_HOSTNAME = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api').hostname;
  } catch {
    return 'localhost';
  }
})();

/**
 * Vehicle photos in display order: the main image (`isPrimary`, chosen in the admin) first, the others
 * by `sortOrder`. The detail gallery, JSON-LD and Open Graph all start with the main image.
 */
export function sortImagesPrimaryFirst<T extends { isPrimary: boolean; sortOrder: number }>(images: T[]): T[] {
  return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}

export function canOptimizeImage(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  try {
    const { hostname } = new URL(src);
    return hostname === 'images.unsplash.com' || hostname === 'localhost' || hostname === API_HOSTNAME;
  } catch {
    return false;
  }
}
