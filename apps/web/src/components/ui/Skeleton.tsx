/**
 * Skeleton placeholders: loading states in the SHAPE of the content (no spinner
 * for whole sections). The shimmer stops under prefers-reduced-motion.
 *
 *   <Skeleton className="h-5 w-2/3" />       single block (size via classes or props)
 *   <VehicleCardSkeleton />                   the vehicle card's loading state (aria-busy)
 *
 * Skeleton props: width?, height? (number = px, or any CSS size), rounded? (CSS radius), className.
 */
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { cn } from './cn';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height, rounded, className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('skel', className)}
      style={{ width, height, borderRadius: rounded, ...style }}
    />
  );
}

export function VehicleCardSkeleton({ className }: { className?: string }) {
  const t = useTranslations('common');
  return (
    <div
      aria-busy="true"
      role="status"
      className={cn('overflow-hidden rounded-18 border border-line bg-white', className)}
    >
      <span className="sr-only">{t('loadingVehicle')}</span>
      <Skeleton className="aspect-[4/3] w-full" rounded={0} />
      <div className="flex flex-col gap-2.5 p-[18px]">
        <Skeleton className="h-5 w-[70%]" />
        <Skeleton className="h-3.5 w-[45%]" />
        <Skeleton className="h-[30px] w-[55%]" />
      </div>
    </div>
  );
}
