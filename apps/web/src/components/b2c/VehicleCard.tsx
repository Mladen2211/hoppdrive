import Link from 'next/link';

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
}

interface VehicleCardProps {
  vehicle: VehicleCardData;
  onInquire: (vehicle: VehicleCardData) => void;
}

export function VehicleCard({ vehicle, onInquire }: VehicleCardProps) {
  const specsArray = buildSpecsList(vehicle.specs);
  const displayName = `${vehicle.brand} ${vehicle.model}`;

  return (
    <div className="group rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 bg-white">
      {/* Image – links to detail page */}
      <Link href={`/fahrzeuge/${vehicle.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden relative bg-neutral-100">
          {vehicle.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicle.thumbnailUrl}
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-300 text-sm">
              Kein Bild
            </div>
          )}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
            Ab {vehicle.currency} {vehicle.basePricePerDay} / Tag
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="p-6">
        <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
          {vehicle.type}
        </div>
        <Link href={`/fahrzeuge/${vehicle.id}`}>
          <h3 className="text-xl font-bold mb-4 hover:text-brand-600 transition-colors">{displayName}</h3>
        </Link>
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
        <div className="flex gap-3">
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
            Offerte anfragen
          </button>
        </div>
      </div>
    </div>
  );
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
