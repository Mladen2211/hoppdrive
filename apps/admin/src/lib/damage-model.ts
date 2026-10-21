/**
 * Damage tool model: labels (through the admin messages), numbering, pin geometry and the zone presets
 * used by the damage diagram, the Schäden tab of the fleet drawer, the inspection dialog and the sign page.
 *
 * The diagram itself (5 views, pins as 0..1 fractions) is defined once in @hoppdrive/shared (CAR_DIAGRAM) and
 * is the same drawing the damage report PDF uses. Zone names ("Tür vorne links") come from the shared
 * suggestDamageZone() and are stored as free text in German, because contracts, reports and e-mails are German.
 */
import {
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPES,
  DAMAGE_TYPE_LABELS,
  DAMAGE_VIEW_LABELS,
  suggestDamageZone,
  type CarDiagramViewKey,
  type DamageSeverity,
  type DamageType,
  type VehicleDamageDto,
} from '@hoppdrive/shared';
import { tr } from '@/i18n/active';

export const DIAGRAM_VIEWS: readonly CarDiagramViewKey[] = ['left', 'right', 'front', 'rear', 'top'];
export const SEVERITIES: readonly DamageSeverity[] = ['minor', 'medium', 'major'];
export { DAMAGE_TYPES };

export const damageViewLabel = (view: CarDiagramViewKey): string => {
  const key = `damages.view.${view}`;
  const text = tr(key);
  return text === key ? DAMAGE_VIEW_LABELS[view] : text;
};
export const damageTypeLabel = (type: DamageType): string => {
  const key = `damages.type.${type}`;
  const text = tr(key);
  return text === key ? (DAMAGE_TYPE_LABELS[type] ?? type) : text;
};
export const damageSeverityLabel = (severity: DamageSeverity): string => {
  const key = `damages.severity.${severity}`;
  const text = tr(key);
  return text === key ? (DAMAGE_SEVERITY_LABELS[severity] ?? severity) : text;
};

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** A damage plus its running number: open damages are numbered 1..n in the order they were recorded (as in the PDFs). */
export interface NumberedDamage extends VehicleDamageDto {
  /** 1-based number of an OPEN damage; null for repaired damages. */
  n: number | null;
}

/** Numbers the OPEN damages 1..n (oldest first, like the contract and the damage report); repaired ones get none. */
export function numberDamages(list: readonly VehicleDamageDto[]): NumberedDamage[] {
  const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  let counter = 0;
  return sorted.map((damage) => ({ ...damage, n: damage.status === 'OPEN' ? ++counter : null }));
}

/** "Schaden 3: Kratzer, Tür vorne links" (used as the accessible name of a pin and in the list). */
export function damageAriaLabel(damage: Pick<NumberedDamage, 'n' | 'type' | 'zone' | 'status'>): string {
  return damage.status === 'REPAIRED' || damage.n === null
    ? tr('damages.pinRepaired', { type: damageTypeLabel(damage.type), zone: damage.zone })
    : tr('damages.pinLabel', { n: damage.n, type: damageTypeLabel(damage.type), zone: damage.zone });
}

export interface ZonePreset {
  zone: string;
  x: number;
  y: number;
}

const presetCache = new Map<CarDiagramViewKey, ZonePreset[]>();

/**
 * The body areas of a view with a representative point each, derived from suggestDamageZone() so that the
 * list can never disagree with the pin -> zone suggestion. For people who cannot drag or tap a pin on the
 * sketch: choosing an area places the pin there.
 */
export function zonePresets(view: CarDiagramViewKey): ZonePreset[] {
  const cached = presetCache.get(view);
  if (cached) return cached;
  const steps = 40;
  const groups = new Map<string, { xs: number[]; ys: number[] }>();
  for (let iy = 0; iy < steps; iy += 1) {
    for (let ix = 0; ix < steps; ix += 1) {
      const x = (ix + 0.5) / steps;
      const y = (iy + 0.5) / steps;
      const zone = suggestDamageZone(view, x, y);
      const group = groups.get(zone) ?? { xs: [], ys: [] };
      group.xs.push(x);
      group.ys.push(y);
      groups.set(zone, group);
    }
  }
  const presets: ZonePreset[] = [];
  groups.forEach((group, zone) => {
    const cx = group.xs.reduce((a, b) => a + b, 0) / group.xs.length;
    const cy = group.ys.reduce((a, b) => a + b, 0) / group.ys.length;
    // The sample of the zone nearest to its centre (the centre itself can lie outside an L-shaped zone).
    let best = 0;
    let bestDist = Infinity;
    group.xs.forEach((x, index) => {
      const dist = (x - cx) ** 2 + (group.ys[index] - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    presets.push({ zone, x: Number(group.xs[best].toFixed(3)), y: Number(group.ys[best].toFixed(3)) });
  });
  presets.sort(view === 'top' ? (a, b) => a.y - b.y || a.x - b.x : (a, b) => a.x - b.x || a.y - b.y);
  presetCache.set(view, presets);
  return presets;
}

/** Position of the pin in percent of its view (for CSS left/top). */
export const pct = (fraction: number): string => `${(clamp01(fraction) * 100).toFixed(3)}%`;

/** A booking the damage form can offer as "found during rental". */
export interface DamageBookingOption {
  id: string;
  customerName?: string;
  startDate: string;
  endDate: string;
  status?: string;
}
