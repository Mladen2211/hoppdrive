'use client';

/**
 * The fleet as a table (>= 768 px) or as cards (< 768 px, docs/design Mobile-Screens panel 6).
 * Both show: thumbnail, name, type · fuel · seats, price per day, Stand today and the
 * "Auf Website" switch (= isAvailable, saved right away).
 */
import { Pencil, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import { Cell2, IconButton, Menu, StatusPill, Switch, Table, TBody, Td, Th, THead, Tr, cn, type MenuItem } from '@/components/ui';
import { useCurrency } from '@/hooks/useCurrency';
import { fmtMoney } from '@/lib/format';
import { primaryImage, vehicleMeta, vehicleName, type FleetState, type FleetVehicle } from '@/lib/fleet-model';
import { formatPlate } from '@/lib/plate';
import { VehicleThumb } from './VehicleThumb';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

export interface FleetListActions {
  canEdit: boolean;
  selectedId: string | null;
  busyIds: Set<string>;
  open: (vehicle: FleetVehicle) => void;
  toggleVisible: (vehicle: FleetVehicle) => void;
  addMaintenance: (vehicle: FleetVehicle) => void;
  remove: (vehicle: FleetVehicle) => void;
  /** Number of open damages per vehicle id (only when the role may see damages). */
  damageCounts?: ReadonlyMap<string, number>;
  /** Opens the vehicle drawer on the Schäden tab. */
  openDamages?: (vehicle: FleetVehicle) => void;
}

/** Kontrollschild as a small plate chip ("ZH 123 456"). */
function PlateChip({ plate }: { plate?: string | null }) {
  const t = useTranslations();
  if (!plate) return null;
  return (
    <span
      className="num inline-flex items-center rounded-md border border-line bg-card px-1.5 py-px text-[12px] font-semibold leading-[18px] tracking-wide text-ink"
      title={t('fleet.plateLabel')}
    >
      {formatPlate(plate)}
    </span>
  );
}

/** "2 Schäden": open damages of the vehicle, opens the Schäden tab. Renders nothing for 0. */
function DamageBadge({ vehicle, a }: { vehicle: FleetVehicle; a: FleetListActions }) {
  const t = useTranslations();
  const count = a.damageCounts?.get(vehicle.id) ?? 0;
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        a.openDamages?.(vehicle);
      }}
      aria-label={t('damages.openBadgeAria', { count, vehicle: vehicleName(vehicle) })}
      className="inline-flex min-h-[24px] items-center gap-1 rounded-full bg-warn-tint px-2 text-[12px] font-semibold text-warn-ink hover:underline"
    >
      <ShieldAlert size={13} aria-hidden="true" />
      {t('damages.openBadge', { count })}
    </button>
  );
}

/** Stand pill: a vehicle hidden from the website is shown grey, like on the board. */
function StatePill({ vehicle, state }: { vehicle: FleetVehicle; state: FleetState }) {
  return <StatusPill kind="vehicle" status={state} tone={!vehicle.isAvailable && state === 'available' ? 'gray' : undefined} />;
}

function menuItems(vehicle: FleetVehicle, a: FleetListActions): MenuItem[] {
  return [
    { key: 'maintenance', label: tr('fleet.wartungEintragen'), icon: <Wrench size={18} />, onSelect: () => a.addMaintenance(vehicle) },
    { key: 'delete', label: tr('common.loeschen'), icon: <Trash2 size={18} />, danger: true, separatorBefore: true, onSelect: () => a.remove(vehicle) },
  ];
}

function VisibilitySwitch({ vehicle, a }: { vehicle: FleetVehicle; a: FleetListActions }) {
  const t = useTranslations();
  return (
    <Switch
      checked={vehicle.isAvailable}
      onChange={() => a.toggleVisible(vehicle)}
      disabled={!a.canEdit || a.busyIds.has(vehicle.id)}
      aria-label={t('fleet.aufDerWebsiteAnzeigen', { vehicleName: vehicleName(vehicle) })}
    />
  );
}

