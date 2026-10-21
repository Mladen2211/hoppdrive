'use client';

/**
 * State and saving of the damage form, shared by the Schäden tab of the fleet drawer and the inspection dialog.
 *
 * One draft at a time: a new damage (a tap on the sketch, or "Schaden hinzufügen") or an existing one being edited.
 * The draft's pin is shown on the diagram as the only movable pin; its position and zone stay in sync
 * (the zone follows the pin until the user types an own zone).
 * save() creates / updates the damage, then uploads the queued photos one by one (progress) and reports the result.
 */
import {
  suggestDamageZone,
  type CarDiagramViewKey,
  type DamageSeverity,
  type DamageType,
  type VehicleDamageDto,
  type VehicleDamagePhotoDto,
} from '@hoppdrive/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { clamp01 } from '@/lib/damage-model';
import { errorText } from '@/lib/errors';
import { tr } from '@/i18n/active';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_DAMAGE = 20;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface QueuedPhoto {
  id: string;
  file: File;
  url: string;
}

export interface DamageDraft {
  /** null = a new damage */
  id: string | null;
  view: CarDiagramViewKey;
  x: number;
  y: number;
  zone: string;
  /** true once the user typed an own zone: the pin no longer rewrites it */
  zoneTouched: boolean;
  type: DamageType;
  severity: DamageSeverity;
  description: string;
  /** booking id or '' */
  discoveredBookingId: string;
  photos: VehicleDamagePhotoDto[];
  files: QueuedPhoto[];
}

export type DraftErrors = Partial<Record<'zone' | 'description' | 'discoveredBookingId', string>>;

