import Link from 'next/link';
import Image from 'next/image';

export interface VehicleCardData {
  id: string;
  brand: string;
  model: string;
  type: string;
  basePricePerDay: number;
  currency: string;
  specs: {
    horsepower: number;
    transmission: string;
    seats: number;
    fuelType: string;
    range?: string;
  };
  thumbnailUrl: string | null;
  isAvailable?: boolean;
}

interface VehicleCardProps {
  vehicle: VehicleCardData;
  onInquire: (vehicle: VehicleCardData) => void;
}

export function VehicleCard({ vehicle, onInquire }: VehicleCardProps) {
  const specsArray = buildSpecsList(vehicle.specs);
  const displayName = `${vehicle.brand} ${vehicle.model}`;
  const monthlyPrice = Math.round(vehicle.basePricePerDay * 30 * 0.6); // 40% discount for 30+ days

  return (
    <div className="group rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 bg-white flex flex-col">
      {/* Image – links to detail page */}
      <Link href={`/fahrzeuge/${vehicle.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden relative bg-neutral-100">
          {vehicle.thumbnailUrl ? (
            <Image
              src={vehicle.thumbnailUrl}
              alt={displayName}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-300 text-sm">
              Kein Bild
            </div>
          )}

          {/* Price badge */}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
            Ab {vehicle.currency} {vehicle.basePricePerDay} / Tag
          </div>

          {/* Availability indicator */}
          {vehicle.isAvailable !== undefined && (
            <div className={`absolute top-4 left-4 text-xs font-semibold px-3 py-1.5 rounded-full ${
              vehicle.isAvailable
                ? 'bg-emerald-500/90 text-white'
                : 'bg-amber-500/90 text-white'
            }`}>
              {vehicle.isAvailable ? 'Verfügbar' : 'Reserviert'}
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
          {translateType(vehicle.type)}
        </div>
        <Link href={`/fahrzeuge/${vehicle.id}`}>
          <h3 className="text-xl font-bold mb-2 hover:text-brand-600 transition-colors">{displayName}</h3>
        </Link>

        {/* Monthly price hint */}
        <p className="text-xs text-neutral-400 mb-4">
          Ab ca. {vehicle.currency} {monthlyPrice} / Monat bei Langzeitmiete
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {specsArray.map((spec) => (
            <span
              key={spec}
              className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-md"
            >
              {spec}
            </span>
          ))}
        </div>

        <div className="flex gap-3 mt-auto">
          <Link
            href={`/fahrzeuge/${vehicle.id}`}
            className="flex-1 py-3 text-sm font-semibold text-center text-neutral-900 border-2 border-neutral-900 rounded-lg hover:bg-neutral-900 hover:text-white transition-colors"
          >
            Details ansehen
          </Link>
          <button
            onClick={() => onInquire(vehicle)}
            className="flex-1 py-3 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Jetzt anfragen
          </button>
        </div>
      </div>
    </div>
  );
}

function translateType(type: string): string {
  const labels: Record<string, string> = {
    sedan: 'Limousine',
    suv: 'SUV',
    estate: 'Kombi',
    coupe: 'Coupé',
    convertible: 'Cabrio',
    electric: 'Elektrofahrzeug',
    van: 'Van',
  };
  return labels[type] || type;
}

function buildSpecsList(specs: VehicleCardData['specs']): string[] {
  const list: string[] = [];
  if (specs.fuelType === 'electric') {
    list.push('Elektrisch');
  } else {
    list.push(`${specs.horsepower} PS`);
  }
  list.push(specs.transmission === 'automatic' ? 'Automatik' : 'Schaltgetriebe');
  list.push(`${specs.seats} Sitze`);
  const fuelLabels: Record<string, string> = { petrol: 'Benzin', diesel: 'Diesel', electric: 'Elektrisch', hybrid: 'Hybrid' };
  const fuelLabel = fuelLabels[specs.fuelType] || specs.fuelType;
  if (specs.fuelType !== 'electric') list.push(fuelLabel);
  if (specs.range) list.push(specs.range);
  return list;
}
