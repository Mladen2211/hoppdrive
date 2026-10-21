'use client';

/**
 * CarDiagram: the five-view car sketch (CAR_DIAGRAM from @hoppdrive/shared, the same drawing as in the damage
 * report PDF) with numbered damage pins.
 *
 *   <CarDiagram pins={pins} selectedId={id} onSelect={setId} />                       read-only
 *   <CarDiagram pins={pins} onPlace={(view, x, y) => ...} onMove={(id, x, y) => ...} /> interactive
 *
 * Layout: `auto` (default) measures its own width. From 600 px it shows all five views like the PDF (left and
 * right side by side, then front / top / rear); narrower, it shows one view at a time with a view switcher, so
 * it stays usable in the 440 px drawer, on a phone and on a tablet at the counter.
 *
 * Interaction (only when `onPlace` / `onMove` are given):
 *   - tap or click on the sketch -> onPlace(view, x, y)  (x, y are fractions 0..1 of that view)
 *   - a pin with `movable` can be dragged (pointer events) or nudged with the arrow keys
 *     (1 %, Shift = 5 %) -> onMove(id, x, y)
 *   - pins are real buttons: Tab to them, Enter / Space selects, aria-label "Schaden 3: Kratzer, Tür vorne links".
 *     Placing a pin without pointer is done in the damage form (view + area), which moves the same pin.
 *
 * Colours are theme tokens only: pins are ruby (open), green with a check (repaired) or ink (the unsaved pin
 * being placed); the pin size grows with the severity. `isNew` adds a "NEU" tag (found during this rental).
 */
import type { CarDiagramViewKey, DamageSeverity } from '@hoppdrive/shared';
import { CAR_DIAGRAM } from '@hoppdrive/shared';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { cn } from '@/components/ui/cn';
import { DIAGRAM_VIEWS, clamp01, damageViewLabel, pct } from '@/lib/damage-model';

export type PinTone = 'open' | 'repaired' | 'draft';

export interface DiagramPin {
  id: string;
  view: CarDiagramViewKey;
  /** 0..1 of the view's width / height */
  x: number;
  y: number;
  /** Text in the pin, usually the damage number. */
  label?: string | number;
  tone?: PinTone;
  severity?: DamageSeverity;
  /** Found during the current rental: shows the "NEU" tag. */
  isNew?: boolean;
  /** Accessible name, e.g. "Schaden 3: Kratzer, Tür vorne links". */
  ariaLabel: string;
  /** Can be dragged / nudged (the damage being placed or edited). */
  movable?: boolean;
}

export interface CarDiagramProps {
  pins: DiagramPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Tap on the sketch. Leave undefined for a read-only diagram. */
  onPlace?: (view: CarDiagramViewKey, x: number, y: number) => void;
  /** A movable pin was dragged or nudged. */
  onMove?: (id: string, x: number, y: number) => void;
  layout?: 'auto' | 'overview' | 'tabs';
  /** Switches the single-view layout to this view whenever it changes (e.g. the view of the selected damage). */
  followView?: CarDiagramViewKey | null;
  /** Short instruction below the drawing; also its accessible description. */
  hint?: string;
  className?: string;
  'aria-label'?: string;
}

/** Widest a single view gets in the one-view layout (px): keeps the tall top view from filling the screen. */
const SINGLE_MAX_WIDTH: Record<CarDiagramViewKey, number> = { left: 560, right: 560, front: 380, rear: 380, top: 190 };
const OVERVIEW_MIN_WIDTH = 600;

const PIN_SIZE: Record<DamageSeverity, string> = {
  minor: 'h-6 w-6 text-[11px]',
  medium: 'h-7 w-7 text-[13px]',
  major: 'h-8 w-8 text-sm',
};
const PIN_TONE: Record<PinTone, string> = {
  open: 'bg-ruby text-white',
  repaired: 'bg-ok text-on-fill',
  draft: 'bg-ink text-on-ink motion-safe:animate-pulse',
};

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function useElementWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (typeof next === 'number') setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// ─── One pin ───────────────────────────────────────────────────────────────

interface PinButtonProps {
  pin: DiagramPin;
  selected: boolean;
  surfaceRef: RefObject<HTMLDivElement>;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
}

