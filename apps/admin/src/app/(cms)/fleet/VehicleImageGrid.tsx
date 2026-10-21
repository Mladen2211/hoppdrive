'use client';

/**
 * The saved images of a vehicle in the drawer.
 *  - Star: "Als Hauptbild" (PATCH .../primary), optimistic; exactly one image is primary.
 *  - Reorder: drag a thumbnail onto another one (mouse / pen), or focus it and press ArrowLeft / ArrowRight,
 *    or use the move buttons below it (touch). The new order is saved right away (PUT .../images/order).
 *  - X: delete (confirmation is handled by the drawer).
 * The grid never changes anything while `readOnly`.
 */
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { IconButton, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { moveItem } from '@/lib/content-homepage';
import type { FleetImage } from '@/lib/fleet-model';
import { VehicleThumb } from './VehicleThumb';

export interface VehicleImageGridProps {
  vehicleId: string;
  images: FleetImage[];
  readOnly: boolean;
  /** The vehicle form is being saved. */
  disabled?: boolean;
  /** New list after a change (optimistic first, then the server's answer). */
  onChange: (images: FleetImage[]) => void;
  onDelete: (imageId: string) => void;
}

const bySort = (a: FleetImage, b: FleetImage) => a.sortOrder - b.sortOrder;

export function VehicleImageGrid({ vehicleId, images, readOnly, disabled = false, onChange, onDelete }: VehicleImageGridProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const sorted = [...images].sort(bySort);
  const confirmed = useRef<FleetImage[]>(sorted);
  const sequence = useRef(0);
  const [pending, setPending] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

  // Follow changes from outside (a reload, an upload, a delete) while nothing of ours is in flight.
  useEffect(() => {
    if (pending === 0) confirmed.current = [...images].sort(bySort);
  }, [images, pending]);

  // Keep keyboard focus on the moved thumbnail after React re-inserted it.
  useEffect(() => {
    if (!focusId) return;
    document.querySelector<HTMLElement>(`[data-image-handle="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
    setFocusId(null);
  }, [focusId, images]);

  const locked = readOnly || disabled;

  async function run(next: FleetImage[], request: () => Promise<FleetImage[]>, errorTitle: string) {
    const mine = ++sequence.current;
    setPending((n) => n + 1);
    onChange(next);
    try {
      const saved = await request();
      confirmed.current = [...saved].sort(bySort);
      if (mine === sequence.current) onChange(confirmed.current);
    } catch (err) {
      if (mine === sequence.current) onChange(confirmed.current);
      toast.error(errorTitle, errorText(err));
    } finally {
      setPending((n) => n - 1);
    }
  }

  function makePrimary(id: string) {
    if (locked) return;
    const current = sorted.find((i) => i.id === id);
    if (!current || current.isPrimary) return;
    const next = sorted.map((i) => ({ ...i, isPrimary: i.id === id }));
    setAnnouncement(t('fleet.imagePrimarySet'));
    void run(next, () => api.setPrimaryVehicleImage(vehicleId, id) as Promise<FleetImage[]>, t('fleet.imagePrimaryFailed'));
  }

  function reorder(from: number, to: number, keepFocusOn?: string) {
    if (locked || from === to || to < 0 || to >= sorted.length) return;
    const ids = moveItem(sorted.map((i) => i.id), from, to);
    const byId = new Map(sorted.map((i) => [i.id, i]));
    const next = ids.map((id, index) => ({ ...(byId.get(id) as FleetImage), sortOrder: index }));
    setAnnouncement(t('fleet.imagePosition', { position: to + 1, total: sorted.length }));
    if (keepFocusOn) setFocusId(keepFocusOn);
    void run(next, () => api.reorderVehicleImages(vehicleId, ids) as Promise<FleetImage[]>, t('fleet.imageOrderFailed'));
  }

  function onKey(event: KeyboardEvent<HTMLElement>, id: string) {
    if (locked) return;
    const index = sorted.findIndex((i) => i.id === id);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      reorder(index, index + (event.key === 'ArrowLeft' ? -1 : 1), id);
    }
  }

  function onDragOver(event: DragEvent<HTMLElement>, id: string) {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragId === id) {
      if (over) setOver(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const side = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    if (!over || over.id !== id || over.side !== side) setOver({ id, side });
  }

  function onDrop(event: DragEvent<HTMLElement>, id: string) {
    event.preventDefault();
    const from = dragId ? sorted.findIndex((i) => i.id === dragId) : -1;
    const target = sorted.findIndex((i) => i.id === id);
    if (from >= 0 && target >= 0 && from !== target && over) {
      let to = over.side === 'before' ? target : target + 1;
      if (from < to) to -= 1;
      reorder(from, to);
    }
    setDragId(null);
    setOver(null);
  }

  if (sorted.length === 0) return null;

  return (
    <>
      <ul className="m-0 flex list-none flex-wrap items-start gap-2.5 p-0" aria-label={t('fleet.imagesList')}>
        {sorted.map((image, index) => {
          const label = image.alt || t('fleet.bild', { value: index + 1 });
          const drop = over?.id === image.id ? over.side : undefined;
          return (
            <li
              key={image.id}
              draggable={!locked}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', image.id);
                setDragId(image.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOver(null);
              }}
              onDragOver={(event) => onDragOver(event, image.id)}
              onDrop={(event) => onDrop(event, image.id)}
              className={cn(
                'relative flex w-28 flex-col gap-1',
                dragId === image.id && 'opacity-50',
                drop === 'before' && 'before:absolute before:-left-[6px] before:bottom-0 before:top-0 before:w-1 before:rounded-sm before:bg-ruby',
                drop === 'after' && 'after:absolute after:-right-[6px] after:bottom-0 after:top-0 after:w-1 after:rounded-sm after:bg-ruby',
              )}
            >
              <div className="relative">
                <div
                  role="button"
                  tabIndex={locked ? -1 : 0}
                  data-image-handle={image.id}
                  aria-roledescription={t('fleet.imageSortable')}
                  aria-label={t('fleet.imageSortLabel', { position: index + 1, total: sorted.length, primary: image.isPrimary ? 'yes' : 'no' })}
                  onKeyDown={(event) => onKey(event, image.id)}
                  className={cn(
                    'rounded-lg outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-focus',
                    !locked && 'cursor-grab active:cursor-grabbing',
                    image.isPrimary && 'ring-2 ring-ruby ring-offset-2 ring-offset-card',
                  )}
                >
                  <VehicleThumb image={image} alt={label} className="h-[72px] w-28" />
                </div>
                {image.isPrimary && (
                  <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-ruby px-1.5 text-[11px] font-semibold text-white">
                    {t('fleet.imagePrimaryBadge')}
                  </span>
                )}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => makePrimary(image.id)}
                      disabled={disabled}
                      aria-pressed={image.isPrimary}
                      aria-label={image.isPrimary ? t('fleet.imageIsPrimary', { value: index + 1 }) : t('fleet.imageMakePrimary', { value: index + 1 })}
                      title={image.isPrimary ? t('fleet.imagePrimaryBadge') : t('fleet.imageMakePrimaryShort')}
                      className={cn(
                        'absolute left-1 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card shadow-tab max-md:h-11 max-md:w-11',
                        image.isPrimary ? 'text-star' : 'text-graphite hover:text-star',
                      )}
                    >
                      <Star size={16} aria-hidden="true" fill={image.isPrimary ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(image.id)}
                      disabled={disabled}
                      aria-label={t('fleet.bildLoeschen3', { value: index + 1 })}
                      className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink shadow-tab hover:bg-err-tint hover:text-err max-md:h-11 max-md:w-11"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
              {!readOnly && sorted.length > 1 && (
                <div className="flex items-center justify-between">
                  <IconButton
                    aria-label={t('fleet.imageMoveLeft', { value: index + 1 })}
                    disabled={locked || index === 0}
                    onClick={() => reorder(index, index - 1)}
                    className="!h-8 !w-8 max-md:!h-11 max-md:!w-11"
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </IconButton>
                  <span className="sm mut" aria-hidden="true">
                    {index + 1}/{sorted.length}
                  </span>
                  <IconButton
                    aria-label={t('fleet.imageMoveRight', { value: index + 1 })}
                    disabled={locked || index === sorted.length - 1}
                    onClick={() => reorder(index, index + 1)}
                    className="!h-8 !w-8 max-md:!h-11 max-md:!w-11"
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </IconButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
