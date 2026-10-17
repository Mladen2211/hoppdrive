'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
}

const CROSSFADE_MS = 150;

export function VehicleImageGallery({ images, thumbnailUrl, alt }: VehicleImageGalleryProps) {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasMultiple = sorted.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Crossfade: fade the current image out, swap the src while invisible, fade back in.
  // (The old `transition-opacity` class here did nothing — swapping `src` on the same
  // <img> has no opacity state change to transition between.)
  useEffect(() => {
    if (activeIndex === displayIndex) return;
    setFading(true);
    const timer = setTimeout(() => {
      setDisplayIndex(activeIndex);
      setFading(false);
    }, CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, displayIndex]);

  // Fallback: if no gallery images, use thumbnail
  if (sorted.length === 0 && thumbnailUrl) {
    return (
      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={alt}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 flex items-center justify-center text-neutral-300">
        Kein Bild verfügbar
      </div>
    );
  }

  const prev = () => setActiveIndex((i) => (i - 1 + sorted.length) % sorted.length);
  const next = () => setActiveIndex((i) => (i + 1) % sorted.length);

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sorted[displayIndex].url}
          alt={sorted[displayIndex].alt || alt}
          className={`w-full h-full object-cover transition-opacity duration-150 ease-out ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {hasMultiple && (
          <>
            <button
              onClick={prev}
              aria-label="Vorheriges Bild"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Nächstes Bild"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {sorted.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Bild ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === activeIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                i === activeIndex ? 'border-brand-600' : 'border-transparent hover:border-neutral-300'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt || `${alt} – Bild ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
