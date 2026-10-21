/**
 * StatusPill: dot + word, never colour alone. ONE central map for every
 * status the admin shows (replaces the duplicated colour/label maps in
 * StatusBadge, contracts, availability and reports).
 *
 *   <StatusPill kind="contact" status="pending" />          -> amber "Neu"
 *   <StatusPill kind="booking" status="active" />           -> green "Aktiv"
 *   <StatusPill kind="invoice" status={deriveInvoiceStatus(inv)} />
 *   <StatusPill kind="role" status="RENTAL" tone="amber" />  -> amber "Vermietung" (pending invite)
 *   <StatusPill tone="vio" label="Neu" />                     -> custom tag, no lookup
 *
 * Props:
 *  - kind: 'contact' | 'booking' | 'contract' | 'invoice' | 'vehicle' | 'role' | 'user' | 'permission'
 *  - status: raw API value (case-insensitive: 'pending', 'PENDING', 'Signed' all work)
 *  - tone: override the colour: 'amber' | 'blue' | 'green' | 'red' | 'gray' | 'vio'
 *  - label: override the text
 *  - plain: hide the dot (e.g. permission matrix)
 * Unknown statuses render grey with the raw value, so nothing disappears.
 *
 * Helpers: statusLabel(kind, status), statusTone(kind, status), deriveInvoiceStatus(invoice).
 */
import type { ReactNode } from 'react';
import { tr } from '@/i18n/active';
import { cn } from './cn';

export type StatusKind =
  | 'contact'
  | 'booking'
  | 'contract'
  | 'invoice'
  | 'vehicle'
  | 'role'
  | 'user'
  | 'permission';

export type StatusTone = 'amber' | 'blue' | 'green' | 'red' | 'gray' | 'vio';

interface StatusEntry {
  label: string;
  tone: StatusTone;
  plain?: boolean;
  className?: string;
}

// Full class names are listed literally so Tailwind keeps them.
const TONE_CLASS: Record<StatusTone, string> = {
  amber: 's-amber',
  blue: 's-blue',
  green: 's-green',
  red: 's-red',
  gray: 's-gray',
  vio: 's-vio',
};

/** `labelKey` is a message key (status.<kind>.<status>); the label is looked up lazily in the active language. */
const e = (labelKey: string, tone: StatusTone, extra?: Partial<StatusEntry>): StatusEntry => ({
  get label() {
    return tr(labelKey);
  },
  tone,
  ...extra,
});

/** Keys are lower-case; lookups lower-case the incoming status. */
export const STATUS_MAP: Record<StatusKind, Record<string, StatusEntry>> = {
  // ContactRequestStatus
  contact: {
    pending: e('status.contact.pending', 'amber'),
    reviewed: e('status.contact.reviewed', 'blue'),
    responded: e('status.contact.responded', 'vio'),
    converted: e('status.contact.converted', 'green'),
    denied: e('status.contact.denied', 'red'),
    archived: e('status.contact.archived', 'gray'),
  },
  // BookingStatus
  booking: {
    reserved: e('status.booking.reserved', 'blue'),
    active: e('status.booking.active', 'green'),
    completed: e('status.booking.completed', 'gray'),
    cancelled: e('status.booking.cancelled', 'red'),
  },
  // ContractStatus
  contract: {
    pending: e('status.contract.pending', 'amber'),
    signed: e('status.contract.signed', 'green'),
    voided: e('status.contract.voided', 'gray'),
  },
  // InvoiceStatus (OVERDUE is derived client-side: see deriveInvoiceStatus)
  invoice: {
    pending: e('status.invoice.pending', 'amber'),
    paid: e('status.invoice.paid', 'green'),
    overdue: e('status.invoice.overdue', 'red'),
  },
  // Fleet table (derived from bookings + maintenance + isAvailable)
  vehicle: {
    available: e('status.vehicle.available', 'green'),
    rented: e('status.vehicle.rented', 'green'),
    reserved: e('status.vehicle.reserved', 'blue'),
    maintenance: e('status.vehicle.maintenance', 'amber'),
    offline: e('status.vehicle.offline', 'gray'),
  },
  // AdminRole
  role: {
    admin: e('roles.ADMIN', 'red'),
    rental: e('roles.RENTAL', 'blue'),
    editor: e('roles.EDITOR', 'vio'),
    readonly: e('roles.READONLY', 'gray'),
  },
  // Admin user state (pending invite)
  user: {
    active: e('status.user.active', 'green'),
    invited: e('status.user.invited', 'amber'),
  },
  // Permission matrix cells (Settings > Rechte pro Rolle)
  permission: {
    edit: e('levels.edit', 'green', { plain: true }),
    view: e('levels.view', 'gray', { plain: true }),
    none: e('levels.none', 'gray', { plain: true, className: 'bg-transparent text-graphite' }),
  },
};

function lookup(kind: StatusKind | undefined, status: string | null | undefined): StatusEntry | undefined {
  if (!kind || !status) return undefined;
  return STATUS_MAP[kind][status.toLowerCase()];
}

export function statusLabel(kind: StatusKind, status: string): string {
  return lookup(kind, status)?.label ?? status;
}

export function statusTone(kind: StatusKind, status: string): StatusTone {
  return lookup(kind, status)?.tone ?? 'gray';
}

/**
 * The API only knows PENDING / PAID. A pending invoice whose due date has
 * passed is shown as "Überfällig".
 */
export function deriveInvoiceStatus(invoice: {
  status: string;
  dueDate?: string | Date | null;
}): 'PENDING' | 'PAID' | 'OVERDUE' {
  if (invoice.status === 'PAID') return 'PAID';
  if (invoice.dueDate) {
    const due = new Date(invoice.dueDate);
    due.setHours(23, 59, 59, 999);
    if (due.getTime() < Date.now()) return 'OVERDUE';
  }
  return 'PENDING';
}

export interface StatusPillProps {
  kind?: StatusKind;
  status?: string | null;
  tone?: StatusTone;
  label?: ReactNode;
  plain?: boolean;
  className?: string;
}

export function StatusPill({ kind, status, tone, label, plain, className }: StatusPillProps) {
  const entry = lookup(kind, status);
  const resolvedTone = tone ?? entry?.tone ?? 'gray';
  const text = label ?? entry?.label ?? status ?? '';
  return (
    <span
      className={cn(
        'st',
        TONE_CLASS[resolvedTone],
        (plain ?? entry?.plain) && 'st-plain',
        !tone && entry?.className,
        className,
      )}
    >
      {text}
    </span>
  );
}
