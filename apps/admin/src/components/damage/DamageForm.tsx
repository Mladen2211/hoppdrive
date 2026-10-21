'use client';

/**
 * The damage form: Ansicht, Stelle (area preset that places the pin), Bereich (zone text, follows the pin),
 * Art, Schwere, Beschreibung, optionally "Entdeckt bei Buchung", and photos (previews, upload progress).
 * Pure view of a useDamageEditor() state. Dragging / tapping on the diagram moves the same pin, and the
 * "Stelle" select is the keyboard / screen-reader way to put it somewhere.
 */
import { DAMAGE_VIEWS, type CarDiagramViewKey, type DamageSeverity, type DamageType } from '@hoppdrive/shared';
import { Camera, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { Alert, Button, ChipGroup, Field, Input, Select, Textarea, useConfirm, useToast } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import { fmtZurichDate } from '@/lib/zurich';
import {
  DAMAGE_TYPES,
  SEVERITIES,
  damageSeverityLabel,
  damageTypeLabel,
  damageViewLabel,
  zonePresets,
  type DamageBookingOption,
} from '@/lib/damage-model';
import { errorText } from '@/lib/errors';
import { PhotoLightbox, StoredPhoto } from './DamagePhotos';
import { MAX_PHOTOS_PER_DAMAGE, type DamageEditor } from './useDamageEditor';

const ACCEPT = 'image/jpeg,image/png,image/webp';

export interface DamageFormProps {
  editor: DamageEditor;
  /** Bookings of the vehicle for "Entdeckt bei Buchung"; omit to hide the field. */
  bookings?: DamageBookingOption[] | null;
  /** Shown instead of the booking select (e.g. "Wird als neu bei dieser Rückgabe markiert"). */
  discoveredNote?: string;
  /** Booking-less hint for the vehicle bookings select. */
  submitLabel?: string;
  className?: string;
}

function bookingLabel(b: DamageBookingOption): string {
  const period = `${fmtZurichDate(b.startDate)} – ${fmtZurichDate(b.endDate)}`;
  return b.customerName ? `${b.customerName} · ${period}` : period;
}

export function DamageForm({ editor, bookings, discoveredNote, submitLabel, className }: DamageFormProps) {
  const t = useTranslations();
  const confirm = useConfirm();
  const { toast } = useToast();
  const titleId = useId();
  const { draft, saving, progress, error, errors, fileNote } = editor;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const presets = useMemo(() => (draft ? zonePresets(draft.view) : []), [draft]);

  if (!draft) return null;

  const presetIndex = presets.findIndex((p) => Math.abs(p.x - draft.x) < 0.002 && Math.abs(p.y - draft.y) < 0.002);
  const editing = draft.id !== null;
  const sortedBookings = bookings ? [...bookings].sort((a, b) => b.startDate.localeCompare(a.startDate)) : null;
  const photoCount = draft.photos.length + draft.files.length;

  function submit(event: FormEvent) {
    event.preventDefault();
    void editor.save();
  }

  async function removeStored(photoId: string) {
    const done = await confirm({
      title: t('damages.deletePhotoTitle'),
      description: t('damages.deletePhotoText'),
      confirmLabel: t('damages.deletePhoto'),
      onConfirm: async () => {
        try {
          await editor.deleteStoredPhoto(photoId);
        } catch (err) {
          throw new Error(errorText(err, t('damages.errors.photoDeleteFailed')));
        }
      },
    });
    if (done) toast.success(t('damages.photoDeleted'));
  }

  const removeButton = 'absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink shadow-tab hover:bg-err-tint hover:text-err max-md:h-11 max-md:w-11';

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={titleId}
      className={cn('flex flex-col gap-3.5 rounded-2xl border-[1.5px] border-ink bg-card p-4 max-md:p-3.5', className)}
    >
      <div>
        <h3 id={titleId} className="h3">
          {editing ? t('damages.editTitle') : t('damages.newTitle')}
        </h3>
        <p className="hint mt-1">{t('damages.formHint')}</p>
      </div>

      {error && <Alert tone="err">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 max-[460px]:grid-cols-1">
        <Field label={t('damages.fieldView')}>
          <Select value={draft.view} onChange={(e) => editor.setView(e.target.value as CarDiagramViewKey)} disabled={saving}>
            {DAMAGE_VIEWS.map((view) => (
              <option key={view} value={view}>
                {damageViewLabel(view)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('damages.fieldPosition')} hint={t('damages.fieldPositionHint')}>
          <Select
            value={presetIndex >= 0 ? String(presetIndex) : ''}
            onChange={(e) => {
              const preset = presets[Number(e.target.value)];
              if (preset) editor.pickArea(preset.zone, preset.x, preset.y);
            }}
            disabled={saving}
          >
            {presetIndex < 0 && <option value="">{t('damages.positionOnSketch')}</option>}
            {presets.map((preset, index) => (
              <option key={`${preset.zone}-${index}`} value={String(index)}>
                {preset.zone}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('damages.fieldZone')} error={errors.zone} className="col-span-2 max-[460px]:col-span-1">
          <Input value={draft.zone} onChange={(e) => editor.setZone(e.target.value)} maxLength={120} disabled={saving} autoComplete="off" />
        </Field>
        <Field label={t('damages.fieldType')}>
          <Select value={draft.type} onChange={(e) => editor.patch({ type: e.target.value as DamageType })} disabled={saving}>
            {DAMAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {damageTypeLabel(type)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="lbl" aria-hidden="true">
            {t('damages.fieldSeverity')}
          </span>
          <ChipGroup<DamageSeverity>
            aria-label={t('damages.fieldSeverity')}
            options={SEVERITIES.map((severity) => ({ value: severity, label: damageSeverityLabel(severity) }))}
            value={draft.severity}
            onChange={(severity) => editor.patch({ severity })}
          />
        </div>
        <Field label={t('damages.fieldDescription')} error={errors.description} className="col-span-2 max-[460px]:col-span-1">
          <Textarea
            rows={3}
            maxLength={2000}
            showCount={false}
            value={draft.description}
            onChange={(e) => editor.patch({ description: e.target.value })}
            placeholder={t('damages.descriptionPlaceholder')}
            disabled={saving}
          />
        </Field>
        {sortedBookings && (
          <Field label={t('damages.fieldDiscovered')} hint={t('damages.fieldDiscoveredHint')} error={errors.discoveredBookingId} className="col-span-2 max-[460px]:col-span-1">
            <Select value={draft.discoveredBookingId} onChange={(e) => editor.patch({ discoveredBookingId: e.target.value })} disabled={saving}>
              <option value="">{t('damages.discoveredNone')}</option>
              {sortedBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {bookingLabel(b)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {discoveredNote && !sortedBookings && <p className="sm col-span-2 rounded-xl bg-info-tint px-3 py-2 text-info-ink max-[460px]:col-span-1">{discoveredNote}</p>}
      </div>

      <div>
        <div className="lbl mb-1.5">
          {t('damages.photos')}
          <span className="mut font-normal"> ({photoCount}/{MAX_PHOTOS_PER_DAMAGE})</span>
        </div>
        <div className="flex flex-wrap items-stretch gap-2.5">
          {draft.photos.map((photo, index) => (
            <div key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setLightbox(index)}
                aria-label={t('damages.openPhoto', { n: index + 1, total: draft.photos.length, label: draft.zone })}
                className="block h-16 w-24 overflow-hidden rounded-10 border border-line bg-tile"
              >
                <StoredPhoto photo={photo} alt="" className="h-full w-full object-cover" />
              </button>
              <button type="button" disabled={saving} onClick={() => void removeStored(photo.id)} aria-label={t('damages.deletePhoto')} className={removeButton}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          {draft.files.map((item) => (
            <div key={item.id} className="relative">
              <span className="block h-16 w-24 overflow-hidden rounded-10 bg-tile ring-2 ring-info/40">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
              </span>
              <span className="absolute bottom-1 left-1 rounded bg-info px-1.5 text-[11px] font-semibold text-on-fill">{t('common.neu')}</span>
              <button type="button" disabled={saving} onClick={() => editor.removeFile(item.id)} aria-label={t('damages.removeQueued', { name: item.file.name })} className={removeButton}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          {photoCount < MAX_PHOTOS_PER_DAMAGE && (
            <label className="flex min-h-16 min-w-[150px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cool px-3 text-center font-semibold text-graphite focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-focus hover:bg-paper max-md:min-h-[64px]">
              <Camera size={20} aria-hidden="true" />
              {t('damages.addPhotos')}
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                disabled={saving}
                onChange={(e) => {
                  editor.addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
        {fileNote && (
          <p className="errm mt-1.5" role="status">
            {fileNote}
          </p>
        )}
        <p className="hint mt-1.5">{t('damages.photosHint')}</p>
      </div>

      {progress && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={t('damages.uploading', { n: progress.done + 1, total: progress.total })}
            className="h-2 overflow-hidden rounded-full bg-line-soft"
          >
            <div className="h-full rounded-full bg-ruby transition-[width] duration-300" style={{ width: `${Math.max(6, (progress.done / progress.total) * 100)}%` }} />
          </div>
          <p className="sm mut">{t('damages.uploading', { n: progress.done + 1, total: progress.total })}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" loading={saving} className="flex-1">
          {submitLabel ?? (editing ? t('damages.saveChanges') : t('damages.saveDamage'))}
        </Button>
        <Button variant="ghost" onClick={editor.cancel} disabled={saving}>
          {t('common.abbrechen')}
        </Button>
      </div>

      <PhotoLightbox
        photos={draft.photos}
        index={lightbox}
        label={draft.zone}
        onIndexChange={setLightbox}
        onClose={() => setLightbox(null)}
        onDelete={editing ? (photo) => removeStored(photo.id) : undefined}
      />
    </form>
  );
}
