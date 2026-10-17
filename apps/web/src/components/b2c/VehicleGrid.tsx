'use client';

import { useRouter } from 'next/navigation';
import { VehicleCard, type VehicleCardData } from './VehicleCard';

interface VehicleGridProps {
  vehicles: VehicleCardData[];
  emptyMessage?: string;
}

/**
 * Thin client boundary around VehicleCard for the server-rendered
 * /fahrzeuge and /mieten/[kategorie] pages, which have no on-page contact
 * form (unlike the homepage's FleetSection + SelectedVehicleProvider). "Jetzt
 * anfragen" instead sends the visitor to the homepage contact form.
 */
export function VehicleGrid({ vehicles, emptyMessage }: VehicleGridProps) {
  const router = useRouter();

  if (vehicles.length === 0) {
    return (
      <p className="text-center text-neutral-400 py-12">
        {emptyMessage || 'Derzeit sind keine Fahrzeuge verfügbar. Bitte schauen Sie später wieder vorbei.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {vehicles.map((vehicle) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          onInquire={() => router.push('/#contact-form')}
        />
      ))}
    </div>
  );
}
