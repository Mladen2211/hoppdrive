'use client';

/**
 * Hero stage as an accessible carousel of the fleet's main images (WAI-ARIA carousel pattern).
 *
 *  - one slide per vehicle with an image: photo (object-cover), name and "ab X / Tag" chip,
 *    the whole slide links to the vehicle page
 *  - autoplay every 5 s; paused while the mouse is over the carousel, while a control has
 *    keyboard focus, while the tab is hidden, and after the visitor pressed "pause";
 *    never started with prefers-reduced-motion (no pause button then either)
 *  - previous / next (48 px), dots, swipe (pointer events) and the arrow keys
 *  - the live region only speaks when the carousel is NOT rotating by itself
 *  - slides that are not shown are aria-hidden and out of the tab order; their photos are only
 *    mounted next to the current slide (the first one with `priority`)
 *
 * `children` (Swiss cross, "Ab CHF" tag) are rendered by the server and sit above the slides.
 */
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { CarSilhouette, IconButton, cn, useMediaQuery } from '@/components/ui';
import { useSiteFormatters } from '@/i18n/CurrencyProvider';
import { Link } from '@/i18n/navigation';
import { canOptimizeImage } from '@/lib/images';

export interface HeroSlide {
  id: string;
  /** "Brand Model" */
  name: string;
  /** Vehicle page slug (/fahrzeuge/<slug>). */
  slug: string;
  /** Main (primary) image; null until a photo is uploaded (the silhouette is shown instead). */
  imageUrl: string | null;
  /** Silhouette used while there is no image. */
  silhouette?: 'estate' | 'suv' | 'sedan';
  /** Base price per day. */
  price: number;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  /** Classes of the ruby stage panel (shared with the fallback stage of the hero). */
  stageClassName: string;
  children?: ReactNode;
}

export const AUTOPLAY_MS = 5000;
const SWIPE_PX = 40;
const SIZES = '(min-width: 1024px) 50vw, 100vw';

