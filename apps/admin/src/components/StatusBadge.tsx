interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  // Contact request statuses
  pending: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-yellow-100 text-yellow-700',
  responded: 'bg-purple-100 text-purple-700',
  converted: 'bg-green-100 text-green-700',
  archived: 'bg-neutral-100 text-neutral-600',
  // Booking statuses
  reserved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-neutral-100 text-neutral-700',
  cancelled: 'bg-red-100 text-red-700',
  // Contract statuses
  PENDING: 'bg-amber-100 text-amber-700',
  SIGNED: 'bg-green-100 text-green-700',
  VOIDED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  // Contact request statuses
  pending: 'Neu',
  reviewed: 'Geprüft',
  responded: 'Beantwortet',
  converted: 'Buchung erstellt',
  archived: 'Archiviert',
  // Booking statuses
  reserved: 'Reserviert',
  active: 'Aktiv',
  completed: 'Erledigt',
  cancelled: 'Storniert',
  // Contract statuses
  PENDING: 'Ausstehend',
  SIGNED: 'Signiert',
  VOIDED: 'Storniert',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-neutral-100 text-neutral-600';
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
