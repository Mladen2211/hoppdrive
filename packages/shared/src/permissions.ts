// ─── Roles & Permissions ─────────────────────────────────────────
//
// Single source of truth for the admin permission matrix. The API enforces it
// (requirePermission middleware) and the admin UI renders it ("Rechte pro Rolle",
// nav filtering, usePermission) from this same object, so the two can never drift.

export type AdminRole = 'ADMIN' | 'RENTAL' | 'EDITOR' | 'READONLY';

export type PermissionArea =
  | 'inquiries' // Anfragen
  | 'contracts' // Verträge und Rechnungen
  | 'calendar' // Kalender
  | 'fleet' // Flotte
  | 'reports' // Berichte
  | 'content' // Inhalte: Homepage, Bewertungen, FAQ, Standorte
  | 'websiteSettings' // Website-Einstellungen
  | 'users' // Benutzer und Rollen + Aktivitätsprotokoll
  | 'damages' // Schäden und Fahrzeugkontrollen
  | 'fines' // Bussen (enthalten Personendaten)
  | 'marketing'; // Rabattcodes, Kunden, Kampagnen

export type PermissionLevel = 'edit' | 'view' | 'none';

/** Roles in display order (matrix columns). */
export const ADMIN_ROLES: readonly AdminRole[] = ['ADMIN', 'RENTAL', 'EDITOR', 'READONLY'];

/** Areas in display order (matrix rows). */
export const PERMISSION_AREAS: readonly PermissionArea[] = [
  'inquiries',
  'contracts',
  'calendar',
  'fleet',
  'reports',
  'content',
  'websiteSettings',
  'users',
  'damages',
  'fines',
  'marketing',
];

/** area -> role -> level. Mirrors the "Rechte pro Rolle" board exactly. */
export const PERMISSIONS: Record<PermissionArea, Record<AdminRole, PermissionLevel>> = {
  inquiries: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'none', READONLY: 'view' },
  contracts: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'none', READONLY: 'view' },
  calendar: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'view', READONLY: 'view' },
  fleet: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'none', READONLY: 'view' },
  reports: { ADMIN: 'edit', RENTAL: 'view', EDITOR: 'none', READONLY: 'view' },
  content: { ADMIN: 'edit', RENTAL: 'view', EDITOR: 'edit', READONLY: 'view' },
  websiteSettings: { ADMIN: 'edit', RENTAL: 'none', EDITOR: 'none', READONLY: 'none' },
  users: { ADMIN: 'edit', RENTAL: 'none', EDITOR: 'none', READONLY: 'none' },
  damages: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'none', READONLY: 'view' },
  fines: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'none', READONLY: 'none' },
  marketing: { ADMIN: 'edit', RENTAL: 'edit', EDITOR: 'edit', READONLY: 'view' },
};

/** German role names. */
export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: 'Administrator',
  RENTAL: 'Vermietung',
  EDITOR: 'Redaktion',
  READONLY: 'Lesen',
};

/** German area names (matrix row labels). */
export const AREA_LABELS: Record<PermissionArea, string> = {
  inquiries: 'Anfragen',
  contracts: 'Verträge und Rechnungen',
  calendar: 'Kalender',
  fleet: 'Flotte',
  reports: 'Berichte',
  content: 'Inhalte',
  websiteSettings: 'Website-Einstellungen',
  users: 'Benutzer und Rollen',
  damages: 'Schäden und Kontrollen',
  fines: 'Bussen',
  marketing: 'Marketing',
};

/** German level names (matrix cell labels). */
export const LEVEL_LABELS: Record<PermissionLevel, string> = {
  edit: 'Bearbeiten',
  view: 'Ansehen',
  none: 'Kein Zugriff',
};

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2 };

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** The level a role has for an area. Unknown/missing role -> 'none'. */
export function permissionLevel(
  role: AdminRole | null | undefined,
  area: PermissionArea,
): PermissionLevel {
  if (!role) return 'none';
  return PERMISSIONS[area]?.[role] ?? 'none';
}

/**
 * True when `role` has at least `level` on `area`.
 * can(role, 'x', 'view') is true for view and edit; can(role, 'x', 'edit') only for edit.
 */
export function can(
  role: AdminRole | null | undefined,
  area: PermissionArea,
  level: PermissionLevel,
): boolean {
  return LEVEL_RANK[permissionLevel(role, area)] >= LEVEL_RANK[level];
}
