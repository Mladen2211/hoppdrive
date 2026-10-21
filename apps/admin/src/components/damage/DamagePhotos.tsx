'use client';

/**
 * Damage photos: thumbnail strip and lightbox. The photos are private and the API route is authenticated.
 * They are fetched as blobs (Bearer header) and shown through object URLs: a plain <img src> to the API origin
 * is blocked by the API's Cross-Origin-Resource-Policy (helmet default: same-origin) and would also put the
 * access token into the URL. Fetched photos are cached per id for the session of the page.
 */
import type { VehicleDamagePhotoDto } from '@hoppdrive/shared';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, IconButton, Modal } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import { api } from '@/lib/api';

const MAX_CACHED = 120;
const photoCache = new Map<string, Promise<string>>();

/** Object URL of a stored photo (fetched once, then served from the cache). */
function photoUrl(photoId: string): Promise<string> {
  const hit = photoCache.get(photoId);
  if (hit) return hit;
  const pending = api.fetchDamagePhoto(photoId).then((blob) => URL.createObjectURL(new Blob([blob], { type: blob.type || 'image/jpeg' })));
  pending.catch(() => photoCache.delete(photoId)); // a failed fetch is retried next time
  photoCache.set(photoId, pending);
  if (photoCache.size > MAX_CACHED) {
    const oldest = photoCache.keys().next().value as string | undefined;
    if (oldest) {
      const evicted = photoCache.get(oldest);
      photoCache.delete(oldest);
      void evicted?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
    }
  }
  return pending;
}

/** An <img> for a stored photo. */
export function StoredPhoto({ photo, alt, className }: { photo: VehicleDamagePhotoDto; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc(null);
    setBroken(false);
    photoUrl(photo.id)
      .then((url) => live && setSrc(url))
      .catch(() => live && setBroken(true));
    return () => {
      live = false;
    };
  }, [photo.id]);
  if (broken) {
    return (
      <span role="img" aria-label={alt || undefined} className={cn('flex items-center justify-center bg-tile text-center text-[11px] text-graphite', className)}>
        !
      </span>
    );
  }
  if (!src) return <span aria-hidden="true" className={cn('skel block', className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob URL of an authenticated API image; next/image cannot optimise it
    <img src={src} alt={alt} decoding="async" className={className} onError={() => setBroken(true)} />
  );
}

interface PhotoStripProps {
  photos: VehicleDamagePhotoDto[];
  /** Opens the lightbox at this index. */
  onOpen: (index: number) => void;
  /** Name of the damage for the alt / aria texts, e.g. "Kratzer, Tür vorne links". */
  label: string;
  /** Show only the first N thumbnails plus "+k". */
  max?: number;
  className?: string;
}

export function PhotoStrip({ photos, onOpen, label, max = 4, className }: PhotoStripProps) {
  const t = useTranslations();
  if (photos.length === 0) return null;
  const shown = photos.slice(0, max);
  const rest = photos.length - shown.length;
  return (
    <ul className={cn('m-0 flex list-none flex-wrap gap-2 p-0', className)} aria-label={t('damages.photos')}>
      {shown.map((photo, index) => (
        <li key={photo.id}>
          <button
            type="button"
            onClick={() => onOpen(index)}
            aria-label={t('damages.openPhoto', { n: index + 1, total: photos.length, label })}
            className="relative block h-14 w-[72px] overflow-hidden rounded-10 border border-line bg-tile max-md:h-16 max-md:w-20"
          >
            <StoredPhoto photo={photo} alt="" className="h-full w-full object-cover" />
            {rest > 0 && index === shown.length - 1 && (
              <span className="absolute inset-0 flex items-center justify-center bg-inverse/70 text-sm font-bold text-on-inverse">+{rest}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface LightboxProps {
  photos: VehicleDamagePhotoDto[];
  /** null = closed */
  index: number | null;
  label: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Offered when the user may delete photos. Resolves after the photo is gone. */
  onDelete?: (photo: VehicleDamagePhotoDto) => void | Promise<void>;
}

export function PhotoLightbox({ photos, index, label, onIndexChange, onClose, onDelete }: LightboxProps) {
  const t = useTranslations();
  const open = index !== null && photos.length > 0;
  const current = open ? Math.min(index, photos.length - 1) : 0;
  const photo = photos[current];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onIndexChange((current - 1 + photos.length) % photos.length);
      else if (event.key === 'ArrowRight') onIndexChange((current + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, current, photos.length, onIndexChange]);

  // Photo deleted from inside the lightbox and none left: close.
  useEffect(() => {
    if (index !== null && photos.length === 0) onClose();
  }, [index, photos.length, onClose]);

  if (!open || !photo) return null;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t('damages.photoOf', { n: current + 1, total: photos.length })}
      description={label}
      footer={
        <>
          {onDelete && (
            <Button
              variant="ghost"
              className="!border-edge-err !text-err hover:!bg-err-tint mr-auto"
              iconLeft={<Trash2 size={18} aria-hidden="true" />}
              onClick={() => void onDelete(photo)}
            >
              {t('damages.deletePhoto')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t('ui.schliessen')}
          </Button>
        </>
      }
    >
      <div className="relative flex min-h-[200px] items-center justify-center rounded-xl bg-tile">
        <StoredPhoto photo={photo} alt={t('damages.photoAlt', { n: current + 1, label })} className="max-h-[62dvh] w-auto max-w-full rounded-xl object-contain" />
        {photos.length > 1 && (
          <>
            <IconButton
              variant="outline"
              aria-label={t('damages.previousPhoto')}
              className="absolute left-2 top-1/2 -translate-y-1/2 !bg-card"
              onClick={() => onIndexChange((current - 1 + photos.length) % photos.length)}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </IconButton>
            <IconButton
              variant="outline"
              aria-label={t('damages.nextPhoto')}
              className="absolute right-2 top-1/2 -translate-y-1/2 !bg-card"
              onClick={() => onIndexChange((current + 1) % photos.length)}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </IconButton>
          </>
        )}
      </div>
    </Modal>
  );
}
