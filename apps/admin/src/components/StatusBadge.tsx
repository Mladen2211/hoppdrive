import { StatusPill, type StatusKind } from '@/components/ui';

interface StatusBadgeProps {
  status: string;
}

const CONTACT = ['pending', 'reviewed', 'responded', 'converted', 'denied', 'archived'];
const BOOKING = ['reserved', 'active', 'completed', 'cancelled'];

/**
 * Legacy wrapper kept for existing imports; it only picks the right kind for <StatusPill>.
 * Lower-case values are contact-request / booking statuses ('pending' = "Neu"), upper-case values
 * are contract statuses (PENDING / SIGNED / VOIDED). New code should use <StatusPill kind=... />.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  let kind: StatusKind | undefined;
  if (CONTACT.includes(status)) kind = 'contact';
  else if (BOOKING.includes(status)) kind = 'booking';
  else if (['PENDING', 'SIGNED', 'VOIDED'].includes(status)) kind = 'contract';
  return <StatusPill kind={kind} status={status} />;
}
