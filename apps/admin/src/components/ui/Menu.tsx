'use client';

/**
 * Menu: overflow ("...") popover menu. Opens in a portal with fixed positioning
 * (never clipped by a scrolling table wrapper), flips upward near the bottom edge.
 * Keyboard: Enter / Space / ArrowDown / ArrowUp open it; Arrow keys, Home, End
 * move; Enter selects; Escape closes and returns focus to the button; Tab closes.
 * Outside click, scroll and resize close it.
 *
 *   <Menu label="Weitere Aktionen" items={[
 *     { label: 'E-Mail bearbeiten', icon: <Pencil size={18} />, onSelect: () => edit(id) },
 *     { label: 'Vertrag herunterladen', icon: <Download size={18} />, href: `/api/…` },
 *     { label: 'Stornieren', icon: <Ban size={18} />, danger: true, separatorBefore: true,
 *       onSelect: () => cancel(id) },
 *   ]} />
 *
 * Props:
 *  - items: { key?, label, icon?, onSelect?, href?, danger?, disabled?, separatorBefore? }[]
 *  - label: accessible name of the default "..." button (default "Weitere Aktionen")
 *  - align: 'end' (default, menu's right edge under the button) | 'start'
 *  - trigger: custom trigger render-prop `(p) => <button {...p}>…</button>` where p carries
 *    ref, onClick, onKeyDown, aria-haspopup, aria-expanded, aria-controls, id
 *  - className: for the default trigger
 */
import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from './cn';
import { useIsoLayoutEffect } from './hooks';
import { IconButton } from './IconButton';
import { Portal } from './Portal';
import { tr } from '@/i18n/active';

export interface MenuItem {
  key?: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  id: string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

export interface MenuProps {
  items: MenuItem[];
  label?: string;
  align?: 'start' | 'end';
  trigger?: (props: MenuTriggerProps) => ReactNode;
  className?: string;
}

const MENU_WIDTH = 232;

export function Menu({ items, label = tr('ui.weitereAktionen'), align = 'end', trigger, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const itemElements = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  // Position under the trigger; flip upward if it would leave the viewport.
  useIsoLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    let left = align === 'end' ? rect.right - MENU_WIDTH : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
    let top = rect.bottom + 6;
    if (menuHeight && top + menuHeight > window.innerHeight - 8) top = Math.max(8, rect.top - 6 - menuHeight);
    setPosition({ top, left });
  }, [open, align, items.length]);

  // Focus the first item once positioned.
  useEffect(() => {
    if (open && position) {
      const first = itemElements()[0];
      if (first && !menuRef.current?.contains(document.activeElement)) first.focus({ preventScroll: true });
    }
  }, [open, position]);

  // Outside click, scroll and resize close the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onDismiss = () => close(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onDismiss);
    window.addEventListener('scroll', onDismiss, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onDismiss);
      window.removeEventListener('scroll', onDismiss, true);
    };
  }, [open, close]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = itemElements();
    const index = elements.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        elements[(index + 1) % elements.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        elements[(index - 1 + elements.length) % elements.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        elements[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        elements[elements.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        event.preventDefault();
        close(true);
        break;
    }
  };

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    id: triggerId,
    onClick: () => (open ? close(false) : setOpen(true)),
    onKeyDown: onTriggerKeyDown,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  };

  const itemClass =
    'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[15px] font-medium no-underline outline-none hover:bg-paper focus-visible:bg-paper focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-focus aria-disabled:cursor-not-allowed aria-disabled:text-dim aria-disabled:hover:bg-transparent max-md:min-h-[48px]';

  return (
    <>
      {trigger ? (
        trigger(triggerProps)
      ) : (
        <IconButton
          ref={triggerRef}
          id={triggerId}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={triggerProps['aria-controls']}
          onClick={triggerProps.onClick}
          onKeyDown={onTriggerKeyDown}
          className={className}
        >
          <Ellipsis size={20} aria-hidden="true" />
        </IconButton>
      )}
      {open && (
        <Portal>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className="fixed z-[55] animate-pop rounded-xl border border-line bg-card p-1.5 shadow-modal"
            style={{
              width: MENU_WIDTH,
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            {items.map((item, index) => {
              const content = (
                <>
                  {item.icon && (
                    <span className="flex-none" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </>
              );
              const classes = cn(itemClass, item.danger ? 'text-err' : 'text-ink');
              const select = () => {
                item.onSelect?.();
                close(true);
              };
              return (
                <div key={item.key ?? index} role="none">
                  {item.separatorBefore && index > 0 && <div role="separator" className="my-1 h-px bg-line-soft" />}
                  {item.href && !item.disabled ? (
                    <Link
                      href={item.href}
                      role="menuitem"
                      tabIndex={-1}
                      className={classes}
                      onClick={() => close(false)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      aria-disabled={item.disabled || undefined}
                      className={classes}
                      onClick={item.disabled ? undefined : select}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}