function PinButton({ pin, selected, surfaceRef, onSelect, onMove }: PinButtonProps) {
  const t = useTranslations();
  const movable = Boolean(pin.movable && onMove);
  const gesture = useRef<{ px: number; py: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const tone = pin.tone ?? 'open';
  const size = tone === 'draft' ? PIN_SIZE.major : PIN_SIZE[pin.severity ?? 'medium'];
  const x = drag?.x ?? pin.x;
  const y = drag?.y ?? pin.y;

  const toFraction = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!movable || event.button > 0) return;
    gesture.current = { px: event.clientX, py: event.clientY, moved: false };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already gone */
    }
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved && Math.hypot(event.clientX - g.px, event.clientY - g.py) < 4) return;
    g.moved = true;
    const next = toFraction(event);
    if (next) setDrag(next);
  };
  const finishGesture = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* not captured */
    }
    if (g?.moved && commit) {
      suppressClick.current = true; // the click that follows the drop must not select / place anything
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 60);
      const next = toFraction(event);
      if (next) onMove?.(pin.id, next.x, next.y);
    }
    setDrag(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!movable) return;
    const step = event.shiftKey ? 0.05 : 0.01;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    else return;
    event.preventDefault();
    onMove?.(pin.id, clamp01(pin.x + dx), clamp01(pin.y + dy));
  };

  return (
    <button
      type="button"
      aria-label={pin.ariaLabel}
      aria-pressed={onSelect ? selected : undefined}
      aria-roledescription={movable ? t('damages.movablePin') : undefined}
      data-pin={pin.id}
      className={cn(
        'absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full max-md:h-12 max-md:w-12',
        movable ? 'cursor-grab touch-none active:cursor-grabbing' : onSelect ? 'cursor-pointer' : 'cursor-default',
      )}
      style={{ left: pct(x), top: pct(y) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event, true)}
      onPointerCancel={(event) => finishGesture(event, false)}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        // Never let the tap reach the sketch underneath (that would place a second pin).
        event.stopPropagation();
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect?.(pin.id);
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex items-center justify-center rounded-full font-cond font-bold leading-none shadow-[0_1px_3px_rgba(0,0,0,.35)] ring-2 ring-card transition-transform',
          size,
          PIN_TONE[tone],
          selected && 'scale-125 !ring-[3px] !ring-ink',
          drag && 'scale-125',
        )}
      >
        {tone === 'repaired' ? <Check size={14} strokeWidth={3.5} /> : pin.label}
      </span>
      {pin.isNew && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 top-0 rounded bg-info px-1 text-[10px] font-bold leading-[14px] text-on-fill"
        >
          {t('damages.newBadge')}
        </span>
      )}
    </button>
  );
}

// ─── One view ──────────────────────────────────────────────────────────────

interface ViewFigureProps {
  view: CarDiagramViewKey;
  pins: DiagramPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onPlace?: CarDiagramProps['onPlace'];
  onMove?: CarDiagramProps['onMove'];
  describedBy?: string;
  className?: string;
  style?: React.CSSProperties;
  showCaption?: boolean;
}

