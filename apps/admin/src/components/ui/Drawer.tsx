'use client';

/**
 * Drawer: the detail panel next to a list. One component, three behaviours:
 *   >= 1024 px  persistent column (440 px) NEXT to the list, when the Drawer is
 *               inside a <DrawerLayout>; otherwise a right overlay
 *   768-1023 px overlay from the right (480 px) with scrim, focus trap
 *   < 768 px    bottom sheet (max 92 % height) with scrim, focus trap
 * The responsive switch is pure CSS, so resizing never remounts the content
 * (no lost form state). Overlay/sheet: Escape closes, Tab is trapped, body scroll
 * is locked, focus returns to the trigger. Inline: Escape closes while focus is
 * inside the panel, focus moves into the panel on open and back on close.
 *
 *   <DrawerLayout>
 *     <div>…list or table…</div>
 *     <Drawer open={!!selected} onClose={() => setSelected(null)}
 *             title="Škoda Kodiaq bearbeiten" subtitle="Änderungen erscheinen nach dem Speichern auf der Website"
 *             footer={<><Button>Speichern</Button><Button variant="ghost">Verwerfen</Button></>}>
 *       …form…
 *     </Drawer>
 *   </DrawerLayout>
 *
 * Drawer props: open, onClose, title, subtitle?, headerActions?, children (scrolling body),
 *   footer? (sticky; safe-area aware), mode ('auto' default | 'inline' | 'overlay' | 'sheet'),
 *   closeLabel (default "Schliessen"), initialFocusRef?, className?.
 *   Tip: add `data-autofocus` to the element that should get focus on open.
 * DrawerLayout props: className. Renders a 2-column grid from 1024 px; the
 *   persistent panel sticks below the top bar: the shell can set
 *   `--drawer-offset` (e.g. 68px) on a parent to match its sticky header height.
 */
import { X } from 'lucide-react';
import { createContext, useContext, useId, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from './cn';
import { useFocusTrap, useLockBodyScroll, useMediaQuery } from './hooks';
import { IconButton } from './IconButton';
import { Portal } from './Portal';
import { tr } from '@/i18n/active';

const DrawerLayoutContext = createContext(false);

export function DrawerLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DrawerLayoutContext.Provider value={true}>
      <div className={cn('grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto]', className)}>
        {children}
      </div>
    </DrawerLayoutContext.Provider>
  );
}

export type DrawerMode = 'auto' | 'inline' | 'overlay' | 'sheet';

// Full class strings are literal so Tailwind keeps them.
const SHEET_CLASS =
  'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] rounded-t-18 border-l-0 border-t shadow-sheet animate-sheet-up';
const OVERLAY_CLASS =
  'fixed inset-y-0 right-0 z-50 h-dvh w-[480px] max-w-full shadow-modal animate-slide-in-right';
const INLINE_CLASS =
  'sticky top-[var(--drawer-offset,0px)] z-auto h-[calc(100dvh-var(--drawer-offset,0px))] w-[440px] self-start';
// sheet < md, overlay md..lg
const AUTO_CLASS =
  SHEET_CLASS +
  ' md:inset-x-auto md:inset-y-0 md:right-0 md:h-dvh md:max-h-none md:w-[480px] md:max-w-full md:rounded-none md:border-l md:border-t-0 md:shadow-modal md:animate-slide-in-right';
// + persistent column from lg (only inside a DrawerLayout)
const AUTO_INLINE_CLASS =
  ' lg:sticky lg:inset-auto lg:top-[var(--drawer-offset,0px)] lg:z-auto lg:h-[calc(100dvh-var(--drawer-offset,0px))] lg:w-[440px] lg:max-w-none lg:self-start lg:shadow-none lg:animate-none';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  mode?: DrawerMode;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  footer,
  mode = 'auto',
  closeLabel = tr('ui.schliessen'),
  initialFocusRef,
  className,
}: DrawerProps) {
  const inLayout = useContext(DrawerLayoutContext);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const inline = mode === 'inline' || (mode === 'auto' && inLayout && isDesktop);
  const modal = !inline;

  useFocusTrap(panelRef, open, {
    onEscape: onClose,
    trap: modal,
    escapeScope: modal ? 'document' : 'inside',
    initialFocusRef,
  });
  useLockBodyScroll(open && modal);

  if (!open) return null;

  const modeClass =
    mode === 'inline'
      ? INLINE_CLASS
      : mode === 'overlay'
        ? OVERLAY_CLASS
        : mode === 'sheet'
          ? SHEET_CLASS
          : AUTO_CLASS + (inLayout ? AUTO_INLINE_CLASS : '');
  const showHandle = mode === 'auto' || mode === 'sheet';

  const content = (
    <>
      {modal && <div className="scrim fixed inset-0 z-40 animate-fade-in" aria-hidden="true" onClick={onClose} />}
      <div
        ref={panelRef}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal || undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('drawer outline-none', modeClass, className)}
      >
        {showHandle && <span className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-line md:hidden" aria-hidden="true" />}
        <div className="drawer-h">
          <div className="min-w-0">
            <h2 id={titleId} className="h2">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-graphite">{subtitle}</p>}
          </div>
          <div className="flex flex-none items-center gap-1">
            {headerActions}
            <IconButton aria-label={closeLabel} onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <div className="drawer-b min-h-0 overflow-y-auto">{children}</div>
        {footer && <div className="drawer-f pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </>
  );

  return inLayout ? content : <Portal>{content}</Portal>;
}
