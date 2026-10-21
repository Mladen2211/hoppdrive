'use client';

/**
 * The numbered list of damages that goes with the diagram: number, area, type, severity, description,
 * since when, photos. Rows select the matching pin; with `canEdit` each row also offers Bearbeiten,
 * "Als repariert markieren" / "Wieder öffnen" and Löschen. Used by the fleet tab, the inspection dialog
 * and (read-only) the sign page.
 */
import { Check, Pencil, RotateCcw, Trash2, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, StatusPill } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import { damageSeverityLabel, damageTypeLabel, type NumberedDamage } from '@/lib/damage-model';
import { fmtDate } from '@/lib/format';
import { PhotoStrip } from './DamagePhotos';
import type { DamageSeverity, VehicleDamageDto } from '@hoppdrive/shared';

const SEVERITY_TONE: Record<DamageSeverity, 'gray' | 'amber' | 'red'> = { minor: 'gray', medium: 'amber', major: 'red' };

export interface DamageListProps {
  damages: NumberedDamage[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Damages found during the booking being inspected: get the "NEU" tag. */
  newIds?: ReadonlySet<string>;
  canEdit?: boolean;
  busyId?: string | null;
  onEdit?: (damage: VehicleDamageDto) => void;
  onRepair?: (damage: VehicleDamageDto) => void;
  onReopen?: (damage: VehicleDamageDto) => void;
  onDelete?: (damage: VehicleDamageDto) => void;
  /** Hide Löschen for some rows (default: all). */
  canDelete?: (damage: VehicleDamageDto) => boolean;
  onOpenPhotos?: (damage: VehicleDamageDto, index: number) => void;
  emptyText: string;
  className?: string;
}

export function DamageList({
  damages,
  selectedId,
  onSelect,
  newIds,
  canEdit = false,
  busyId = null,
  onEdit,
  onRepair,
  onReopen,
  onDelete,
  canDelete,
  onOpenPhotos,
  emptyText,
  className,
}: DamageListProps) {
  const t = useTranslations();
  if (damages.length === 0) {
    return <p className={cn('mut rounded-xl bg-paper px-4 py-3.5 text-center', className)}>{emptyText}</p>;
  }
  return (
    <ul className={cn('m-0 flex list-none flex-col gap-2.5 p-0', className)}>
      {damages.map((damage) => {
        const repaired = damage.status === 'REPAIRED';
        const selected = damage.id === selectedId;
        const isNew = newIds?.has(damage.id) ?? false;
        const busy = busyId === damage.id;
        const label = `${damageTypeLabel(damage.type)}, ${damage.zone}`;
        const body = (
          <>
            <b className="block break-words text-[15px]">{damage.zone}</b>
            <span className="sm mut mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{damageTypeLabel(damage.type)}</span>
              <StatusPill tone={SEVERITY_TONE[damage.severity]} label={damageSeverityLabel(damage.severity)} plain className="!h-[22px] !text-xs" />
              {isNew && <StatusPill tone="blue" label={t('damages.newBadge')} plain className="!h-[22px] !text-xs" />}
              {repaired && <StatusPill tone="green" label={t('damages.statusRepaired')} className="!h-[22px] !text-xs" />}
            </span>
            {damage.description && <span className="sm mt-1.5 block whitespace-pre-wrap break-words">{damage.description}</span>}
          </>
        );
        return (
          <li
            key={damage.id}
            className={cn('rounded-xl border-[1.5px] bg-card', selected ? 'border-ink' : 'border-line', repaired && 'bg-row')}
            data-damage={damage.id}
          >
            <div className="flex gap-3 p-3.5">
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 flex-none items-center justify-center rounded-full font-cond text-sm font-bold',
                  repaired ? 'bg-ok text-on-fill' : 'bg-ruby text-white',
                )}
              >
                {repaired ? <Check size={16} strokeWidth={3.5} /> : damage.n}
              </span>
              <div className="min-w-0 flex-1">
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(damage.id)}
                    aria-pressed={selected}
                    aria-label={t('damages.selectDamage', { label: repaired ? label : `${damage.n}: ${label}` })}
                    className="-m-1 block w-[calc(100%+8px)] rounded-lg p-1 text-left"
                  >
                    {body}
                  </button>
                ) : (
                  <div>{body}</div>
                )}
                {damage.photos.length > 0 && (
                  <PhotoStrip
                    photos={damage.photos}
                    label={label}
                    onOpen={(index) => onOpenPhotos?.(damage, index)}
                    className="mt-2"
                  />
                )}
                <p className="sm mut mt-1.5">
                  {t('damages.since', { date: fmtDate(damage.createdAt) })}
                  {repaired && damage.repairedAt ? ` · ${t('damages.repairedOn', { date: fmtDate(damage.repairedAt) })}` : ''}
                </p>
              </div>
            </div>
            {canEdit && (onEdit || onRepair || onDelete) && (
              <div className="flex flex-wrap gap-2 border-t border-line-soft px-3.5 py-2.5">
                {onEdit && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onEdit(damage)} iconLeft={<Pencil size={16} aria-hidden="true" />}>
                    {t('damages.edit')}
                  </Button>
                )}
                {!repaired && onRepair && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onRepair(damage)} iconLeft={<Wrench size={16} aria-hidden="true" />}>
                    {t('damages.markRepaired')}
                  </Button>
                )}
                {repaired && onReopen && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReopen(damage)} iconLeft={<RotateCcw size={16} aria-hidden="true" />}>
                    {t('damages.reopen')}
                  </Button>
                )}
                {onDelete && (canDelete?.(damage) ?? true) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto !text-err hover:!bg-err-tint"
                    disabled={busy}
                    onClick={() => onDelete(damage)}
                    iconLeft={<Trash2 size={16} aria-hidden="true" />}
                  >
                    {t('common.loeschen')}
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
