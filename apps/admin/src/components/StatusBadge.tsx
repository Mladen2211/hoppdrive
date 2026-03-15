interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
  spam: 'bg-red-100 text-red-700',
  reserved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-neutral-100 text-neutral-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  closed: 'Abgeschlossen',
  spam: 'Spam',
  reserved: 'Reserviert',
  active: 'Aktiv',
  completed: 'Erledigt',
  cancelled: 'Storniert',
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
