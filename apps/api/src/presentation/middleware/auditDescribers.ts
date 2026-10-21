import type { Container } from '../../infrastructure/config/container';
import { vehicleLabel, type AuditDescriber } from './auditMiddleware';

/**
 * Reusable "describe before the handler runs" helpers for the audit middleware.
 * They collect the small, human-meaningful facts the activity log turns into sentences
 * (customer name, vehicle name, old values). They never include passwords, tokens or
 * request bodies as a whole.
 */

/** "Škoda Kodiaq" for a vehicle id, or undefined. */
export async function vehicleLabelById(container: Container, vehicleId: unknown): Promise<string | undefined> {
  if (typeof vehicleId !== 'string' || !vehicleId) return undefined;
  try {
    const v = await container.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { brand: true, model: true },
    });
    return vehicleLabel(v);
  } catch {
    return undefined;
  }
}

/** { customerName, vehicle } of the booking in :id (+ optional extra fields). */
export function describeBooking(
  container: Container,
  extra?: (req: Parameters<AuditDescriber>[0]) => Record<string, unknown>,
): AuditDescriber {
  return async (req) => {
    const booking = await container.prisma.booking.findUnique({
      where: { id: req.params.id },
      select: { customerName: true, startDate: true, endDate: true, vehicle: { select: { brand: true, model: true } } },
    });
    return {
      customerName: booking?.customerName,
      vehicle: vehicleLabel(booking?.vehicle),
      startDate: booking?.startDate,
      endDate: booking?.endDate,
      ...(extra ? extra(req) : {}),
    };
  };
}

/** { customerName } of the contact request in :id (+ optional extra fields). */
export function describeInquiry(
  container: Container,
  extra?: (req: Parameters<AuditDescriber>[0]) => Promise<Record<string, unknown>> | Record<string, unknown>,
): AuditDescriber {
  return async (req) => {
    const inquiry = await container.prisma.contactRequest.findUnique({
      where: { id: req.params.id },
      select: { fullName: true },
    });
    return { customerName: inquiry?.fullName, ...(extra ? await extra(req) : {}) };
  };
}

/** Truncates free text so the log stays small. */
export function snippet(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** { code, label } of the discount code in :id (+ optional extra fields), for the activity log. */
export function describeDiscountCode(
  container: Container,
  extra?: (req: Parameters<AuditDescriber>[0]) => Record<string, unknown>,
): AuditDescriber {
  return async (req) => {
    const row = await container.prisma.discountCode.findUnique({
      where: { id: req.params.id },
      select: { code: true, label: true, type: true, value: true, active: true, recipientEmail: true },
    });
    return {
      code: row?.code,
      label: snippet(row?.label),
      discount: row ? `${row.type === 'PERCENT' ? `${Number(row.value)} %` : Number(row.value).toFixed(2)}` : undefined,
      personal: row ? !!row.recipientEmail : undefined,
      ...(extra ? extra(req) : {}),
    };
  };
}

/** { vehicle: 'Škoda Kodiaq', licensePlate } of the vehicle in :id (+ optional extra fields). */
export function describeVehicleById(
  container: Container,
  extra?: (req: Parameters<AuditDescriber>[0]) => Record<string, unknown>,
): AuditDescriber {
  return async (req) => {
    const v = await container.prisma.vehicle.findUnique({
      where: { id: req.params.id },
      select: { brand: true, model: true, licensePlate: true },
    });
    return { vehicle: vehicleLabel(v), licensePlate: v?.licensePlate ?? undefined, ...(extra ? extra(req) : {}) };
  };
}