export function HeroCarousel({ slides, stageClassName, children }: HeroCarouselProps) {
  const t = useTranslations('hero.carousel');
  const f = useSiteFormatters();
  const count = slides.length;
  const multiple = count > 1;
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const current = Math.min(index, Math.max(count - 1, 0));
  const autoplay = multiple && !reducedMotion && !userPaused;
  const running = autoplay && !hovered && !focused && !tabHidden;

  const goTo = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const go = useCallback((delta: number) => setIndex((i) => (((i + delta) % count) + count) % count), [count]);

  // Photos of the slides next to the current one (and every slide shown so far) are mounted.
  useEffect(() => {
    setVisited((list) => (list.includes(current) ? list : [...list, current]));
  }, [current]);

  // Next slide after 5 s; every change of slide (also a manual one) restarts the timer.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [running, current, count]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!multiple || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    }
  }

  function onFocus(event: FocusEvent<HTMLElement>) {
    // Only keyboard focus pauses; a mouse click on a button must not freeze the carousel.
    let visible = true;
    try {
      visible = event.target.matches(':focus-visible');
    } catch {
      /* old engines: treat it as keyboard focus */
    }
    if (visible) setFocused(true);
  }

  function onBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }

  // Swipe (touch, pen and mouse drag). `touch-action: pan-y` keeps vertical scrolling native.
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!multiple || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest('button')) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // A drag that ends on the slide link must not open the vehicle page.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 80);
      go(dx < 0 ? 1 : -1);
    }
  }

  const active = slides[current];

  return (
    <section
      {...(multiple ? { 'aria-roledescription': t('roleDescription') } : {})}
      aria-label={t('label')}
      className="flex min-w-0 flex-col gap-2.5"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        className={cn(stageClassName, 'touch-pan-y select-none')}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {slides.map((slide, i) => {
          const shown = i === current;
          const mounted = visited.includes(i) || i === (current + 1) % count || i === (current - 1 + count) % count;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription={multiple ? t('slideRole') : undefined}
              aria-label={multiple ? t('slideLabel', { current: i + 1, total: count }) : undefined}
              aria-hidden={shown ? undefined : true}
              className={cn(
                'absolute inset-0 transition-opacity duration-[600ms] ease-out motion-reduce:transition-none',
                shown ? 'z-[1] opacity-100' : 'pointer-events-none opacity-0',
              )}
            >
              <Link
                href={`/fahrzeuge/${slide.slug}`}
                tabIndex={shown ? undefined : -1}
                draggable={false}
                className="absolute inset-0 block text-ink no-underline"
              >
                {!slide.imageUrl && (
                  // No photo yet: silhouette standing on the road line, like the plain hero stage.
                  <span className="absolute inset-x-0 bottom-[84px] flex justify-center max-md:bottom-14 3xl:bottom-24">
                    <span className="relative block w-[88%] max-md:w-[92%]">
                      <span aria-hidden="true" className="absolute -inset-x-[200%] bottom-[10.8%] h-[3px] bg-white/40" />
                      <CarSilhouette variant={slide.silhouette ?? 'estate'} className="relative w-full" />
                    </span>
                  </span>
                )}
                {slide.imageUrl && mounted && (
                  <Image
                    src={slide.imageUrl}
                    alt=""
                    fill
                    priority={i === 0}
                    sizes={SIZES}
                    unoptimized={!canOptimizeImage(slide.imageUrl)}
                    draggable={false}
                    className="object-cover"
                  />
                )}
                {slide.imageUrl && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                  />
                )}
                <span
                  className={cn(
                    'absolute bottom-4 left-4 flex flex-col rounded-[14px] bg-white px-4 py-2.5 shadow-tab max-md:bottom-3 max-md:left-3 max-md:px-3 max-md:py-2 3xl:bottom-6 3xl:left-6',
                    multiple ? 'max-w-[calc(100%-9.5rem)] max-md:max-w-[calc(100%-8.75rem)]' : 'max-w-[calc(100%-2rem)]',
                  )}
                >
                  <b className="text-[17px] font-bold leading-tight tracking-[-0.01em] max-md:text-[15px]">{slide.name}</b>
                  <span className="num text-[15px] font-semibold leading-tight text-ruby-dark max-md:text-sm">
                    {t('fromPerDay', { price: f.money(slide.price, { decimals: 0 }) })}
                  </span>
                </span>
              </Link>
            </div>
          );
        })}

        {children}

        {multiple && (
          <div className="absolute bottom-4 right-4 z-[3] flex gap-2 max-md:bottom-3 max-md:right-3 3xl:bottom-6 3xl:right-6">
            <IconButton aria-label={t('previous')} onClick={() => go(-1)} className="shadow-tab">
              <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
            </IconButton>
            <IconButton aria-label={t('next')} onClick={() => go(1)} className="shadow-tab">
              <ChevronRight size={22} strokeWidth={2.4} aria-hidden="true" />
            </IconButton>
          </div>
        )}

        {multiple && (
          <span className="sr-only" aria-live={running ? 'off' : 'polite'} aria-atomic="true">
            {t('live', { name: active.name, current: current + 1, total: count })}
          </span>
        )}
      </div>

      {multiple && (
        <div className="flex items-center justify-center gap-1.5">
          {!reducedMotion && (
            <button
              type="button"
              aria-label={userPaused ? t('play') : t('pause')}
              title={userPaused ? t('play') : t('pause')}
              onClick={() => setUserPaused((paused) => !paused)}
              className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full text-ink hover:bg-white"
            >
              {userPaused ? (
                <Play size={16} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Pause size={16} strokeWidth={2.4} aria-hidden="true" />
              )}
            </button>
          )}
          <div role="group" aria-label={t('dots')} className="flex flex-wrap items-center justify-center">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={t('goTo', { number: i + 1, name: slide.name })}
                aria-current={i === current ? 'true' : undefined}
                onClick={() => goTo(i)}
                className="group flex h-8 min-w-6 cursor-pointer items-center justify-center px-0.5"
              >
                <span
                  className={cn(
                    'block h-2 rounded-full transition-all motion-reduce:transition-none',
                    i === current ? 'w-[22px] bg-ruby' : 'w-2 bg-cool group-hover:bg-graphite',
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
