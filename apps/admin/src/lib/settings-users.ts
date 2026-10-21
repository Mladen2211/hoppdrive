/**
 * Helpers for the "Benutzer und Rollen" and "Aktivitätsprotokoll" tabs of the settings page.
 */
import { errorText } from '@/lib/errors';
import { fmtDate, parseDate } from '@/lib/format';
import { tr } from '@/i18n/active';

/** "Heute" / "Gestern" / "Vor 6 Tagen" / "23.11.2026" for the Zuletzt-aktiv column (day granularity, as on the board). */
export function lastActiveText(input: string | Date | null | undefined, now: Date = new Date()): string {
  const d = parseDate(input);
  if (!d) return tr('settingsUsers.nochNie');
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return tr('common.heute');
  if (days === 1) return tr('settingsUsers.gestern');
  if (days < 7) return tr('settingsUsers.vorTagen', { days });
  return fmtDate(d);
}

const ADMIN_ERROR_TEXT: Record<string, string> = {
  get cannot_change_own_role() { return tr('settingsUsers.sieKoennenIhreEigene'); },
  get cannot_delete_self() { return tr('settingsUsers.sieKoennenSichNicht'); },
  get last_admin() { return tr('settingsUsers.derLetzteAdministratorKann'); },
  get not_found() { return tr('settingsUsers.derBenutzerWurdeNicht'); },
};

/** German text for the 409 / 404 answers of the user management routes (falls back to the generic mapping). */
export function adminErrorText(err: unknown, fallback?: string): string {
  const code = (err as { code?: string } | null | undefined)?.code;
  if (code && ADMIN_ERROR_TEXT[code]) return ADMIN_ERROR_TEXT[code];
  return errorText(err, fallback);
}

export type AuditFilterId = 'all' | 'bookings' | 'content' | 'users';

/**
 * Filter chips of the activity log. `category` is the comma list the API understands
 * (GET /audit-logs?category=): Buchungen = Buchungen, Anfragen, Rechnungen;
 * Inhalte = Website-Inhalte, Flotte, Preisregeln und Einstellungen; Benutzer = Benutzer und Anmeldungen.
 */
export const AUDIT_FILTERS: { id: AuditFilterId; label: string; category?: string }[] = [
  { id: 'all', get label() { return tr('common.alle'); } },
  { id: 'bookings', get label() { return tr('common.buchungen'); }, category: 'bookings' },
  { id: 'content', get label() { return tr('settingsUsers.inhalte'); }, category: 'content,fleet,settings' },
  { id: 'users', get label() { return tr('settingsUsers.benutzer'); }, category: 'users' },
];

export function auditFilterParams(id: AuditFilterId): { category?: string } {
  const category = AUDIT_FILTERS.find((f) => f.id === id)?.category;
  return category ? { category } : {};
}
