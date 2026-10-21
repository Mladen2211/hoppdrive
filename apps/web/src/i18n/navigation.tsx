/**
 * Locale-aware navigation. Import `Link`, `usePathname`, `useRouter`, `redirect` and
 * `permanentRedirect` from here instead of `next/link` / `next/navigation`, so links
 * resolve to the localised pathnames of the current locale.
 *
 * `Link` additionally accepts the plain strings used throughout the site ("/fahrzeuge",
 * "/fahrzeuge/<slug>", "/?vehicle=1#contact-form", "#faq") and maps them onto the routing
 * table (including dynamic segments), so call sites do not have to build param objects.
 * Object hrefs ({ pathname, params, query, hash }) work as well.
 */
import { createNavigation } from 'next-intl/navigation';
import { createElement, forwardRef, type AnchorHTMLAttributes, type ComponentType } from 'react';
import { routing } from './routing';

const navigation = createNavigation(routing);

export const { usePathname, useRouter, redirect, permanentRedirect, getPathname } = navigation;

export interface ObjectHref {
  pathname: string;
  params?: Record<string, string | string[]>;
  query?: Record<string, string | string[] | undefined>;
  hash?: string;
}

export type Href = string | ObjectHref;

interface DynamicRoute {
  template: string;
  names: string[];
  regex: RegExp;
}

const DYNAMIC_ROUTES: DynamicRoute[] = Object.keys(routing.pathnames)
  .filter((template) => template.includes('['))
  .map((template) => ({
    template,
    names: Array.from(template.matchAll(/\[([^\]]+)\]/g), (match) => match[1]),
    regex: new RegExp(`^${template.replace(/\[[^\]]+\]/g, '([^/]+)')}$`),
  }));

/** "/fahrzeuge/abc?x=1#y" -> { pathname: "/fahrzeuge/[slug]", params: { slug: "abc" }, query, hash }. */
export function resolveHref(href: Href): ObjectHref | string {
  if (typeof href !== 'string') return href;
  // Hash-only ("#faq"), query-only, external and protocol-relative links are not localisable.
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  let rest = href;
  let hash: string | undefined;
  const hashIndex = rest.indexOf('#');
  if (hashIndex >= 0) {
    hash = rest.slice(hashIndex + 1) || undefined;
    rest = rest.slice(0, hashIndex);
  }
  let query: Record<string, string> | undefined;
  const queryIndex = rest.indexOf('?');
  if (queryIndex >= 0) {
    const search = rest.slice(queryIndex + 1);
    rest = rest.slice(0, queryIndex);
    if (search) query = Object.fromEntries(new URLSearchParams(search));
  }

  const result: ObjectHref = { pathname: rest || '/' };
  if (query) result.query = query;
  if (hash) result.hash = hash;

  for (const route of DYNAMIC_ROUTES) {
    const match = route.regex.exec(rest);
    if (match) {
      result.pathname = route.template;
      result.params = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(match[i + 1])]));
      break;
    }
  }
  return result;
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: Href;
  /** Render the link for another language (switches the locale cookie on click). */
  locale?: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
};

const IntlLink = navigation.Link as unknown as ComponentType<Record<string, unknown>>;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, ...rest }, ref) {
  return createElement(IntlLink, { ...rest, ref, href: resolveHref(href) });
});
