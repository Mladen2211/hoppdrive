'use client';

/**
 * "Abholung / Rückgabe protokollieren": the vehicle check at handover and return.
 *
 * Shows the car diagram with the vehicle's open damages, lets the staff add damages that are not yet known
 * (tap the sketch: they are stored on the vehicle right away, with photos), and records Zeitpunkt,
 * Kilometerstand, Tank / Ladestand and Bemerkungen. On a return the damages added here (and the ones already
 * linked to this booking) are passed as newDamageIds, so the report marks them "NEU" and the damage invoice can
 * be created. A pick-up check treats newly added damages as pre-existing ones that are only recorded now.
 * Saving renders the report PDF (open it from the done view).
 */
import type { BookingInspectionDto, InspectionType, VehicleDamageDto } from '@hoppdrive/shared';
import { FileText, Plus, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ChipGroup, Field, Input, Modal, Skeleton, Textarea, useToast } from '@/components/ui';
import { CarDiagram, type DiagramPin } from '@/components/damage/CarDiagram';
import { DamageForm } from '@/components/damage/DamageForm';
import { DamageList } from '@/components/damage/DamageList';
import { PhotoLightbox } from '@/components/damage/DamagePhotos';
import { useDamageEditor, type SaveResult } from '@/components/damage/useDamageEditor';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { damageAriaLabel, damageTypeLabel, numberDamages } from '@/lib/damage-model';
import { errorText } from '@/lib/errors';
import { openPdfInTab } from '@/lib/inspection-pdf';
import { formatPlate } from '@/lib/plate';
import { zurichParts, zurichToIso } from '@/lib/zurich';
import { vehicleOf, type Booking } from './types';

const FUEL_STEPS = ['0', '25', '50', '75', '100'];

export interface InspectionModalProps {
  booking: Booking;
  type: InspectionType;
  onClose: () => void;
  onCreated: (inspection: BookingInspectionDto) => void;
}

