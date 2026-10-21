'use client';

/**
 * Light / dark / system theme.
 *
 * The palette is switched by <html data-theme="light|dark"> (CSS variables, see app/globals.css).
 * `themeInitScript` runs inline in <head> before first paint and sets that attribute from
 * localStorage ('hd-theme': light | dark | system, default system) so there is no flash. This
 * provider takes over after hydration: it follows prefers-color-scheme live while the preference is
 * 'system', keeps the PWA <meta name="theme-color"> in step, and exposes setPreference(). After
 * sign-in PreferencesSync copies admin.theme here.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

export { isThemePreference, type ThemePreference, type ResolvedTheme };

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    /* storage blocked */
  }
  return 'system';
}

function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  const colour = THEME_COLORS[resolved];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length) {
    metas.forEach((meta) => meta.setAttribute('content', colour));
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = colour;
    document.head.appendChild(meta);
  }
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  // Pick up what the inline script decided (and the saved preference) after hydration.
  useEffect(() => {
    setPreferenceState(readStoredPreference());
  }, []);

  // Apply the preference; while it is 'system' follow the OS setting live.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const next: ResolvedTheme = preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference;
      setResolved(next);
      applyTheme(next);
    };
    update();
    if (preference !== 'system') return;
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [preference]);

  // Another tab changed the theme.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setPreferenceState(readStoredPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice still applies for this session */
    }
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
