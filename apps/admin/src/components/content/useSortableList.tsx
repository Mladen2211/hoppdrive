'use client';

/**
 * Reordering for a list of rows with three input methods, no dependency:
 *  1. mouse / pen: native HTML5 drag and drop, started from the grip handle (the whole row is the drop target)
 *  2. keyboard:    focus the grip, press ArrowUp / ArrowDown (or Alt + Arrow) to move the row
 *  3. touch / buttons: <MoveButtons> (explicit up / down buttons) call the same move()
 *
 *   const sort = useSortableList({ ids, onMove: (from, to) => setOrder(moveItem(order, from, to)), labelOf });
 *   <li data-sort-row {...sort.getRowProps(id)}>
 *     <SortGrip {...sort.getHandleProps(id)} label="Kopfbereich" />
 *   ...
 *   <p className="sr-only" aria-live="polite">{sort.announcement}</p>
 *
 * Moving only reports (from, to) indexes; the caller decides what it changes (local draft order or a
 * saved sortOrder), so this hook never talks to the API.
 */
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { IconButton, cn } from '@/components/ui';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

export interface SortableOptions {
  ids: string[];
  /** Move the row at index `from` to index `to`. */
  onMove: (from: number, to: number) => void;
  /** Human name of a row for the live announcement ("Kopfbereich"). */
  labelOf: (id: string) => string;
}

type DropSide = 'before' | 'after';

export function useSortableList({ ids, onMove, labelOf }: SortableOptions) {
  const t = useTranslations();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; side: DropSide } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  // Keep keyboard focus on the grip after a row moved (React re-inserts the DOM node).
  useEffect(() => {
    if (!focusId) return;
    document.querySelector<HTMLElement>(`[data-sort-handle="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
    setFocusId(null);
  }, [focusId, ids]);

  const move = useCallback(
    (id: string, delta: number, keepFocus = false) => {
      const current = idsRef.current;
      const from = current.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return;
      onMove(from, to);
      setAnnouncement(tr('content.positionVon', { labelOf: labelOf(id), value: to + 1, length: current.length }));
      if (keepFocus) setFocusId(id);
    },
    [onMove, labelOf],
  );

  const getHandleProps = (id: string) => ({
    'data-sort-handle': id,
    draggable: true as const,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      const row = event.currentTarget.closest<HTMLElement>('[data-sort-row]');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      if (row) event.dataTransfer.setDragImage(row, 24, 24);
      setDragId(id);
    },
    onDragEnd: () => {
      setDragId(null);
      setOver(null);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        move(id, event.key === 'ArrowUp' ? -1 : 1, true);
      }
    },
  });

  const getRowProps = (id: string) => ({
    'data-sort-row': '',
    'data-dragging': dragId === id ? '' : undefined,
    'data-drop': over?.id === id ? over.side : undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!dragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragId === id) {
        if (over) setOver(null);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const side: DropSide = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      if (!over || over.id !== id || over.side !== side) setOver({ id, side });
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const current = idsRef.current;
      const from = dragId ? current.indexOf(dragId) : -1;
      const target = current.indexOf(id);
      if (from >= 0 && target >= 0 && from !== target && over) {
        // Index of the dragged row after it is removed from its old place.
        let to = over.side === 'before' ? target : target + 1;
        if (from < to) to -= 1;
        if (to !== from) {
          onMove(from, to);
          setAnnouncement(t('content.positionVon', { labelOf: labelOf(dragId!), value: to + 1, length: current.length }));
        }
      }
      setDragId(null);
      setOver(null);
    },
  });

  return { dragId, announcement, move, getHandleProps, getRowProps };
}

/** Grip handle of a sortable row. A span (not a button) because Firefox cannot drag buttons. */
export function SortGrip({
  label,
  className,
  ...handleProps
}: { label: string; className?: string } & ReturnType<ReturnType<typeof useSortableList>['getHandleProps']>) {
  const t = useTranslations();
  return (
    <span
      role="button"
      tabIndex={0}
      aria-roledescription={t('content.sortiergriff')}
      aria-label={t('content.verschiebenMitPfeilNach', { label })}
      title={t('content.ziehenOderMitPfeiltasten')}
      className={cn(
        'flex h-11 w-8 flex-none cursor-grab touch-none items-center justify-center rounded-lg text-cool hover:bg-paper hover:text-ink active:cursor-grabbing',
        className,
      )}
      {...handleProps}
    >
      <GripVertical size={20} aria-hidden="true" />
    </span>
  );
}

/**
 * Up / down buttons with aria-labels: the touch fallback for drag and drop (HTML5 drag and drop does not
 * work on most touch screens) and an explicit alternative for the grip's arrow keys.
 */
export function MoveButtons({
  label,
  canUp,
  canDown,
  onUp,
  onDown,
  className,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <span className={cn('inline-flex flex-none items-center', className)}>
      <IconButton aria-label={t('content.nachObenVerschieben', { label })} disabled={!canUp} onClick={onUp}>
        <ChevronUp size={20} aria-hidden="true" />
      </IconButton>
      <IconButton aria-label={t('content.nachUntenVerschieben', { label })} disabled={!canDown} onClick={onDown}>
        <ChevronDown size={20} aria-hidden="true" />
      </IconButton>
    </span>
  );
}
