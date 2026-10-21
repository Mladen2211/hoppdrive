'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react';
import { VehicleMedia } from '@/components/b2c/VehicleMedia';
import { IconButton, cn } from '@/components/ui';
import { sortImagesPrimaryFirst } from '@/lib/images';
import type { VehicleCardData } from '@/lib/vehicles';

interface VehicleImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

interface VehicleImageGalleryProps {
  images: VehicleImage[];
  thumbnailUrl: string | null;
  alt: string;
  /** Needed for the silhouette placeholder when there is no photo. */
  vehicle: Pick<VehicleCardData, 'type' | 'specs'>;
  /** Overlay at the top left of the main image (availability badge). */
  badge?: ReactNode;
}

const SIZES_MAIN = '(min-width: 1024px) 58vw, 100vw';

/**
 * Gallery: large image with previous/next arrows that are ALWAYS visible (48 px
 * touch targets, not hover-only), a thumbnail strip from 768 px up and, on
 * mobile, a "1 / 5" counter with dots. Swipe and the arrow keys work too.
 * Without photos it shows the car silhouette with "Foto folgt".
 */
export function VehicleImageGallery({ images, thumbnailUrl, alt, vehicle, badge }: VehicleImageGalleryProps) {
  const t = useTranslations('gallery');
  const slides = useMemo(() => {
    // Starts with the main image (isPrimary), then the order chosen in the admin.
    const sorted = sortImagesPrimaryFirst(images);
    if (sorted.length > 0) return sorted.map((img) => ({ id: img.id, url: img.url, alt: img.alt }));
    return thumbnailUrl ? [{ id: 'thumbnail', url: thumbnailUrl, alt }] : [];
  }, [images, thumbnailUrl, alt]);

  const count = slides.length;
  const multiple = count > 1;
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const current = slides[Math.min(index, Math.max(count - 1, 0))];

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!multiple) return;
    if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStart.current === null || !multiple) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3.5 max-md:gap-3" onKeyDown={onKeyDown}>
      <div
        role="group"
        aria-roledescription={t('roleDescription')}
        aria-label={t('groupLabel', { name: alt })}
        className="relative aspect-[4/3] overflow-hidden rounded-[22px] max-md:-mx-5 max-md:rounded-none"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX;
        }}
        onTouchEnd={onTouchEnd}
      >
        <VehicleMedia
          vehicle={vehicle}
          src={current?.url ?? null}
          alt={current?.alt || alt}
          sizes={SIZES_MAIN}
          priority
          silhouetteClassName="w-[84%] mb-[34px] max-md:w-[88%] max-md:mb-[22px]"
          className="[&>span]:!right-4 [&>span]:!top-[18px] [&>span]:!px-2.5 [&>span]:!py-[3px] [&>span]:!text-xs max-md:[&>span]:!top-4 max-md:[&>span]:!text-[11px]"
        />
        {badge && <div className="absolute left-[18px] top-[18px] max-md:left-4 max-md:top-4">{badge}</div>}

        {multiple && (
          <>
            <IconButton
              aria-label={t('previous')}
              onClick={() => go(-1)}
              className="absolute left-4 top-1/2 -mt-6 shadow-tab max-md:left-3"
            >
              <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label={t('next')}
              onClick={() => go(1)}
              className="absolute right-4 top-1/2 -mt-6 shadow-tab max-md:right-3"
            >
              <ChevronRight size={22} strokeWidth={2.4} aria-hidden="true" />
            </IconButton>
            <span
              className="absolute bottom-3.5 right-4 rounded-full bg-ink-dark/85 px-2.5 py-[3px] text-[13px] text-white md:hidden"
              aria-hidden="true"
            >
              {t('counter', { current: index + 1, total: count })}
            </span>
          </>
        )}
        <span className="sr-only" aria-live="polite">
          {multiple ? t('live', { current: index + 1, total: count }) : ''}
        </span>
      </div>

      {multiple && (
        <>
          <div className="flex justify-center gap-2 md:hidden" aria-hidden="true">
            {slides.map((slide, i) => (
              <span
                key={slide.id}
                className={cn('h-2 rounded-full', i === index ? 'w-[22px] bg-ruby' : 'w-2 bg-cool')}
              />
            ))}
          </div>

          <div className="grid grid-cols-5 gap-3 max-md:hidden">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={t('thumbnail', { number: i + 1 })}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  'relative aspect-[4/3] min-h-12 overflow-hidden rounded-14 bg-white p-0',
                  i === index ? 'border-[3px] border-ruby' : 'border-[1.5px] border-line',
                )}
              >
                <VehicleMedia vehicle={vehicle} src={slide.url} alt="" sizes="160px" label={false} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
