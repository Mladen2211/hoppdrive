import de from '@/messages/de.json';
import { DEFAULT_LOCALE, type Locale } from './config';

export type Messages = { [key: string]: string | Messages };

const GERMAN = de as unknown as Messages;

// One explicit loader per language so the bundler emits a separate chunk for each.
const LOADERS: Record<Locale, () => Promise<{ default: unknown }>> = {
  de: () => Promise.resolve({ default: de }),
  en: () => import('@/messages/en.json'),
  fr: () => import('@/messages/fr.json'),
  it: () => import('@/messages/it.json'),
  hr: () => import('@/messages/hr.json'),
};

function merge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      typeof value === 'object' && value !== null && typeof current === 'object' && current !== null
        ? merge(current, value)
        : value;
  }
  return out;
}

/** The bundled German messages (always available, also the fallback for missing keys). */
export function germanMessages(): Messages {
  return GERMAN;
}

/** Messages of a locale with German filled in for every key the translation lacks. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === DEFAULT_LOCALE) return GERMAN;
  const mod = await LOADERS[locale]();
  return merge(GERMAN, mod.default as Messages);
}
