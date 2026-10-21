'use client';

import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/b2c/EmptyState';
import { PriceCalculator } from '@/components/b2c/PriceCalculator';
import { useSelectedVehicle } from '@/components/b2c/SelectedVehicleContext';
import { VehicleGrid } from '@/components/b2c/VehicleGrid';
import { Button, Chip } from '@/components/ui';
import { fleetCategories, type VehicleCardData } from '@/lib/vehicles';
import type { FleetContent } from '@/types/homepage-sections';

export type { FleetContent };

interface FleetSectionProps {
  vehicles: VehicleCardData[];
  loading?: boolean;
  content?: FleetContent;
}

/**
 * Cards beyond these counts are hidden per breakpoint (display: none; the
 * links stay in the document): 4 on mobile, 6 on tablet, 8 on desktop, all on
 * ultra-wide. "Alle N Fahrzeuge ansehen" leads to the complete list.
 */
function homeCap(index: number): string | undefined {
  const classes: string[] = [];
  if (index >= 4) classes.push('max-md:hidden');
  if (index >= 6) classes.push('md:max-lg:hidden');
  if (index >= 8) classes.push('lg:max-3xl:hidden');
  return classes.length > 0 ? classes.join(' ') : undefined;
}

export function FleetSection({ vehicles, content }: FleetSectionProps) {
  const t = useTranslations('fleet');
  const tCategory = useTranslations('fleetCategory');
  const c = content || {};
  const { tiers, selectVehicle } = useSelectedVehicle();
  const [activeKey, setActiveKey] = useState('all');

  const categories = useMemo(() => fleetCategories(vehicles, tCategory), [vehicles, tCategory]);
  const active = categories.find((category) => category.key === activeKey);
  const filtered = useMemo(
    () => (active ? vehicles.filter(active.predicate) : vehicles),
    [vehicles, active],
  );

  const label = c.label ?? t('label');
  const heading =
    c.heading ?? (vehicles.length > 0 ? t('headingCount', { count: vehicles.length }) : t('headingEmpty'));

  return (
    <section id="fleet" className="sec">
      <div className="wrap">
        <div className="mb-8 flex flex-col gap-6 max-md:mb-[22px] 3xl:flex-row 3xl:items-end 3xl:justify-between 3xl:gap-8">
          <div className="sec-head !mb-0">
            <p className="kick">{label}</p>
            <h2 className="h2">{heading}</h2>
            {c.description && <p className="lead">{c.description}</p>}
          </div>

          {/* Only categories that contain vehicles, with their counts */}
          {categories.length > 1 && (
            <div
              role="group"
              aria-label={t('filterAria')}
              className="chips max-md:-mr-5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1 max-md:pr-5"
            >
              <Chip pressed={activeKey === 'all'} count={vehicles.length} onClick={() => setActiveKey('all')}>
                {t('all')}
              </Chip>
              {categories.map((category) => (
                <Chip
                  key={category.key}
                  pressed={activeKey === category.key}
                  count={category.count}
                  onClick={() => setActiveKey(category.key)}
                >
                  {category.label}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {vehicles.length === 0 ? (
          <EmptyState
            icon={<SearchX size={34} />}
            title={t('emptyTitle')}
            text={t('emptyText')}
            actions={<Button href="#contact-form">{t('emptyCta')}</Button>}
          />
        ) : (
          <div className="3xl:grid 3xl:grid-cols-[minmax(0,1fr)_380px] 3xl:items-start 3xl:gap-10">
            <div>
              <div aria-live="polite" className="sr-only">
                {t('liveCount', { count: filtered.length })}
              </div>
              <VehicleGrid
                vehicles={filtered}
                tiers={tiers}
                columns="home"
                onInquire={(vehicle) => selectVehicle({ vehicleId: vehicle.id })}
                cardClassName={homeCap}
              />
            </div>
            {/* Ultra-wide: sticky price box next to the fleet */}
            <aside className="sticky top-6 hidden 3xl:block" aria-label={t('priceAside')}>
              <PriceCalculator variant="sidebar" />
            </aside>
          </div>
        )}

        {vehicles.length > 0 && (
          <div className="mt-10 flex justify-center max-md:mt-7 3xl:hidden">
            <Button href="/fahrzeuge" variant="outline" size="lg" className="max-md:w-full">
              {t('viewAll', { count: vehicles.length })}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
