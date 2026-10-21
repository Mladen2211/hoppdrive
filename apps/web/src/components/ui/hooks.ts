'use client';

/**
 * Small shared hooks for the overlay primitives (Drawer, Modal, Menu, Sheet).
 * - useFocusTrap: initial focus, Tab cycling, Escape, focus restore. Nested
 *   dialogs are handled with a stack: only the top-most one reacts.
 * - useLockBodyScroll: reference-counted, so nested overlays are safe.
 * - useMediaQuery: SSR-safe (false on the server) via useSyncExternalStore.
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

/** useLayoutEffect that does not warn during SSR. */
export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest('[inert]'),
  );
}

const trapStack: symbol[] = [];

interface FocusTrapOptions {
  /** Called when Escape is pressed (and this layer is the top-most one). */
  onEscape?: () => void;
  /** Cycle Tab inside the container (default true). */
  trap?: boolean;
  /** 'document': Escape works anywhere; 'inside': only while focus is within the container. */
  escapeScope?: 'document' | 'inside';
  /** Element to focus on open. Default: `[data-autofocus]` / `[autofocus]` inside, else the container. */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Restore focus to the previously focused element on close (default true). */
  restoreFocus?: boolean;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  active: boolean,
  options: FocusTrapOptions = {},
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;

    const id = Symbol('focus-layer');
    trapStack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const opts = optionsRef.current;
    const target =
      opts.initialFocusRef?.current ??
      root.querySelector<HTMLElement>('[data-autofocus],[autofocus]') ??
      root;
    if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== id) return;
      const current = optionsRef.current;

      if (event.key === 'Escape') {
        if (current.escapeScope === 'inside' && !root.contains(document.activeElement)) return;
        if (event.defaultPrevented) return;
        event.stopPropagation();
        current.onEscape?.();
        return;
      }

      if (event.key !== 'Tab' || current.trap === false) return;
      const focusable = getFocusable(root);
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;
      const outside = !root.contains(activeEl) || activeEl === root;
      if (event.shiftKey && (activeEl === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeEl === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = trapStack.indexOf(id);
      if (index !== -1) trapStack.splice(index, 1);
      if (optionsRef.current.restoreFocus !== false && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}

let scrollLocks = 0;
let previousOverflow = '';

export function useLockBodyScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (scrollLocks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
