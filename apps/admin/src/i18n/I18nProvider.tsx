'use client';

/**
 * Mounts next-intl for the whole admin (no URL routing). The locale is resolved in this order:
 *   admin.locale (PreferencesSync, after sign-in) -> cookie / localStorage (language picker) ->
 *   browser language -> German.
 * The server reads the cookie to render the first paint in the right language and passes the
 * messages of a non-German locale down as `initialMessages` (German is bundled with the client).
 * Switching language loads that locale's messages with a dynamic import (German fills any gap).
 */
import { NextIntlClientProvider } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setActiveLocale } from './active';
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  TIME_ZONE,
  isLocale,
  pickLocale,
  type Locale,
} from './config';
import { germanMessages, loadMessages, type Messages } from './messages';

interface SetLocaleOptions {
  /** Remember the choice in the cookie + localStorage (default true). */
  persist?: boolean;
}

interface LocaleContextValue {
  locale: Locale;
  locales: readonly Locale[];
  setLocale: (next: Locale, options?: SetLocaleOptions) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  locales: LOCALES,
  setLocale: async () => {},
});

/** The active language and a setter. `useTranslations()` from next-intl does the translating. */
export function useAppLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

function persistLocale(locale: Locale): void {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies blocked */
  }
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* storage blocked */
  }
}

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  return match && isLocale(match[1]) ? match[1] : null;
}

interface I18nProviderProps {
  initialLocale: Locale;
  /** Merged messages of `initialLocale`; omitted for German (bundled). */
  initialMessages?: Messages;
  children: ReactNode;
}

export function I18nProvider({ initialLocale, initialMessages, children }: I18nProviderProps) {
  const [state, setState] = useState<{ locale: Locale; messages: Messages }>(() => ({
    locale: initialLocale,
    messages: initialMessages ?? germanMessages(),
  }));
  const localeRef = useRef(state.locale);
  const requestRef = useRef(0);

  // Keep the translator used by plain helpers (lib/format, lib/audit ...) on the same language.
  setActiveLocale(state.locale, state.messages);

  const setLocale = useCallback(async (next: Locale, options: SetLocaleOptions = {}) => {
    const persist = options.persist ?? true;
    if (persist) persistLocale(next);
    // Latest call wins: take a ticket BEFORE the "already current" shortcut. A no-op call (the admin's
    // saved language equals the one on screen) must still supersede a slower, older switch that is
    // still importing its messages (e.g. the browser-language detection), or that import would
    // overwrite the admin's choice when it lands.
    const request = ++requestRef.current;
    if (next === localeRef.current) return;
    let messages: Messages;
    try {
      messages = await loadMessages(next);
    } catch {
      return; // chunk failed to load: stay on the current language
    }
    if (request !== requestRef.current) return; // a newer call superseded this one
    localeRef.current = next;
    // Switch the plain-helper translator right away (not only on the next render), so code that
    // continues after `await setLocale(...)` (toasts, formatted text) already speaks the new language.
    setActiveLocale(next, messages);
    setState({ locale: next, messages });
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[state.locale];
  }, [state.locale]);

  // No saved choice yet: follow the browser language (the server only had Accept-Language).
  useEffect(() => {
    if (readStoredLocale()) return;
    const detected = pickLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (detected && detected !== localeRef.current) void setLocale(detected, { persist: false });
  }, [setLocale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale: state.locale, locales: LOCALES, setLocale }),
    [state.locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider
        locale={state.locale}
        messages={state.messages}
        timeZone={TIME_ZONE}
        onError={() => {
          /* every key falls back to German; a key missing there renders its path */
        }}
        getMessageFallback={({ namespace, key }) => (namespace ? `${namespace}.${key}` : key)}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
