'use client';

import {
  can,
  permissionLevel,
  type PermissionArea,
  type PermissionLevel,
} from '@hoppdrive/shared';
import { useAdminAuth } from './useAdminAuth';

/**
 * The signed-in admin's level for an area: 'edit' | 'view' | 'none'.
 * Reads the shared matrix (packages/shared PERMISSIONS), the same one the API enforces.
 * While the session is loading, or when signed out / role unknown, it returns 'none', so
 * nothing is ever shown optimistically (use `loading` from useAdminAuth to render a skeleton).
 *
 *   const level = usePermission('fleet');
 *   if (level === 'none') return <NoPermission />;
 *   const readOnly = level === 'view';
 */
export function usePermission(area: PermissionArea): PermissionLevel {
  const { role, loading } = useAdminAuth();
  if (loading || !role) return 'none';
  return permissionLevel(role, area);
}

/**
 * Boolean shortcut: true when the admin has at least `level` on `area`
 * (useCan('reports', 'view') is also true for edit). False while loading.
 */
export function useCan(area: PermissionArea, level: PermissionLevel): boolean {
  const { role, loading } = useAdminAuth();
  if (loading || !role) return false;
  return can(role, area, level);
}
