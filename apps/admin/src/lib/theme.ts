/**
 * Theme constants shared by the server layout (inline pre-paint script) and the client
 * ThemeProvider. Plain module (no 'use client') so server components can import the values.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'hd-theme';

/** Browser chrome colour (<meta name="theme-color">) per theme: the card colour of the palette. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#FFFFFF', dark: '#1E2022' };

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Inline script for <head>: sets <html data-theme> from localStorage before first paint
 * (light | dark | system, default system) so there is no flash. ThemeProvider takes over after
 * hydration and keeps the same logic (applyTheme).
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='light'&&p!=='dark')p='system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.setAttribute('data-theme',d?'dark':'light');e.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}');}catch(e){}})();`;
