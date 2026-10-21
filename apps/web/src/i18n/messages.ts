import type { AbstractIntlMessages } from 'next-intl';

/**
 * Namespaces that are only used by Server Components (metadata, JSON-LD, the long legal /
 * category / vehicle page copy). They are not serialised into the HTML for the client
 * provider. A client component that needs one of them must be given its texts as props, or
 * the namespace has to be removed from this list.
 */
const SERVER_ONLY_NAMESPACES = new Set([
  'meta',
  'jsonld',
  'legal',
  'categoryIntro',
  'categoryPage',
  'fleetPage',
  'vehiclePage',
]);

export function pickClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(Object.entries(messages).filter(([namespace]) => !SERVER_ONLY_NAMESPACES.has(namespace)));
}
