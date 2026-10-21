/**
 * Single source of truth for the website's internationalisation.
 *
 *  - 5 locales; German is the default and stays WITHOUT a prefix
 *    (`localePrefix: 'as-needed'`), so every existing URL is unchanged:
 *    /, /fahrzeuge, /fahrzeuge/<slug>, /mieten/<kategorie>, /impressum, /privacy, /agb.
 *  - The other locales are prefixed (/en, /fr, /it, /hr) and get localised
 *    top-level pathnames. The KEYS of `pathnames` are the internal (German)
 *    route folders under `app/[locale]/`. Dynamic params (vehicle and category
 *    slugs) are identical in every language.
 *
 * Edge-safe: imported by the middleware, so keep it free of Node/React imports.
 */
import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['de', 'en', 'fr', 'it', 'hr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  // The <link rel="alternate" hreflang> tags come from the page metadata (canonical host
  // based); the middleware's `Link` response header would duplicate them on whatever host
  // served the request, so it is switched off.
  alternateLinks: false,
  pathnames: {
    '/': '/',
    '/fahrzeuge': {
      de: '/fahrzeuge',
      en: '/vehicles',
      fr: '/vehicules',
      it: '/veicoli',
      hr: '/vozila',
    },
    '/fahrzeuge/[slug]': {
      de: '/fahrzeuge/[slug]',
      en: '/vehicles/[slug]',
      fr: '/vehicules/[slug]',
      it: '/veicoli/[slug]',
      hr: '/vozila/[slug]',
    },
    '/mieten/[kategorie]': {
      de: '/mieten/[kategorie]',
      en: '/rent/[kategorie]',
      fr: '/location/[kategorie]',
      it: '/noleggio/[kategorie]',
      hr: '/najam/[kategorie]',
    },
    '/impressum': {
      de: '/impressum',
      en: '/legal-notice',
      fr: '/mentions-legales',
      it: '/note-legali',
      hr: '/impresum',
    },
    '/privacy': {
      de: '/privacy',
      en: '/privacy',
      fr: '/confidentialite',
      it: '/privacy',
      hr: '/privatnost',
    },
    '/agb': {
      de: '/agb',
      en: '/terms',
      fr: '/conditions',
      it: '/condizioni',
      hr: '/uvjeti',
    },
    // Placeholder page, implemented by the marketing round (unsubscribe link of every mail).
    '/abmelden': {
      de: '/abmelden',
      en: '/unsubscribe',
      fr: '/desabonnement',
      it: '/annulla-iscrizione',
      hr: '/odjava',
    },
  },
});

export type AppPathname = keyof typeof routing.pathnames;

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