function ViewFigure({ view, pins, selectedId, onSelect, onPlace, onMove, describedBy, className, style, showCaption = true }: ViewFigureProps) {
  const geometry = CAR_DIAGRAM.views[view];
  const surfaceRef = useRef<HTMLDivElement>(null);
  const label = damageViewLabel(view);

  const handleSurfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onPlace) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    onPlace(view, clamp01((event.clientX - rect.left) / rect.width), clamp01((event.clientY - rect.top) / rect.height));
  };

  return (
    <figure className={cn('m-0 flex min-w-0 flex-col items-center gap-1', className)} style={style}>
      {showCaption && <figcaption className="text-[13px] font-semibold text-graphite">{label}</figcaption>}
      <div
        ref={surfaceRef}
        role="group"
        aria-label={label}
        aria-describedby={describedBy}
        data-view={view}
        className={cn('relative w-full select-none touch-manipulation', onPlace && 'cursor-crosshair')}
        style={{ aspectRatio: `${geometry.width} / ${geometry.height}` }}
        onClick={handleSurfaceClick}
      >
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {geometry.paths.map((d, i) => (
            <path key={`fill-${i}`} d={d} className="fill-paper" />
          ))}
          {geometry.details.map((d, i) => (
            <path key={`detail-${i}`} d={d} fill="none" className="stroke-field" strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
          {geometry.paths.map((d, i) => (
            <path key={`line-${i}`} d={d} fill="none" className="stroke-ink" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {pins.map((pin) => (
          <PinButton key={pin.id} pin={pin} selected={pin.id === selectedId} surfaceRef={surfaceRef} onSelect={onSelect} onMove={onMove} />
        ))}
      </div>
    </figure>
  );
}

// ─── The diagram ───────────────────────────────────────────────────────────

export function CarDiagram({
  pins,
  selectedId = null,
  onSelect,
  onPlace,
  onMove,
  layout = 'auto',
  followView = null,
  hint,
  className,
  'aria-label': ariaLabel,
}: CarDiagramProps) {
  const t = useTranslations();
  const baseId = useId();
  const hintId = hint ? `${baseId}-hint` : undefined;
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const overview = layout === 'overview' || (layout === 'auto' && width >= OVERVIEW_MIN_WIDTH);

  const byView = useMemo(() => {
    const map = new Map<CarDiagramViewKey, DiagramPin[]>();
    DIAGRAM_VIEWS.forEach((view) => map.set(view, []));
    pins.forEach((pin) => map.get(pin.view)?.push(pin));
    return map;
  }, [pins]);

  const firstBusy = DIAGRAM_VIEWS.find((view) => (byView.get(view)?.length ?? 0) > 0) ?? 'left';
  const [active, setActive] = useState<CarDiagramViewKey>(followView ?? firstBusy);

  // Follow the view of the selected / edited damage.
  useEffect(() => {
    if (followView) setActive(followView);
  }, [followView]);

  const focusTab = useCallback(
    (view: CarDiagramViewKey) => {
      setActive(view);
      requestAnimationFrame(() => document.getElementById(`${baseId}-tab-${view}`)?.focus());
    },
    [baseId],
  );

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, view: CarDiagramViewKey) => {
    const index = DIAGRAM_VIEWS.indexOf(view);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % DIAGRAM_VIEWS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + DIAGRAM_VIEWS.length) % DIAGRAM_VIEWS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DIAGRAM_VIEWS.length - 1;
    if (next === -1) return;
    event.preventDefault();
    focusTab(DIAGRAM_VIEWS[next]);
  };

  const figure = (view: CarDiagramViewKey, props: { className?: string; style?: React.CSSProperties; showCaption?: boolean } = {}) => (
    <ViewFigure
      key={view}
      view={view}
      pins={byView.get(view) ?? []}
      selectedId={selectedId}
      onSelect={onSelect}
      onPlace={onPlace}
      onMove={onMove}
      describedBy={hintId}
      {...props}
    />
  );

  return (
    <div ref={wrapRef} className={cn('w-full min-w-0', className)} role="group" aria-label={ariaLabel ?? t('damages.diagramLabel')}>
      <div className="rounded-2xl border border-line bg-card p-4 max-md:p-3">
        {overview ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-6">
              {figure('left')}
              {figure('right')}
            </div>
            <div className="grid grid-cols-[1fr_0.62fr_1fr] items-center gap-6">
              {figure('front')}
              {figure('top')}
              {figure('rear')}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div role="tablist" aria-label={t('damages.viewTabs')} className="grid grid-cols-5 gap-1 rounded-xl bg-paper p-1">
              {DIAGRAM_VIEWS.map((view) => {
                const count = byView.get(view)?.length ?? 0;
                const selected = view === active;
                return (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${view}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(view)}
                    onKeyDown={(event) => onTabKey(event, view)}
                    className={cn(
                      'relative flex min-h-[44px] items-center justify-center gap-1 rounded-[9px] px-1 text-[13px] font-semibold max-md:min-h-[48px]',
                      selected ? 'bg-card text-ink shadow-tab' : 'text-graphite hover:text-ink',
                    )}
                  >
                    {damageViewLabel(view)}
                    {count > 0 && (
                      <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ruby px-1 font-cond text-[10px] font-bold leading-none text-white" aria-label={t('damages.pinsInView', { count })}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} className="flex justify-center">
              {figure(active, { className: 'w-full', style: { maxWidth: SINGLE_MAX_WIDTH[active] }, showCaption: false })}
            </div>
          </div>
        )}
      </div>
      {hint && (
        <p id={hintId} className="hint mt-2">
          {hint}
        </p>
      )}
    </div>
  );
}
