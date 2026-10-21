import {
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPE_LABELS,
  DAMAGE_VIEW_LABELS,
  type DamageSeverity,
  type DamageType,
  type DamageView,
} from '@hoppdrive/shared';

/** The fields of a damage that every text rendering needs. */
export interface DamageLike {
  view: string;
  zone: string;
  type: string;
  severity: string;
  description: string;
  createdAt?: Date;
}

export const typeLabel = (t: string) => DAMAGE_TYPE_LABELS[t as DamageType] ?? t;
export const severityLabel = (s: string) => DAMAGE_SEVERITY_LABELS[s as DamageSeverity] ?? s;
export const viewLabel = (v: string) => DAMAGE_VIEW_LABELS[v as DamageView] ?? v;

/** "Vorne links" style area: the zone text, else the view name. */
export const areaLabel = (d: { view: string; zone: string }) => d.zone.trim() || viewLabel(d.view);

/** "1. Kratzer – Tür vorne links (leicht): kleiner Kratzer" */
export function damageLine(d: DamageLike, number: number): string {
  const base = `${number}. ${typeLabel(d.type)} – ${areaLabel(d)} (${severityLabel(d.severity).toLowerCase()})`;
  return d.description.trim() ? `${base}: ${d.description.trim()}` : base;
}

/** Numbered list for the contract field `existingDamages`; "Keine bekannten Schäden." when empty. */
export function damageListText(damages: DamageLike[], separator = '\n'): string {
  if (damages.length === 0) return 'Keine bekannten Schäden.';
  return damages.map((d, i) => damageLine(d, i + 1)).join(separator);
}
