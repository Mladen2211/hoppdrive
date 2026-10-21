'use client';

/**
 * Edit / create drawer of the Flotte (docs/design Fleet-Desktop). Persistent column on desktop,
 * overlay on tablet, bottom sheet on mobile (the Drawer primitive switches by CSS).
 *
 * Fields: Marke*, Modell* (the API keeps them separate), Kategorie, Antrieb, Sitzplätze, Getriebe,
 * Jahr*, PS*, Reichweite (Elektro / Hybrid), Preis pro Tag (Basis) with the tier preview,
 * Bilder (delete existing, upload new ones after saving), Beschreibung, "Auf der Website anzeigen",
 * Wartung. Errors show as field messages, a summary and toasts (the old form logged them to the console).
 */
import { ImagePlus, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { AppLocale, PricingTierDto, TranslatableLocale } from '@hoppdrive/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Drawer, Field, Input, Select, Switch, TabPanel, Tabs, Textarea, useConfirm, useToast } from '@/components/ui';
import { LanguageNote, LanguageTabs } from '@/components/content/LanguageTabs';
import { TranslatedField } from '@/components/content/TranslatedField';
import { VehicleDamagesPanel } from '@/components/damage/VehicleDamagesPanel';
import { useCurrency } from '@/hooks/useCurrency';
import { usePermission } from '@/hooks/usePermission';
import type { DamageBookingOption } from '@/lib/damage-model';
import { ApiError, api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { formatPlate, normalizePlate } from '@/lib/plate';
import { TRANSLATABLE_LOCALES, stateOf, type TranslationState } from '@/lib/translations';
import {
  FUEL_TYPES,
  FUEL_TYPE_LABELS,
  MIN_YEAR,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  buildTierPreview,
  emptyForm,
  errorsFromApi,
  hasRange,
  isDirty,
  maxYear,
  toForm,
  toPayload,
  validateForm,
  vehicleName,
  type FleetImage,
  type FleetMaintenance,
  type FleetVehicle,
  type FormErrors,
  type FormField,
  type VehicleForm,
} from '@/lib/fleet-model';
import { MaintenanceSection } from './MaintenanceSection';
import { VehicleImageGrid } from './VehicleImageGrid';
import { VehicleThumb } from './VehicleThumb';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const FORM_ID = 'vehicle-form';

interface QueuedFile {
  id: string;
  file: File;
  url: string;
}

export interface VehicleDrawerProps {
  /** null = create a new vehicle */
  vehicle: FleetVehicle | null;
  readOnly: boolean;
  tiers: PricingTierDto[];
  maintenance: FleetMaintenance[];
  /** Bookings of this vehicle (the damage form offers them as "found during rental"). */
  bookings?: DamageBookingOption[];
  /** The Schäden tab loaded or changed the number of open damages. */
  onOpenDamagesChange?: (vehicleId: string, count: number) => void;
  /** Opens the maintenance form straight away. */
  openMaintenance?: boolean;
  onClose: () => void;
  /** After create / update (and the image uploads): the page reloads and selects the vehicle. */
  onSaved: (saved: FleetVehicle, created: boolean) => Promise<void> | void;
  onDelete: (vehicle: FleetVehicle) => void;
  onImageDeleted: (vehicleId: string, imageId: string) => void;
  /** New image list after "Hauptbild" or a reorder (optimistic first, then the server's answer). */
  onImagesChanged: (vehicleId: string, images: FleetImage[]) => void;
  onMaintenanceCreated: (entry: FleetMaintenance) => void;
  onMaintenanceDeleted: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function VehicleDrawer({
  vehicle,
  readOnly,
  tiers,
  maintenance,
  bookings = [],
  onOpenDamagesChange,
  openMaintenance = false,
  onClose,
  onSaved,
  onDelete,
  onImageDeleted,
  onImagesChanged,
  onMaintenanceCreated,
  onMaintenanceDeleted,
  onDirtyChange,
}: VehicleDrawerProps) {
  const tt = useTranslations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const settingsCurrency = useCurrency();
  const currency = vehicle?.currency ?? settingsCurrency;
  const [lang, setLang] = useState<AppLocale>('de');
  const creating = vehicle === null;
  const damagesLevel = usePermission('damages');
  const showDamages = !creating && damagesLevel !== 'none';
  const searchTab = useSearchParams()?.get('tab');
  const [tab, setTab] = useState<'details' | 'damages'>(searchTab === 'damages' && !creating ? 'damages' : 'details');
  const [openDamages, setOpenDamages] = useState<number | null>(null);
  const vehicleId = vehicle?.id;
  const handleOpenDamages = useCallback(
    (count: number) => {
      setOpenDamages(count);
      if (vehicleId) onOpenDamagesChange?.(vehicleId, count);
    },
    [vehicleId, onOpenDamagesChange],
  );
  // A link to /fleet?id=<id>&tab=damages (list badge, inspection dialog) switches an already open drawer too.
  useEffect(() => {
    if (searchTab === 'damages' && showDamages) setTab('damages');
  }, [searchTab, showDamages]);
  const activeTab = showDamages ? tab : 'details';
  const baseline = useMemo(() => (vehicle ? toForm(vehicle) : emptyForm()), [vehicle]);
  const [form, setForm] = useState<VehicleForm>(baseline);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState<QueuedFile[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const queuedRef = useRef<QueuedFile[]>([]);
  queuedRef.current = queued;

  // The visibility switch in the table changes the vehicle while the drawer is open: follow it.
  const savedVisible = vehicle?.isAvailable;
  useEffect(() => {
    if (savedVisible === undefined) return;
    setForm((f) => (f.isAvailable === savedVisible ? f : { ...f, isAvailable: savedVisible }));
  }, [savedVisible]);

  const dirty = !readOnly && (isDirty(form, baseline) || queued.length > 0);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // Release the preview URLs when the drawer goes away.
  useEffect(
    () => () => {
      queuedRef.current.forEach((q) => URL.revokeObjectURL(q.url));
    },
    [],
  );

  const set = useCallback(<K extends FormField>(key: K, value: VehicleForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const basePrice = form.price.trim() !== '' && !Number.isNaN(Number(form.price)) && Number(form.price) > 0 ? Number(form.price) : null;
  const tierBoxes = useMemo(() => buildTierPreview(basePrice, tiers), [basePrice, tiers]);

  function discard() {
    setForm(baseline);
    setErrors({});
    setFormError(null);
    setUploadNote(null);
    queued.forEach((q) => URL.revokeObjectURL(q.url));
    setQueued([]);
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const accepted: QueuedFile[] = [];
    const rejected: string[] = [];
    Array.from(list).forEach((file) => {
      if (!file.type.startsWith('image/')) rejected.push(tt('fleet.keinBild', { name: file.name }));
      else if (file.size > MAX_FILE_BYTES) rejected.push(tt('fleet.groesserAls8MB', { name: file.name }));
      else accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`, file, url: URL.createObjectURL(file) });
    });
    setQueued((q) => [...q, ...accepted]);
    setUploadNote(rejected.length ? tt('fleet.nichtHinzugefuegt', { join: rejected.join(', ') }) : null);
  }

  function removeQueued(id: string) {
    setQueued((q) => {
      const hit = q.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return q.filter((x) => x.id !== id);
    });
  }

  async function deleteImage(imageId: string) {
    if (!vehicle) return;
    const done = await confirm({
      title: tr('fleet.bildLoeschen'),
      description: tr('fleet.dasBildWirdSofort'),
      confirmLabel: tr('fleet.bildLoeschen2'),
      icon: <Trash2 size={20} />,
      onConfirm: async () => {
        try {
          await api.deleteVehicleImage(vehicle.id, imageId);
        } catch (err) {
          throw new Error(errorText(err, tr('fleet.dasBildKonnteNicht')));
        }
        onImageDeleted(vehicle.id, imageId);
      },
    });
    if (done) toast.success(tr('fleet.bildGeloescht'), vehicleName(vehicle));
  }

  function focusFirstInvalid() {
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly || saving) return;
    setFormError(null);
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = (vehicle ? await api.updateVehicle(vehicle.id, payload) : await api.createVehicle(payload)) as FleetVehicle;

      // Images go up one after the other; the vehicle is saved either way.
      const failed: string[] = [];
      let uploaded = 0;
      for (const item of queued) {
        try {
          await api.uploadVehicleImage(saved.id, item.file);
          uploaded += 1;
        } catch {
          failed.push(item.file.name);
        }
      }
      queued.forEach((q) => URL.revokeObjectURL(q.url));
      setQueued([]);
      setUploadNote(null);
      setForm(toForm(saved));

      toast.success(
        creating ? tr('fleet.fahrzeugErstellt') : tr('fleet.fahrzeugGespeichert'),
        `${vehicleName(saved)}${uploaded ? tr('fleet.hochgeladen', { uploaded }) : ''}`,
      );
      if (failed.length > 0) {
        toast.error(tr('fleet.einBildKonnteNichtN', { count: failed.length }), tr('fleet.dasFahrzeugWurdeGespeichert', { join: failed.join(', ') }));
      }
      await onSaved(saved, creating);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'license_plate_taken') {
        setErrors({ licensePlate: tt('fleet.plateTaken') });
        setFormError(tt('fleet.plateTakenSummary'));
        focusFirstInvalid();
      } else if (err instanceof ApiError && err.status === 422) {
        const mapped = errorsFromApi(err.details);
        setErrors(mapped);
        setFormError(tr('fleet.derServerHatAngaben'));
        if (Object.keys(mapped).length > 0) focusFirstInvalid();
      } else {
        const text = errorText(err, tr('fleet.dasFahrzeugKonnteNicht2'));
        setFormError(text);
        toast.error(tr('fleet.fahrzeugKonnteNichtGespeichert'), text);
      }
    } finally {
      setSaving(false);
    }
  }

  const descriptionStates: Partial<Record<AppLocale, TranslationState>> = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    descriptionStates[locale] = stateOf([{ base: form.description, value: form.translations[locale] }]);
  }

  const errorCount = Object.values(errors).filter(Boolean).length;
  const title = creating ? tt('fleet.fahrzeugHinzufuegen') : readOnly ? vehicleName(vehicle) : tt('fleet.editVehicle', { name: vehicleName(vehicle) });
  const subtitle = readOnly
    ? tt('fleet.nurAnsichtFuerDiesen')
    : creating
      ? tt('fleet.dasFahrzeugErscheintNach')
      : tt('fleet.aenderungenErscheinenNachDem');
  const images = vehicle?.images ?? [];
  const disabled = readOnly || saving;

  const footer = readOnly ? undefined : (
    <>
      <Button type="submit" form={FORM_ID} loading={saving} className="flex-1">
        {creating ? tt('fleet.fahrzeugErstellen') : tt('fleet.aenderungenSpeichern')}
      </Button>
      {creating ? (
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {tt('common.abbrechen')}
        </Button>
      ) : (
        <>
          <Button variant="ghost" onClick={discard} disabled={saving || !dirty}>
            {tt('common.verwerfen')}
          </Button>
          <Button
            variant="ghost"
            className="!border-edge-err !text-err hover:!bg-err-tint"
            iconLeft={<Trash2 size={18} aria-hidden="true" />}
            disabled={saving}
            onClick={() => vehicle && onDelete(vehicle)}
          >
            {tt('common.loeschen')}
          </Button>
        </>
      )}
    </>
  );

  return (
    <Drawer open onClose={onClose} title={title} subtitle={subtitle} footer={activeTab === 'details' ? footer : undefined}>
      {showDamages && (
        <Tabs
          aria-label={tt('damages.tabsLabel')}
          idPrefix="veh"
          withPanels
          value={activeTab}
          onChange={(id) => setTab(id as 'details' | 'damages')}
          className="w-full [&>.tab]:flex-1 [&>.tab]:justify-center"
          tabs={[
            { id: 'details', label: tt('damages.tabDetails') },
            { id: 'damages', label: tt('damages.tabDamages'), count: openDamages ?? undefined },
          ]}
        />
      )}
      <TabPanel idPrefix="veh" id="details" active={activeTab === 'details'}>
      <div className="flex flex-col gap-[18px]">
      <form id={FORM_ID} ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
        {(errorCount > 0 || formError) && (
          <Alert tone="err" title={errorCount > 0 ? `${errorCount} ${tt('fleet.angabeFehltOderIstN', { count: errorCount })}.` : tt('fleet.speichernNichtMoeglich')}>
            {errorCount > 0 ? (formError ?? tt('fleet.bitteKorrigierenSieDie')) : formError}
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 max-[420px]:grid-cols-1">
          <Field label={tt('fleet.marke')} required={!readOnly} error={errors.brand}>
            <Input data-autofocus value={form.brand} onChange={(e) => set('brand', e.target.value)} disabled={disabled} autoComplete="off" />
          </Field>
          <Field label={tt('fleet.modell')} required={!readOnly} error={errors.model}>
            <Input value={form.model} onChange={(e) => set('model', e.target.value)} disabled={disabled} autoComplete="off" />
          </Field>
          <Field
            label={tt('fleet.plateLabel')}
            hint={tt('fleet.plateHint')}
            error={errors.licensePlate}
            className="col-span-2 max-[420px]:col-span-1"
          >
            <Input
              value={form.licensePlate}
              onChange={(e) => set('licensePlate', e.target.value.toUpperCase())}
              onBlur={() => {
                const normalised = normalizePlate(form.licensePlate);
                if (normalised) set('licensePlate', formatPlate(normalised));
              }}
              disabled={disabled}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={24}
              placeholder="ZH 123 456"
              className="num uppercase"
            />
          </Field>
          <Field label={tt('fleet.kategorie')} error={errors.type}>
            <Select value={form.type} onChange={(e) => set('type', e.target.value)} disabled={disabled}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {VEHICLE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tt('fleet.antrieb')} error={errors.fuelType}>
            <Select value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)} disabled={disabled}>
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FUEL_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tt('fleet.sitzplaetze')} required={!readOnly} error={errors.seats}>
            <Input type="number" inputMode="numeric" min={1} max={12} step={1} value={form.seats} onChange={(e) => set('seats', e.target.value)} disabled={disabled} />
          </Field>
          <Field label={tt('fleet.getriebe')} error={errors.transmission}>
            <Select value={form.transmission} onChange={(e) => set('transmission', e.target.value)} disabled={disabled}>
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t}>
                  {TRANSMISSION_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tt('fleet.jahr')} required={!readOnly} error={errors.year}>
            <Input type="number" inputMode="numeric" min={MIN_YEAR} max={maxYear()} step={1} value={form.year} onChange={(e) => set('year', e.target.value)} disabled={disabled} />
          </Field>
          <Field label={tt('fleet.pS')} required={!readOnly} error={errors.horsepower}>
            <Input type="number" inputMode="numeric" min={0} step={1} value={form.horsepower} onChange={(e) => set('horsepower', e.target.value)} disabled={disabled} />
          </Field>
          {hasRange(form.fuelType) && (
            <Field label={tt('fleet.reichweite')} hint={tt('fleet.nurBeiElektroUnd')} error={errors.range} className="col-span-2 max-[420px]:col-span-1">
              <Input value={form.range} onChange={(e) => set('range', e.target.value)} placeholder={tt('fleet.n540Km')} disabled={disabled} autoComplete="off" />
            </Field>
          )}
        </div>

        <div>
          <Field label={tt('fleet.preisProTagBasis')} required={!readOnly} error={errors.price}>
            <div className="relative">
              <span className="mut pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true">
                {currency}
              </span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                disabled={disabled}
                placeholder="79.00"
                className="num pl-[52px] text-[17px]"
              />
            </div>
          </Field>
          <ul className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2" aria-label={tt('fleet.preisstaffelProTag')}>
            {tierBoxes.map((box) => (
              <li key={box.key} className="rounded-10 bg-paper px-2.5 py-2">
                <div className="sm mut">{box.label}</div>
                <b className="num">{box.price}</b>
                {box.discount && <span className="sm mut"> {box.discount}</span>}
              </li>
            ))}
          </ul>
          <p className="hint mt-1.5">{tt('fleet.dieStaffelWirdAutomatisch')}</p>
        </div>

        <div>
          <div className="lbl mb-1.5">{tt('fleet.bilder')}</div>
          {vehicle && images.length > 0 && (
            <div className="mb-2.5">
              <VehicleImageGrid
                vehicleId={vehicle.id}
                images={images}
                readOnly={readOnly}
                disabled={saving}
                onChange={(next) => onImagesChanged(vehicle.id, next)}
                onDelete={(imageId) => void deleteImage(imageId)}
              />
            </div>
          )}
          <div className="flex flex-wrap items-stretch gap-2.5">
            {queued.map((item) => (
              <div key={item.id} className="relative">
                <VehicleThumb image={{ url: item.url }} alt={item.file.name} className="h-16 w-24 ring-2 ring-info/40" />
                <span className="absolute bottom-1 left-1 rounded bg-info px-1.5 text-[11px] font-semibold text-on-fill">{tt('common.neu')}</span>
                <button
                  type="button"
                  onClick={() => removeQueued(item.id)}
                  disabled={saving}
                  aria-label={tt('fleet.ausDerAuswahlEntfernen', { name: item.file.name })}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink shadow-tab hover:bg-err-tint hover:text-err max-md:h-11 max-md:w-11"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            {!readOnly && (
              <label className="flex min-h-16 min-w-[160px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cool px-3 font-semibold text-graphite hover:bg-paper focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-focus max-md:min-h-[64px]">
                <ImagePlus size={20} aria-hidden="true" />
                {tt('fleet.fotoHochladen')}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={saving}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          {uploadNote && (
            <p className="errm mt-1.5" role="status">
              {uploadNote}
            </p>
          )}
          {!readOnly && (
            <p className="hint mt-1.5">
              {queued.length > 0
                ? tt('fleet.beimSpeichernHochgeladen', { length: queued.length })
                : images.length > 0
                  ? tt('fleet.imagesHint')
                  : tt('fleet.mehrereBilderMoeglichBis')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <LanguageTabs value={lang} onChange={setLang} states={descriptionStates} idPrefix="veh-lang" />
          <LanguageNote locale={lang} />
          {lang === 'de' ? (
            <Field label={tt('common.beschreibung')} error={errors.description}>
              <Textarea rows={3} maxLength={5000} showCount={false} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={disabled} />
            </Field>
          ) : (
            <TranslatedField
              locale={lang}
              label={tt('common.beschreibung')}
              base={form.description}
              value={form.translations[lang as TranslatableLocale]}
              multiline
              maxLength={5000}
              disabled={disabled}
              onChange={(v) => setForm((f) => ({ ...f, translations: { ...f.translations, [lang as TranslatableLocale]: v } }))}
            />
          )}
        </div>

        <Switch
          checked={form.isAvailable}
          onChange={(v) => set('isAvailable', v)}
          disabled={disabled}
          label={tt('fleet.aufDerWebsiteAnzeigen2')}
          description={form.isAvailable ? tt('fleet.verfuegbarFuerAnfragen') : tt('fleet.aufDerWebsiteAusgeblendet')}
          labelPosition="left"
        />
      </form>

      {vehicle ? (
        <MaintenanceSection
          vehicleId={vehicle.id}
          vehicleName={vehicleName(vehicle)}
          entries={maintenance}
          canEdit={!readOnly}
          initialOpen={openMaintenance}
          onCreated={onMaintenanceCreated}
          onDeleted={onMaintenanceDeleted}
        />
      ) : (
        <p className="hint border-t border-line-soft pt-4">{tt('fleet.wartungszeitraeumeLassenSichEi')}</p>
      )}
      </div>
      </TabPanel>

      {showDamages && vehicle && (
        <TabPanel idPrefix="veh" id="damages" active={activeTab === 'damages'}>
          <VehicleDamagesPanel
            vehicleId={vehicle.id}
            vehicleName={vehicleName(vehicle)}
            canEdit={damagesLevel === 'edit'}
            bookings={bookings}
            onOpenCountChange={handleOpenDamages}
          />
        </TabPanel>
      )}
    </Drawer>
  );
}

