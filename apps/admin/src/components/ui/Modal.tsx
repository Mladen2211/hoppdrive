'use client';

/**
 * Modal: centred dialog (radius 18, scrim rgba(44,46,48,.62)).
 * Focus moves into the dialog on open (an element with `data-autofocus`, else
 * the dialog itself), Tab is trapped, Escape and a click on the scrim close it,
 * body scroll is locked and focus returns to the trigger on close.
 *
 *   <Modal open={open} onClose={close} title="Neue Buchung" size="lg"
 *          footer={<><Button variant="ghost" onClick={close}>Abbrechen</Button><Button>Speichern</Button></>}>
 *     …content…
 *   </Modal>
 *
 * Props:
 *  - open, onClose, title, description?, icon? (any node placed before the title, e.g. a tinted square)
 *  - size: 'sm' (420) | 'md' (560, default) | 'lg' (760)
 *  - footer: right-aligned action row
 *  - role: 'dialog' (default) | 'alertdialog' (used by ConfirmDialog)
 *  - dismissible: false blocks Escape / scrim / X (e.g. while saving)
 *  - closeOnScrim (default true), hideClose, initialFocusRef, className
 */
import { X } from 'lucide-react';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from './cn';
import { useFocusTrap, useLockBodyScroll } from './hooks';
import { IconButton } from './IconButton';
import { Portal } from './Portal';
import { tr } from '@/i18n/active';

const SIZE_CLASS = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[760px]',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  children?: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  closeOnScrim?: boolean;
  hideClose?: boolean;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  children,
  footer,
  role = 'dialog',
  dismissible = true,
  closeOnScrim = true,
  hideClose = false,
  closeLabel = tr('ui.schliessen'),
  initialFocusRef,
  className,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
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
        className="scrim fixed inset-0 z-50 flex animate-fade-in items-center justify-center overflow-y-auto p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && closeOnScrim && dismissible) onClose();
        }}
      >
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'modal max-h-[calc(100dvh-32px)] w-full animate-pop overflow-y-auto outline-none',
            SIZE_CLASS[size],
            className,
          )}
        >
          <div className="flex items-start gap-3">
            {icon}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="h2">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mut mt-1">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <IconButton aria-label={closeLabel} onClick={onClose} disabled={!dismissible} className="-mr-2 -mt-1">
                <X size={20} aria-hidden="true" />
              </IconButton>
            )}
          </div>
          {children}
          {footer && <div className="flex flex-wrap justify-end gap-2.5">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