export interface SaveResult {
  damage: VehicleDamageDto;
  created: boolean;
  failedPhotos: string[];
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function blankDraft(view: CarDiagramViewKey, x: number, y: number, discoveredBookingId: string): DamageDraft {
  return {
    id: null,
    view,
    x,
    y,
    zone: suggestDamageZone(view, x, y),
    zoneTouched: false,
    type: 'KRATZER',
    severity: 'minor',
    description: '',
    discoveredBookingId,
    photos: [],
    files: [],
  };
}

function draftFrom(damage: VehicleDamageDto): DamageDraft {
  return {
    id: damage.id,
    view: damage.view,
    x: damage.x,
    y: damage.y,
    zone: damage.zone,
    zoneTouched: damage.zone !== suggestDamageZone(damage.view, damage.x, damage.y),
    type: damage.type,
    severity: damage.severity,
    description: damage.description,
    discoveredBookingId: damage.discoveredBookingId ?? '',
    photos: damage.photos,
    files: [],
  };
}

function moved(draft: DamageDraft, view: CarDiagramViewKey, x: number, y: number): DamageDraft {
  const nx = clamp01(x);
  const ny = clamp01(y);
  return { ...draft, view, x: nx, y: ny, zone: draft.zoneTouched ? draft.zone : suggestDamageZone(view, nx, ny) };
}

export interface UseDamageEditorOptions {
  vehicleId: string;
  /** Pre-selected "found during" booking for new damages (the inspection dialog sets it for a return). */
  defaultDiscoveredBookingId?: string;
  /** A damage was created or updated (and its queued photos uploaded). */
  onSaved: (result: SaveResult) => void;
  /** A damage changed outside of save() (a photo was deleted). */
  onChanged?: (damage: VehicleDamageDto) => void;
}

export function useDamageEditor({ vehicleId, defaultDiscoveredBookingId = '', onSaved, onChanged }: UseDamageEditorOptions) {
  const [draft, setDraft] = useState<DamageDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [fileNote, setFileNote] = useState<string | null>(null);
  const draftRef = useRef<DamageDraft | null>(null);
  draftRef.current = draft;
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  const revoke = (files: QueuedPhoto[]) => files.forEach((f) => URL.revokeObjectURL(f.url));
  useEffect(
    () => () => {
      if (draftRef.current) revoke(draftRef.current.files);
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setErrors({});
    setFileNote(null);
    setProgress(null);
  }, []);

  /** Opens an empty draft (centre of the left view unless a position is given). */
  const begin = useCallback(
    (view: CarDiagramViewKey = 'left', x = 0.5, y = 0.5) => {
      if (draftRef.current) revoke(draftRef.current.files);
      reset();
      setDraft(blankDraft(view, x, y, defaultDiscoveredBookingId));
    },
    [defaultDiscoveredBookingId, reset],
  );

  /** A tap on the sketch: moves the open draft there, or starts a new one. */
  const place = useCallback(
    (view: CarDiagramViewKey, x: number, y: number) => {
      const current = draftRef.current;
      if (current) setDraft(moved(current, view, x, y));
      else {
        reset();
        setDraft(blankDraft(view, clamp01(x), clamp01(y), defaultDiscoveredBookingId));
      }
    },
    [defaultDiscoveredBookingId, reset],
  );

  const edit = useCallback(
    (damage: VehicleDamageDto) => {
      if (draftRef.current) revoke(draftRef.current.files);
      reset();
      setDraft(draftFrom(damage));
    },
    [reset],
  );

  const cancel = useCallback(() => {
    if (draftRef.current) revoke(draftRef.current.files);
    reset();
    setDraft(null);
  }, [reset]);

  const move = useCallback((x: number, y: number) => {
    setDraft((d) => (d ? moved(d, d.view, x, y) : d));
  }, []);

  /** The "view" select: keeps the fractions, moves the pin to the other drawing. */
  const setView = useCallback((view: CarDiagramViewKey) => {
    setDraft((d) => (d ? moved(d, view, d.x, d.y) : d));
  }, []);

  /** The "position" select: places the pin on a body area. */
  const pickArea = useCallback((zone: string, x: number, y: number) => {
    setDraft((d) => (d ? { ...moved(d, d.view, x, y), zone: d.zoneTouched ? d.zone : zone } : d));
  }, []);

  const patch = useCallback((changes: Partial<Pick<DamageDraft, 'type' | 'severity' | 'description' | 'discoveredBookingId'>>) => {
    setDraft((d) => (d ? { ...d, ...changes } : d));
  }, []);

  const setZone = useCallback((zone: string) => {
    setErrors((e) => ({ ...e, zone: undefined }));
    setDraft((d) =>
      d
        ? zone.trim() === ''
          ? { ...d, zone: suggestDamageZone(d.view, d.x, d.y), zoneTouched: false }
          : { ...d, zone, zoneTouched: true }
        : d,
    );
  }, []);

  const addFiles = useCallback((list: FileList | File[] | null) => {
    const current = draftRef.current;
    const incoming = list ? Array.from(list) : [];
    if (!current || incoming.length === 0) return;
    const rejected: string[] = [];
    const accepted: QueuedPhoto[] = [];
    let room = MAX_PHOTOS_PER_DAMAGE - current.photos.length - current.files.length;
    for (const file of incoming) {
      if (!PHOTO_TYPES.includes(file.type)) rejected.push(tr('damages.fileNotImage', { name: file.name }));
      else if (file.size > MAX_PHOTO_BYTES) rejected.push(tr('damages.fileTooBig', { name: file.name }));
      else if (room <= 0) rejected.push(tr('damages.fileTooMany', { name: file.name, max: MAX_PHOTOS_PER_DAMAGE }));
      else {
        accepted.push({ id: newId(), file, url: URL.createObjectURL(file) });
        room -= 1;
      }
    }
    setFileNote(rejected.length ? rejected.join(' ') : null);
    if (accepted.length) setDraft((d) => (d ? { ...d, files: [...d.files, ...accepted] } : d));
  }, []);

  const removeFile = useCallback((id: string) => {
    const hit = draftRef.current?.files.find((f) => f.id === id);
    if (hit) URL.revokeObjectURL(hit.url);
    setDraft((d) => (d ? { ...d, files: d.files.filter((f) => f.id !== id) } : d));
  }, []);

  /** Deletes an already stored photo of the damage being edited (the caller confirms first). */
  const deleteStoredPhoto = useCallback(
    async (photoId: string) => {
      const current = draftRef.current;
      if (!current?.id) return;
      const updated = await api.deleteDamagePhoto(current.id, photoId);
      setDraft((d) => (d && d.id === updated.id ? { ...d, photos: updated.photos } : d));
      changedRef.current?.(updated);
    },
    [],
  );

  const save = useCallback(async () => {
    const current = draftRef.current;
    if (!current || saving) return;
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const body = {
        view: current.view,
        x: Number(current.x.toFixed(4)),
        y: Number(current.y.toFixed(4)),
        type: current.type,
        severity: current.severity,
        description: current.description.trim(),
        discoveredBookingId: current.discoveredBookingId || null,
      };
      let damage = current.id
        ? await api.updateDamage(vehicleId, current.id, { ...body, zone: current.zone.trim() })
        : await api.createDamage(vehicleId, { ...body, zone: current.zone.trim() || undefined });

      const failedPhotos: string[] = [];
      for (let i = 0; i < current.files.length; i += 1) {
        setProgress({ done: i, total: current.files.length });
        try {
          damage = await api.uploadDamagePhotos(damage.id, [current.files[i].file]);
        } catch {
          failedPhotos.push(current.files[i].file.name);
        }
      }
      revoke(current.files);
      setProgress(null);
      setDraft(null);
      savedRef.current({ damage, created: !current.id, failedPhotos });
    } catch (err) {
      setProgress(null);
      if (err instanceof ApiError && err.status === 422 && err.details) {
        const next: DraftErrors = {};
        if (err.details.discoveredBookingId) next.discoveredBookingId = tr('damages.errors.wrongBooking');
        if (err.details.zone) next.zone = err.details.zone[0];
        if (err.details.description) next.description = err.details.description[0];
        setErrors(next);
      }
      setError(errorText(err, tr('damages.errors.saveFailed')));
    } finally {
      setSaving(false);
    }
  }, [saving, vehicleId]);

  return {
    draft,
    saving,
    progress,
    error,
    errors,
    fileNote,
    begin,
    place,
    edit,
    cancel,
    move,
    setView,
    pickArea,
    patch,
    setZone,
    addFiles,
    removeFile,
    deleteStoredPhoto,
    save,
  };
}

export type DamageEditor = ReturnType<typeof useDamageEditor>;