export function FleetTable({ vehicles, states, a }: { vehicles: FleetVehicle[]; states: Map<string, FleetState>; a: FleetListActions }) {
  const t = useTranslations();
  const currency = useCurrency();
  return (
    <Table aria-label={t('common.fahrzeuge')}>
      <THead>
        <Tr>
          <Th>{t('common.fahrzeug')}</Th>
          <Th align="right">{t('fleet.preisProTag')}</Th>
          <Th>{t('fleet.stand')}</Th>
          <Th>{t('fleet.aufWebsite')}</Th>
          <Th align="right">
            <span className="sr-only">{t('common.aktionen')}</span>
          </Th>
        </Tr>
      </THead>
      <TBody>
        {vehicles.map((v) => (
          <Tr key={v.id} selected={v.id === a.selectedId} onClick={() => a.open(v)}>
            <Td>
              <div className="flex items-center gap-3">
                <VehicleThumb image={primaryImage(v.images)} className="h-12 w-[72px]" />
                <Cell2
                  primary={
                    <button
                      type="button"
                      className="text-left font-semibold hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        a.open(v);
                      }}
                    >
                      {vehicleName(v)}
                    </button>
                  }
                  secondary={
                    <>
                      {v.licensePlate && (
                        <>
                          <PlateChip plate={v.licensePlate} />{' '}
                        </>
                      )}
                      {vehicleMeta(v)}{' '}
                      <DamageBadge vehicle={v} a={a} />
                    </>
                  }
                />
              </div>
            </Td>
            <Td align="right" className="num whitespace-nowrap text-base">
              <b>{fmtMoney(v.basePricePerDay, { currency: v.currency ?? currency })}</b>
            </Td>
            <Td>
              <StatePill vehicle={v} state={states.get(v.id) ?? 'available'} />
            </Td>
            <Td onClick={(e) => e.stopPropagation()}>
              <VisibilitySwitch vehicle={v} a={a} />
            </Td>
            <Td onClick={(e) => e.stopPropagation()}>
              <div className="acts items-center">
                <IconButton className="pr" aria-label={a.canEdit ? t('fleet.editVehicle', { name: vehicleName(v) }) : t('fleet.viewVehicle', { name: vehicleName(v) })} onClick={() => a.open(v)}>
                  <Pencil size={20} aria-hidden="true" />
                </IconButton>
                {a.canEdit && <Menu items={menuItems(v, a)} label={t('fleet.weitereAktionenFuer', { vehicleName: vehicleName(v) })} />}
              </div>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function FleetCards({ vehicles, states, a }: { vehicles: FleetVehicle[]; states: Map<string, FleetState>; a: FleetListActions }) {
  const t = useTranslations();
  const currency = useCurrency();
  return (
    <ul className="flex flex-col gap-3">
      {vehicles.map((v) => (
        <li key={v.id}>
          <div className={cn('m-card', v.id === a.selectedId && 'border-ink')}>
            <div className="flex items-center gap-3">
              <VehicleThumb image={primaryImage(v.images)} className="h-[50px] w-[76px]" />
              <button type="button" onClick={() => a.open(v)} className="min-h-[48px] min-w-0 flex-1 text-left">
                <b className="block font-semibold">{vehicleName(v)}</b>
                <span className="sm mut block">{vehicleMeta(v)}</span>
                {v.licensePlate && (
                  <span className="mt-0.5 block">
                    <PlateChip plate={v.licensePlate} />
                  </span>
                )}
              </button>
              <b className="num whitespace-nowrap text-base">{fmtMoney(v.basePricePerDay, { currency: v.currency ?? currency })}</b>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2">
                <StatePill vehicle={v} state={states.get(v.id) ?? 'available'} />
                <DamageBadge vehicle={v} a={a} />
              </span>
              <span className="flex items-center gap-2.5">
                <span className="sm mut" aria-hidden="true">
                  {t('fleet.aufWebsite')}
                </span>
                <VisibilitySwitch vehicle={v} a={a} />
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
