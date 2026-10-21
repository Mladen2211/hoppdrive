'use client';

/**
 * Renders children into document.body (SSR-safe).
 * Used by Modal, Drawer (standalone), Menu and the toast viewport so that
 * `position: fixed` layers are never clipped by an ancestor's overflow.
 *
 * On the client the portal content exists in the same commit as its parent
 * (so focus-trap effects can find their container); during hydration it
 * renders nothing first, to match the server HTML.
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
