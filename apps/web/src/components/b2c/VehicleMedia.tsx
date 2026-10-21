/**
 * Photo area of a vehicle (card, gallery thumbnails): the uploaded photo, or
 * the car silhouette with a "Foto folgt" label when there is none. Never an
 * empty box (design rule). The parent must be `relative` with a size; this
 * component fills it.
 */
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { CarSilhouette, cn } from '@/components/ui';
import { canOptimizeImage } from '@/lib/images';
import { mediaGradient, silhouetteFor, type VehicleCardData } from '@/lib/vehicles';

interface VehicleMediaProps {
  vehicle: Pick<VehicleCardData, 'type' | 'specs'>;
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Show the small "Foto folgt" label on the silhouette (default true). */
  label?: boolean;
  /** Silhouette width as utility classes, e.g. "w-[88%]". */
  silhouetteClassName?: string;
  className?: string;
}

export function VehicleMedia({
  vehicle,
  src,
  alt,
  sizes,
  priority = false,
  label = true,
  silhouetteClassName = 'w-[88%] mb-2.5',
  className,
}: VehicleMediaProps) {
  const t = useTranslations('vehicleCard');
  return (
    <div className={cn('absolute inset-0 flex items-end justify-center overflow-hidden', mediaGradient(vehicle), className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
          unoptimized={!canOptimizeImage(src)}
          className="object-cover"
        />
      ) : (
        <>
          <CarSilhouette variant={silhouetteFor(vehicle.type)} className={silhouetteClassName} />
          {label && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[11px] text-[#55595C]">
              {t('photoSoon')}
            </span>
          )}
        </>
      )}
    </div>
  );
}