export function InspectionModal({ booking, type, onClose, onCreated }: InspectionModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const canInvoice = useCan('contracts', 'edit');
  const isReturn = type === 'RETURN';

  const [damages, setDamages] = useState<VehicleDamageDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [createdHere, setCreatedHere] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ damageId: string; index: number } | null>(null);

  const now = useMemo(() => zurichParts(new Date()), []);
  const [date, setDate] = useState(now?.date ?? '');
  const [time, setTime] = useState(now?.time ?? '');
  const [mileage, setMileage] = useState('');
  const [fuel, setFuel] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'at' | 'mileage' | 'fuel', string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingInspectionDto | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const open = await api.getVehicleDamages(booking.vehicleId, 'OPEN');
      setDamages(open);
      // On a return, damages that were already tied to this booking count as new.
      if (isReturn) setNewIds(new Set(open.filter((d) => d.discoveredBookingId === booking.id).map((d) => d.id)));
    } catch (err) {
      setLoadError(errorText(err, t('damages.errors.loadFailed')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.vehicleId, booking.id, isReturn]);

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
    vehicleId: booking.vehicleId,
    defaultDiscoveredBookingId: isReturn ? booking.id : '',
    onSaved: ({ damage, created, failedPhotos }: SaveResult) => {
      replace(damage);
      setSelectedId(damage.id);
      if (created) {
        setCreatedHere((s) => new Set(s).add(damage.id));
        if (isReturn) setNewIds((s) => new Set(s).add(damage.id));
      }
      toast.success(created ? t('damages.created') : t('damages.updated'), `${damageTypeLabel(damage.type)}, ${damage.zone}`);
      if (failedPhotos.length > 0) toast.error(t('damages.photosFailed', { count: failedPhotos.length }), failedPhotos.join(', '));
    },
    onChanged: replace,
  });
  const { draft } = editor;

  const numbered = useMemo(() => numberDamages((damages ?? []).filter((d) => d.status === 'OPEN')), [damages]);
  const pins = useMemo<DiagramPin[]>(() => {
    const list: DiagramPin[] = numbered
      .filter((d) => d.id !== draft?.id)
      .map((d) => ({
        id: d.id,
        view: d.view,
        x: d.x,
        y: d.y,
        label: d.n ?? undefined,
        tone: 'open',
        severity: d.severity,
        isNew: newIds.has(d.id),
        ariaLabel: damageAriaLabel(d) + (newIds.has(d.id) ? ` (${t('damages.newBadge')})` : ''),
      }));
    if (draft) {
      const editing = draft.id ? numbered.find((d) => d.id === draft.id) : undefined;
      list.push({
        id: 'draft',
        view: draft.view,
        x: draft.x,
        y: draft.y,
        label: editing?.n ?? (draft.id ? undefined : '+'),
        tone: draft.id ? 'open' : 'draft',
        severity: draft.severity,
        isNew: isReturn && (draft.id ? newIds.has(draft.id) : true),
        movable: true,
        ariaLabel: draft.id ? t('damages.pinEditing', { zone: draft.zone }) : t('damages.pinNew', { zone: draft.zone }),
      });
    }
    return list;
  }, [numbered, draft, newIds, isReturn, t]);

  const selected = numbered.find((d) => d.id === selectedId) ?? null;
  const lightboxDamage = lightbox ? (numbered.find((d) => d.id === lightbox.damageId) ?? null) : null;

  const remove = async (damage: VehicleDamageDto) => {
    try {
      await api.deleteDamage(booking.vehicleId, damage.id);
      setDamages((list) => (list ?? []).filter((d) => d.id !== damage.id));
      setNewIds((s) => {
        const next = new Set(s);
        next.delete(damage.id);
        return next;
      });
      setCreatedHere((s) => {
        const next = new Set(s);
        next.delete(damage.id);
        return next;
      });
      if (draft?.id === damage.id) editor.cancel();
      toast.success(t('damages.deleted'));
    } catch (err) {
      toast.error(t('damages.errors.deleteFailed'), errorText(err));
    }
  };

  const submit = async () => {
    const found: typeof errors = {};
    const at = zurichToIso(date, time);
    if (!at) found.at = t('inspection.errors.at');
    let mileageValue: number | null = null;
    if (mileage.trim() !== '') {
      const value = Number(mileage.replace(/['’\s]/g, ''));
      if (!Number.isInteger(value) || value < 0 || value > 5_000_000) found.mileage = t('inspection.errors.mileage');
      else mileageValue = value;
    }
    let fuelValue: number | null = null;
    if (fuel.trim() !== '') {
      const value = Number(fuel);
      if (!Number.isInteger(value) || value < 0 || value > 100) found.fuel = t('inspection.errors.fuel');
      else fuelValue = value;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      const inspection = await api.createInspection(booking.id, {
        type,
        at,
        mileage: mileageValue,
        fuelLevel: fuelValue,
        notes: notes.trim() || undefined,
        newDamageIds: isReturn && newIds.size > 0 ? [...newIds] : undefined,
      });
      toast.success(t('inspection.saved'), vehicleOf(booking));
      onCreated(inspection);
      setDone(inspection);
    } catch (err) {
      setError(errorText(err, t('inspection.errors.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const openReport = (inspection: BookingInspectionDto) => {
    void openPdfInTab(() => api.downloadInspectionReport(inspection.id), `Fahrzeugkontrolle-${inspection.id.slice(0, 8)}.pdf`).catch((err) =>
      toast.error(t('inspection.errors.reportFailed'), errorText(err)),
    );
  };

  const title = isReturn ? t('inspection.titleReturn') : t('inspection.titlePickup');
  const plate = booking.vehicle?.licensePlate ? ` · ${formatPlate(booking.vehicle.licensePlate)}` : '';
  const description = `${vehicleOf(booking)}${plate} · ${booking.customerName}`;

  // ── Done view ────────────────────────────────────────────────
  if (done) {
    const newCount = isReturn ? done.newDamageIds.length : 0;
    return (
      <Modal
        open
        onClose={onClose}
        title={t('inspection.doneTitle')}
        description={description}
        footer={
          <Button variant="outline" onClick={onClose}>
            {t('ui.schliessen')}
          </Button>
        }
      >
        <Alert tone="ok">
          {isReturn ? t('inspection.doneReturn', { count: done.damageIds.length, newCount }) : t('inspection.donePickup', { count: done.damageIds.length })}
        </Alert>
        <div className="flex flex-col gap-2.5">
          {done.hasReport && (
            <Button iconLeft={<FileText size={18} aria-hidden="true" />} onClick={() => openReport(done)}>
              {t('inspection.openReport')}
            </Button>
          )}
          {newCount > 0 && canInvoice && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper p-3.5">
              <b>{t('inspection.damageInvoiceTitle')}</b>
              <p className="sm mut">{t('inspection.damageInvoiceText', { count: newCount })}</p>
              <Button
                variant="outline"
                className="self-start"
                iconLeft={<Receipt size={18} aria-hidden="true" />}
                onClick={() => {
                  onClose();
                  router.push(`/contracts?tab=rechnungen&newInvoice=damage&bookingId=${encodeURIComponent(booking.id)}`);
                }}
              >
                {t('inspection.createDamageInvoice')}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // ── Form view ────────────────────────────────────────────────
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      dismissible={!saving}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={Boolean(draft) || damages === null}>
            {t('inspection.save')}
          </Button>
        </>
      }
    >
      <p className="mut -mt-2">{isReturn ? t('inspection.introReturn') : t('inspection.introPickup')}</p>

      {loadError ? (
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
      ) : damages === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t('damages.loading')}>
          <Skeleton className="h-64 w-full" rounded={16} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
              {t('inspection.damagesHeading', { count: numbered.length })}
            </h3>
            {!draft && (
              <Button size="sm" variant="outline" iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => editor.begin(selected?.view ?? 'left')}>
                {t('damages.add')}
              </Button>
            )}
          </div>

          <CarDiagram
            pins={pins}
            selectedId={draft ? 'draft' : selectedId}
            onSelect={(id) => id !== 'draft' && setSelectedId(id)}
            onPlace={editor.place}
            onMove={(_id, x, y) => editor.move(x, y)}
            followView={draft?.view ?? selected?.view ?? null}
            hint={isReturn ? t('inspection.hintReturn') : t('inspection.hintPickup')}
            aria-label={t('damages.diagramOf', { vehicle: vehicleOf(booking) })}
          />

          {draft && (
            <DamageForm
              editor={editor}
              discoveredNote={isReturn && !draft.id ? t('inspection.markedNew') : undefined}
              submitLabel={draft.id ? undefined : t('inspection.addDamage')}
            />
          )}

          <DamageList
            damages={numbered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            newIds={newIds}
            canEdit
            onEdit={editor.edit}
            onDelete={(d) => void remove(d)}
            canDelete={(d) => createdHere.has(d.id)}
            onOpenPhotos={(d, index) => setLightbox({ damageId: d.id, index })}
            emptyText={t('inspection.noDamages')}
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <Field label={t('inspection.fieldDate')} error={errors.at} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
        </Field>
        <Field label={t('inspection.fieldTime')} required>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={saving} />
        </Field>
        <Field label={t('inspection.fieldMileage')} hint={t('inspection.fieldMileageHint')} error={errors.mileage}>
          <Input type="number" inputMode="numeric" min={0} max={5000000} step={1} value={mileage} onChange={(e) => setMileage(e.target.value)} disabled={saving} className="num" />
        </Field>
        <Field label={t('inspection.fieldFuel')} hint={t('inspection.fieldFuelHint')} error={errors.fuel}>
          <Input type="number" inputMode="numeric" min={0} max={100} step={1} value={fuel} onChange={(e) => setFuel(e.target.value)} disabled={saving} className="num" />
        </Field>
        <div className="col-span-2 -mt-1 max-[520px]:col-span-1">
          <ChipGroup
            aria-label={t('inspection.fuelQuick')}
            options={FUEL_STEPS.map((step) => ({ value: step, label: `${step} %` }))}
            value={FUEL_STEPS.includes(fuel) ? fuel : ''}
            onChange={(value) => setFuel(value)}
          />
        </div>
        <Field label={t('inspection.fieldNotes')} className="col-span-2 max-[520px]:col-span-1">
          <Textarea rows={3} maxLength={4000} showCount={false} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('inspection.notesPlaceholder')} disabled={saving} />
        </Field>
      </div>

      {draft && <Alert tone="warn">{t('inspection.finishDamageFirst')}</Alert>}
      {error && <Alert tone="err">{error}</Alert>}

      <PhotoLightbox
        photos={lightboxDamage?.photos ?? []}
        index={lightbox && lightboxDamage ? lightbox.index : null}
        label={lightboxDamage ? `${damageTypeLabel(lightboxDamage.type)}, ${lightboxDamage.zone}` : ''}
        onIndexChange={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
        onClose={() => setLightbox(null)}
      />
    </Modal>
  );
}
