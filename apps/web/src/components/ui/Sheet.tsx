'use client';

/**
 * Sheet: bottom sheet on mobile (< 768 px), centred dialog from 768 px up.
 * Used for the mobile filter, cookie settings and similar panels.
 * Scrim, focus moves into the sheet (an element with `data-autofocus`, else the
 * sheet itself), Tab is trapped, Escape and a click on the scrim close it, body
 * scroll is locked, focus returns to the trigger. The footer respects the
 * iOS safe area.
 *
 *   <Sheet open={open} onClose={() => setOpen(false)} title="Filter"
 *          headerAction={<button className="font-semibold text-ruby-dark underline" onClick={reset}>Zurücksetzen</button>}
 *          footer={<><Button variant="outline" onClick={cancel}>Abbrechen</Button><Button onClick={apply}>9 Fahrzeuge anzeigen</Button></>}>
 *     …filters…
 *   </Sheet>
 *
 * Props: open, onClose, title, headerAction? (next to the title, instead of the X when
 *   `hideClose`), children (scrolling body), footer? (sticky, buttons share the width),
 *   hideClose, closeLabel (default: the translated "Schliessen"), dismissible (false blocks Escape/scrim/X),
 *   initialFocusRef, className.
 * A cookie BANNER (non-blocking) should not use Sheet; the cookie SETTINGS panel should.
 */
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from './cn';
import { useFocusTrap, useLockBodyScroll } from './hooks';
import { IconButton } from './IconButton';
import { Portal } from './Portal';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  headerAction?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  hideClose?: boolean;
  closeLabel?: string;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  headerAction,
  children,
  footer,
  hideClose = false,
  closeLabel,
  dismissible = true,
  initialFocusRef,
  className,
}: SheetProps) {
  const t = useTranslations('common');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, open, {
    onEscape: () => {
      if (dismissible) onClose();
    },
    initialFocusRef,
  });
  useLockBodyScroll(open);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex animate-fade-in items-end justify-center bg-ink-dark/[.62] md:items-center md:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && dismissible) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            'flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-20 bg-white shadow-sheet outline-none md:max-h-[calc(100dvh-48px)] md:max-w-[560px] md:animate-pop md:rounded-20',
            className,
          )}
        >
          <span className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-line md:hidden" aria-hidden="true" />
          <div className="flex flex-none items-center justify-between gap-3 px-5 pb-3 pt-4 md:px-6">
            <h2 id={titleId} className="h3">
              {title}
            </h2>
            <div className="flex items-center gap-3">
              {headerAction}
              {!hideClose && (
                <IconButton aria-label={closeLabel ?? t('close')} onClick={onClose} disabled={!dismissible}>
                  <X size={22} aria-hidden="true" />
                </IconButton>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-soft px-5 py-4 md:px-6">{children}</div>
          {footer && (
            <div className="flex flex-none gap-3 border-t border-line-soft px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 [&>*]:flex-1">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
