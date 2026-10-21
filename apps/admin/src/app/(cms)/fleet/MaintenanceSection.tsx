'use client';

/**
 * "Wartung" in the vehicle drawer: timeline of the maintenance entries (Geplant / Aktiv / Erledigt)
 * and an inline "Eintragen" form (Von, Bis, Grund, Notizen). Same API calls and the same validation
 * message as the old maintenance modal; deleting an entry now asks first.
 */
import { Plus, Trash2, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, IconButton, Input, Select, StatusPill, cn, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtDate } from '@/lib/format';
import {
  MAINTENANCE_REASONS,
  MAINTENANCE_REASON_LABELS,
  PHASE_LABEL,
  maintenancePeriod,
  maintenancePhase,
  sortMaintenance,
  type FleetMaintenance,
  type MaintenancePhase,
} from '@/lib/fleet-model';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const PHASE_TONE: Record<MaintenancePhase, 'amber' | 'blue' | 'gray'> = { planned: 'amber', active: 'blue', done: 'gray' };

export interface MaintenanceSectionProps {
  vehicleId: string;
  vehicleName: string;
  entries: FleetMaintenance[];
  canEdit: boolean;
  /** Opens the form right away (from "Wartung eintragen" in the table menu). */
  initialOpen?: boolean;
  onCreated: (entry: FleetMaintenance) => void;
  onDeleted: (id: string) => void;
}

const EMPTY = { startDate: '', endDate: '', reason: 'repair', notes: '' };

export function MaintenanceSection({ vehicleId, vehicleName, entries, canEdit, initialOpen = false, onCreated, onDeleted }: MaintenanceSectionProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(initialOpen);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialOpen) return;
    const timer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ block: 'center' });
      startRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [initialOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.startDate || !form.endDate) {
      setError(tr('fleet.startUndEnddatumSind'));
      return;
    }
    if (form.endDate < form.startDate) {
      setError(tr('fleet.dasEnddatumMussNach'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.createMaintenance({
        vehicleId,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        reason: form.reason as 'repair' | 'accident' | 'other',
        notes: form.notes.trim() || undefined,
      });
      onCreated(created as FleetMaintenance);
      toast.success(tr('fleet.wartungEingetragen'), `${vehicleName}, ${fmtDate(form.startDate)} – ${fmtDate(form.endDate)}`);
      setForm(EMPTY);
      setOpen(false);
    } catch (err) {
      setError(errorText(err, tr('fleet.wartungszeitraumKonnteNichtAng')));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: FleetMaintenance) {
    const done = await confirm({
      title: tr('fleet.wartungszeitraumLoeschen'),
      description: `${vehicleName}, ${maintenancePeriod(entry)}`,
      warning: tr('fleet.dasFahrzeugIstDanach'),
      confirmLabel: tr('fleet.wartungLoeschen'),
      icon: <Trash2 size={20} />,
      onConfirm: async () => {
        try {
          await api.deleteMaintenance(entry.id);
        } catch (err) {
          throw new Error(errorText(err, tr('fleet.derWartungszeitraumKonnteNicht')));
        }
        onDeleted(entry.id);
      },
    });
    if (done) toast.success(tr('fleet.wartungGeloescht'), vehicleName);
  }

  const sorted = sortMaintenance(entries);

  return (
    <section ref={sectionRef} aria-labelledby={`maint-${vehicleId}`} className="border-t border-line-soft pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="h3" id={`maint-${vehicleId}`}>
          {t('common.wartung')}
        </h3>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Plus size={16} aria-hidden="true" />}
            aria-expanded={open}
            aria-controls={`maint-form-${vehicleId}`}
            onClick={() => setOpen((v) => !v)}
          >
            {t('fleet.eintragen')}
          </Button>
        )}
      </div>

      {canEdit && open && (
        <form id={`maint-form-${vehicleId}`} onSubmit={handleSubmit} noValidate className="mb-4 flex flex-col gap-3.5 rounded-14 border border-line bg-row p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.von')} required>
              <Input ref={startRef} type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </Field>
            <Field label={t('common.bis')} required>
              <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </Field>
          </div>
          <Field label={t('fleet.grund')}>
            <Select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
              {MAINTENANCE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {MAINTENANCE_REASON_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('fleet.notizenOptional')}>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('fleet.zBWerkstattMuster')} />
          </Field>
          {error && (
            <p className="errm" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={saving} iconLeft={<Wrench size={16} aria-hidden="true" />}>
              {t('fleet.zeitraumHinzufuegen')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {t('common.abbrechen')}
            </Button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="mut">{t('fleet.keineWartungszeitraeumeEingetr')}</p>
      ) : (
        <ul className="relative flex flex-col gap-3.5 pl-[22px] before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-0.5 before:bg-line">
          {sorted.map((entry) => {
            const phase = maintenancePhase(entry);
            return (
              <li
                key={entry.id}
                className={cn(
                  'relative before:absolute before:-left-[22px] before:top-[5px] before:h-3 before:w-3 before:rounded-full before:border-2',
                  phase === 'done' ? 'before:border-cool before:bg-card' : 'before:border-warn before:bg-warn-tint',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="num font-semibold">{maintenancePeriod(entry)}</b>
                      <StatusPill tone={PHASE_TONE[phase]} label={PHASE_LABEL[phase]} className="!h-[22px] !text-xs" />
                    </div>
                    <div className="sm mut break-words">
                      {MAINTENANCE_REASON_LABELS[entry.reason] ?? entry.reason}
                      {entry.notes ? ` · ${entry.notes}` : ''}
                    </div>
                  </div>
                  {canEdit && (
                    <IconButton aria-label={t('fleet.wartungLoeschen2', { maintenancePeriod: maintenancePeriod(entry) })} className="-my-2 -mr-2" onClick={() => void handleDelete(entry)}>
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
