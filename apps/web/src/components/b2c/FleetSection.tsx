'use client';

import { VehicleCard, type VehicleCardData } from './VehicleCard';

interface FleetSectionProps {
  vehicles: VehicleCardData[];
  loading?: boolean;
  onInquire: (vehicle: VehicleCardData) => void;
}

export function FleetSection({ vehicles, loading, onInquire }: FleetSectionProps) {
  return (
    <section id="fleet" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Unsere günstigen Mietwagen</h2>
          <p className="text-neutral-500 max-w-2xl mx-auto">
            Zuverlässige Kombis, Limousinen & SUVs von Škoda, VW, Toyota und mehr.
            Wählen Sie Ihr Fahrzeug und profitieren Sie von bis zu 40% Langzeitrabatt.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 overflow-hidden bg-white animate-pulse">
                <div className="aspect-[4/3] bg-neutral-200" />
                <div className="p-6 space-y-3">
                  <div className="h-3 bg-neutral-200 rounded w-1/3" />
                  <div className="h-5 bg-neutral-200 rounded w-2/3" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-neutral-100 rounded w-16" />
                    <div className="h-6 bg-neutral-100 rounded w-20" />
                    <div className="h-6 bg-neutral-100 rounded w-14" />
                  </div>
                  <div className="h-11 bg-neutral-200 rounded-lg w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <p className="text-center text-neutral-400 py-12">
            Derzeit sind keine Fahrzeuge verfügbar. Bitte schauen Sie später wieder vorbei.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onInquire={onInquire}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
