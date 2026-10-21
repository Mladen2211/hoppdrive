'use client';

import { useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { isLocale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/I18nProvider';
import { isThemePreference } from '@/lib/theme';
import { useTheme } from './ThemeProvider';

/**
 * Copies the signed-in admin's saved preferences (language, theme) into the app: runs after the
 * session loaded and again whenever the admin object changes (Profil -> Darstellung updates it).
 * Mount once inside AdminAuthProvider.
 */
export function PreferencesSync() {
  const { admin } = useAdminAuth();
  const { setLocale } = useAppLocale();
  const { setPreference } = useTheme();
  const locale = admin?.locale;
  const theme = admin?.theme;

  useEffect(() => {
    if (isLocale(locale)) void setLocale(locale);
  }, [locale, setLocale]);

  useEffect(() => {
    if (isThemePreference(theme)) setPreference(theme);
  }, [theme, setPreference]);

  return null;
}
