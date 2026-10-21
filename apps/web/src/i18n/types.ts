/**
 * Minimal translator signature shared by the plain (non-component) helpers in `lib/*`, so they
 * work with both `useTranslations('ns')` and `await getTranslations('ns')` without importing
 * next-intl themselves.
 */
export type Translate = (key: string, values?: Record<string, string | number | Date>) => string;
