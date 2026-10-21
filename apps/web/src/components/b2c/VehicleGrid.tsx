import { VehicleCard, type VehicleCardData } from '@/components/b2c/VehicleCard';
import { cn } from '@/components/ui';
import type { PricingTier } from '@/lib/pricing';

/**
 * Responsive grid of vehicle cards.
 *  - 'home':   4 / 2 / 1 columns (desktop / tablet / mobile), gap 24 / 20 / 18
 *  - 'browse': 3 / 2 / 1 columns next to the filter column (4 on ultra-wide), same gaps
 * `cardClassName` adds classes per card, e.g. to hide cards beyond a number per breakpoint
 * (display: none, the links stay in the DOM): the home page shows 4 on mobile, 6 on tablet
 * and 8 on desktop.
 */
interface VehicleGridProps {
  vehicles: VehicleCardData[];
  tiers: PricingTier[];
  columns?: 'home' | 'browse';
  onInquire?: (vehicle: VehicleCardData) => void;
  /** Extra classes per card index (used to cap the visible number of cards). */
  cardClassName?: (index: number) => string | undefined;
  /** Number of leading cards whose photo is loaded eagerly (above the fold). */
  priorityCount?: number;
  className?: string;
}

const COLUMNS = {
  home: 'grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-1',
  browse: 'grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1 3xl:grid-cols-4',
} as const;

export function VehicleGrid({
  vehicles,
  tiers,
  columns = 'home',
  onInquire,
  cardClassName,
  priorityCount = 0,
  className,
}: VehicleGridProps) {
  return (
    <div className={cn('grid gap-6 max-lg:gap-5 max-md:gap-[18px]', COLUMNS[columns], className)}>
      {vehicles.map((vehicle, index) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          tiers={tiers}
          onInquire={onInquire}
          priority={index < priorityCount}
          className={cardClassName?.(index)}
        />
      ))}
    </div>
  );
}
