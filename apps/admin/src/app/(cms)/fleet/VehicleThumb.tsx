'use client';

import { CarFront } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui';
import { imageSrc, type FleetImage } from '@/lib/fleet-model';

/**
 * Vehicle thumbnail on a grey tile. Falls back to a car icon when the vehicle has no photo or the
 * file cannot be loaded. Plain <img>: uploads live on the API origin (any host) and previews are
 * blob: URLs, neither of which next/image can optimise.
 */
export function VehicleThumb({
  image,
  alt = '',
  className,
}: {
  image?: Pick<FleetImage, 'url'> | null;
  alt?: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = image ? imageSrc(image.url) : '';
  const showImage = Boolean(src) && failedUrl !== src;
  return (
    <span className={cn('flex flex-none items-center justify-center overflow-hidden rounded-lg bg-tile text-graphite', className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploads come from the API origin and previews are blob: URLs
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" onError={() => setFailedUrl(src)} />
      ) : (
        <CarFront size={22} aria-hidden="true" />
      )}
    </span>
  );
}
