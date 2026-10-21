'use client';

/**
 * "Schäden" tab of the fleet drawer: the car diagram with the vehicle's damages, a filter (Offen / Repariert /
 * Alle), the damage form (tap the sketch or "Schaden hinzufügen"), and the numbered list with photos, edit,
 * "Als repariert markieren" and delete. Without edit permission everything is read-only (diagram, list, photos).
 */
import type { VehicleDamageDto } from '@hoppdrive/shared';
import { Plus, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ChipGroup, EmptyState, Skeleton, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { damageAriaLabel, damageTypeLabel, numberDamages, type DamageBookingOption } from '@/lib/damage-model';
import { errorText } from '@/lib/errors';
import { CarDiagram, type DiagramPin } from './CarDiagram';
import { DamageForm } from './DamageForm';
import { DamageList } from './DamageList';
import { PhotoLightbox } from './DamagePhotos';
import { useDamageEditor, type SaveResult } from './useDamageEditor';

type Filter = 'open' | 'repaired' | 'all';

export interface VehicleDamagesPanelProps {
  vehicleId: string;
  vehicleName: string;
  canEdit: boolean;
  /** Bookings of this vehicle ("Entdeckt bei Buchung"). */
  bookings?: DamageBookingOption[];
  /** Number of open damages, whenever it changes (badge on the tab). */
  onOpenCountChange?: (count: number) => void;
}

export function VehicleDamagesPanel({ vehicleId, vehicleName, canEdit, bookings = [], onOpenCountChange }: VehicleDamagesPanelProps) {
  const t = useTranslations();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [damages, setDamages] = useState<VehicleDamageDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ damageId: string; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setDamages(await api.getVehicleDamages(vehicleId));
    } catch (err) {
      setLoadError(errorText(err, t('damages.errors.loadFailed')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = useCallback((updated: VehicleDamageDto) => {
    setDamages((list) => {
      if (!list) return [updated];
      return list.some((d) => d.id === updated.id) ? list.map((d) => (d.id === updated.id ? updated : d)) : [...list, updated];
    });
  }, []);

  const editor = useDamageEditor({
    vehicleId,
    onSaved: ({ damage, created, failedPhotos }: SaveResult) => {
      replace(damage);
      setSelectedId(damage.id);
      toast.success(created ? t('damages.created') : t('damages.updated'), `${damageTypeLabel(damage.type)}, ${damage.zone}`);
      if (failedPhotos.length > 0) toast.error(t('damages.photosFailed', { count: failedPhotos.length }), failedPhotos.join(', '));
      if (damage.status === 'OPEN') setFilter((f) => (f === 'repaired' ? 'all' : f));
    },
    onChanged: replace,
  });
  const { draft } = editor;

  const numbered = useMemo(() => numberDamages(damages ?? []), [damages]);
  const counts = useMemo(
    () => ({
      open: numbered.filter((d) => d.status === 'OPEN').length,
      repaired: numbered.filter((d) => d.status === 'REPAIRED').length,
      all: numbered.length,
    }),
    [numbered],
  );
  useEffect(() => {
    if (damages) onOpenCountChange?.(counts.open);
  }, [damages, counts.open, onOpenCountChange]);

  const visible = useMemo(
    () => numbered.filter((d) => (filter === 'open' ? d.status === 'OPEN' : filter === 'repaired' ? d.status === 'REPAIRED' : true)),
    [numbered, filter],
  );

  const pins = useMemo<DiagramPin[]>(() => {
    const list: DiagramPin[] = visible
      .filter((d) => d.id !== draft?.id)
      .map((d) => ({
        id: d.id,
        view: d.view,
        x: d.x,
        y: d.y,
        label: d.n ?? undefined,
        tone: d.status === 'OPEN' ? 'open' : 'repaired',
        severity: d.severity,
        ariaLabel: damageAriaLabel(d),
      }));
    if (draft) {
      const editing = draft.id ? numbered.find((d) => d.id === draft.id) : undefined;
      list.push({
        id: 'draft',
        view: draft.view,
        x: draft.x,
        y: draft.y,
        label: editing?.n ?? (draft.id ? undefined : '+'),
        tone: draft.id ? (editing?.status === 'REPAIRED' ? 'repaired' : 'open') : 'draft',
        severity: draft.severity,
        movable: true,
        ariaLabel: draft.id ? t('damages.pinEditing', { zone: draft.zone }) : t('damages.pinNew', { zone: draft.zone }),
      });
    }
    return list;
  }, [visible, draft, numbered, t]);

  const selectedDamage = numbered.find((d) => d.id === selectedId) ?? null;

  const select = (id: string) => {
    if (id === 'draft') return;
    setSelectedId(id);
    window.requestAnimationFrame(() => document.querySelector(`[data-damage="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  // ── Actions ───────────────────────────────────────────────────

  const repair = async (damage: VehicleDamageDto) => {
    const done = await confirm({
      title: t('damages.repairTitle'),
      description: t('damages.repairText', { label: `${damageTypeLabel(damage.type)}, ${damage.zone}` }),
      confirmLabel: t('damages.markRepaired'),
      tone: 'primary',
      icon: <Wrench size={20} />,
      onConfirm: async () => {
        setBusyId(damage.id);
        try {
          replace(await api.repairDamage(vehicleId, damage.id));
        } catch (err) {
          throw new Error(errorText(err, t('damages.errors.repairFailed')));
        } finally {
          setBusyId(null);
        }
      },
    });
    if (done) toast.success(t('damages.repaired'), damage.zone);
  };

  const reopen = async (damage: VehicleDamageDto) => {
    setBusyId(damage.id);
    try {
      replace(await api.updateDamage(vehicleId, damage.id, { status: 'OPEN' }));
      toast.success(t('damages.reopened'), damage.zone);
    } catch (err) {
      toast.error(t('damages.errors.reopenFailed'), errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (damage: VehicleDamageDto) => {
    const done = await confirm({
      title: t('damages.deleteTitle'),
      description: t('damages.deleteText', { label: `${damageTypeLabel(damage.type)}, ${damage.zone}` }),
      confirmLabel: t('damages.deleteDamage'),
      icon: <Trash2 size={20} />,
      onConfirm: async () => {
        setBusyId(damage.id);
        try {
          await api.deleteDamage(vehicleId, damage.id);
          setDamages((list) => (list ?? []).filter((d) => d.id !== damage.id));
          if (draft?.id === damage.id) editor.cancel();
          if (selectedId === damage.id) setSelectedId(null);
        } catch (err) {
          throw new Error(errorText(err, t('damages.errors.deleteFailed')));
        } finally {
          setBusyId(null);
        }
      },
    });
    if (done) toast.success(t('damages.deleted'));
  };

  const deleteFromLightbox = async (damage: VehicleDamageDto, photoId: string) => {
    const done = await confirm({
      title: t('damages.deletePhotoTitle'),
      description: t('damages.deletePhotoText'),
      confirmLabel: t('damages.deletePhoto'),
      onConfirm: async () => {
        try {
          replace(await api.deleteDamagePhoto(damage.id, photoId));
        } catch (err) {
          throw new Error(errorText(err, t('damages.errors.photoDeleteFailed')));
        }
      },
    });
    if (done) toast.success(t('damages.photoDeleted'));
  };

  // ── Render ────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Alert
        tone="err"
        title={t('damages.errors.loadFailed')}
        action={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t('common.erneutVersuchen')}
          </Button>
        }
      >
        {loadError}
      </Alert>
    );
  }
  if (damages === null) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label={t('damages.loading')}>
        <Skeleton className="h-10 w-2/3" rounded={12} />
        <Skeleton className="h-64 w-full" rounded={16} />
        <Skeleton className="h-24 w-full" rounded={12} />
      </div>
    );
  }

  const lightboxDamage = lightbox ? (numbered.find((d) => d.id === lightbox.damageId) ?? null) : null;
  const emptyText =
    counts.all === 0 ? t('damages.emptyNone') : filter === 'open' ? t('damages.emptyOpen') : filter === 'repaired' ? t('damages.emptyRepaired') : t('damages.emptyNone');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChipGroup<Filter>
          aria-label={t('damages.filterLabel')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: t('damages.filterOpen'), count: counts.open },
            { value: 'repaired', label: t('damages.filterRepaired'), count: counts.repaired },
            { value: 'all', label: t('common.alle'), count: counts.all },
          ]}
        />
        {canEdit && !draft && (
          <Button size="sm" iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => editor.begin(filter === 'repaired' ? 'left' : (selectedDamage?.view ?? 'left'))}>
            {t('damages.add')}
          </Button>
        )}
      </div>

      {counts.all === 0 && !draft && (
        <EmptyState
          compact
          tone="neutral"
          icon={<ShieldCheck size={28} />}
          title={t('damages.emptyTitle')}
          text={canEdit ? t('damages.emptyTextEdit', { vehicle: vehicleName }) : t('damages.emptyTextView')}
        />
      )}

      <CarDiagram
        pins={pins}
        selectedId={draft ? 'draft' : selectedId}
        onSelect={select}
        onPlace={canEdit ? editor.place : undefined}
        onMove={canEdit ? (_id, x, y) => editor.move(x, y) : undefined}
        followView={draft?.view ?? selectedDamage?.view ?? null}
        hint={canEdit ? t('damages.hintEdit') : t('damages.hintView')}
        aria-label={t('damages.diagramOf', { vehicle: vehicleName })}
      />

      {canEdit && draft && <DamageForm editor={editor} bookings={bookings} />}

      {counts.all > 0 && (
        <section aria-label={t('damages.listLabel')} className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
            {t('damages.listTitle', { count: visible.length })}
          </h3>
          <DamageList
            damages={visible}
            selectedId={selectedId}
            onSelect={select}
            canEdit={canEdit}
            busyId={busyId}
            onEdit={editor.edit}
            onRepair={(d) => void repair(d)}
            onReopen={(d) => void reopen(d)}
            onDelete={(d) => void remove(d)}
            onOpenPhotos={(d, index) => setLightbox({ damageId: d.id, index })}
            emptyText={emptyText}
          />
        </section>
      )}

      <PhotoLightbox
        photos={lightboxDamage?.photos ?? []}
        index={lightbox && lightboxDamage ? lightbox.index : null}
        label={lightboxDamage ? `${damageTypeLabel(lightboxDamage.type)}, ${lightboxDamage.zone}` : ''}
        onIndexChange={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
        onClose={() => setLightbox(null)}
        onDelete={canEdit && lightboxDamage ? (photo) => deleteFromLightbox(lightboxDamage, photo.id) : undefined}
      />
    </div>
  );
}
