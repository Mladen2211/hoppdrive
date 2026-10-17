'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { VehicleCard, type VehicleCardData } from './VehicleCard';
import { useSelectedVehicle } from './SelectedVehicleContext';
import type { FleetContent } from '@/types/homepage-sections';

export type { FleetContent };

interface FleetSectionProps {
  vehicles: VehicleCardData[];
  loading?: boolean;
  content?: FleetContent;
}

type FilterKey = 'all' | 'sedan' | 'suv' | 'estate' | 'van' | 'electric';

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'sedan', label: 'Limousinen' },
  { key: 'suv', label: 'SUV' },
  { key: 'estate', label: 'Kombi' },
  { key: 'van', label: 'Van' },
  { key: 'electric', label: 'Elektro' },
];

export function FleetSection({ vehicles, loading, content }: FleetSectionProps) {
  const c = content || {};
  const label = c.label ?? 'Unsere Flotte';
  const heading = c.heading ?? 'Günstige Mietwagen für jeden Anlass';
  const description = c.description ?? 'Zuverlässige Kombis, Limousinen & SUVs von Škoda, VW, Toyota und mehr. Wählen Sie Ihr Fahrzeug und profitieren Sie von bis zu 40% Langzeitrabatt.';
  const { selectVehicle } = useSelectedVehicle();
  const onInquire = (vehicle: VehicleCardData) => selectVehicle(`${vehicle.brand} ${vehicle.model}`);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // Only show filter tabs that have at least one vehicle
  const availableFilters = useMemo(() => {
    const types = new Set(vehicles.map((v) => v.type));
    return FILTER_OPTIONS.filter((f) => f.key === 'all' || types.has(f.key));
  }, [vehicles]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return vehicles;
    return vehicles.filter((v) => v.type === activeFilter);
  }, [vehicles, activeFilter]);

  return (
    <section id="fleet" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-brand-600 font-semibold text-sm uppercase tracking-wider">
            {label}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
            {heading}
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
            {description}
          </p>
        </div>

        {/* Filters */}
        {!loading && availableFilters.length > 2 && (
          <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
            <SlidersHorizontal className="w-4 h-4 text-neutral-400 mr-1" />
            {availableFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

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
        ) : filtered.length === 0 ? (
          <p className="text-center text-neutral-400 py-12">
            {activeFilter === 'all'
              ? 'Derzeit sind keine Fahrzeuge verfügbar. Bitte schauen Sie später wieder vorbei.'
              : 'Keine Fahrzeuge in dieser Kategorie. Versuchen Sie einen anderen Filter.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onInquire={onInquire}
              />
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/fahrzeuge"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Alle Fahrzeuge ansehen
          </Link>
        </div>
      </div>
    </section>
  );
}
