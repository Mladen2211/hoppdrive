'use client';

import type { PricingTierDto } from '@hoppdrive/shared';
import { CarFront, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  ChipGroup,
  DrawerLayout,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  SkeletonRows,
  SkeletonTableRows,
  Table,
  TBody,
  useConfirm,
  useMediaQuery,
  useToast,
} from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePermission } from '@/hooks/usePermission';
import { api, isForbidden } from '@/lib/api';
import { fetchBookings } from '@/lib/bookings';
import { errorText } from '@/lib/errors';
import {
  allBookingCount,
  openBookingCount,
  vehicleMeta,
  vehicleName,
  vehicleState,
  type FleetBooking,
  type FleetFilter,
  type FleetMaintenance,
  type FleetState,
  type FleetVehicle,
} from '@/lib/fleet-model';
import { toInputDate } from '@/lib/format';
import { formatPlate } from '@/lib/plate';
import type { DamageBookingOption } from '@/lib/damage-model';
import { FleetCards, FleetTable, type FleetListActions } from './FleetList';
import { VehicleDrawer } from './VehicleDrawer';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const PAGE_SIZE = 8;

export default function FleetPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <FleetView />
    </Suspense>
  );
}

function FleetView() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const level = usePermission('fleet');
  const canEdit = level === 'edit';
  const damagesLevel = usePermission('damages');
  const isTabletUp = useMediaQuery('(min-width: 768px)');

  // Data
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [bookings, setBookings] = useState<FleetBooking[]>([]);
  const [maintenance, setMaintenance] = useState<FleetMaintenance[]>([]);
  const [tiers, setTiers] = useState<PricingTierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [standFailed, setStandFailed] = useState(false);

  // List state
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [maintenanceIntent, setMaintenanceIntent] = useState<string | null>(null);
  /** Open damages per vehicle (list badge); only loaded for roles that may see damages. */
  const [damageCounts, setDamageCounts] = useState<Map<string, number>>(new Map());

  const dirtyRef = useRef(false);
  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const selectedParam = searchParams.get('id');
  const creating = selectedParam === 'new';
  const selectedVehicle = useMemo(() => (selectedParam && !creating ? (vehicles.find((v) => v.id === selectedParam) ?? null) : null), [selectedParam, creating, vehicles]);
  const drawerOpen = !loading && (creating || selectedVehicle !== null);

  // ── Loading ───────────────────────────────────────────────────

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      const [vehicleRes, bookingRes, maintenanceRes, tierRes] = await Promise.allSettled([
        api.getAllVehicles(),
        fetchBookings(),
        api.getMaintenance(),
        api.getPricingTiers(),
      ]);
      if (vehicleRes.status === 'fulfilled') {
        setVehicles(vehicleRes.value as FleetVehicle[]);
        setLoadError(null);
      } else if (!silent) {
        setLoadError(errorText(vehicleRes.reason, tr('fleet.dieFahrzeugeKonntenNicht')));
      }
      if (bookingRes.status === 'fulfilled') setBookings(bookingRes.value.items as FleetBooking[]);
      if (maintenanceRes.status === 'fulfilled') setMaintenance(maintenanceRes.value as FleetMaintenance[]);
      if (tierRes.status === 'fulfilled') setTiers(tierRes.value);
      // The Stand (Vermietet, Wartung) needs bookings and maintenance; a missing permission is not worth a warning.
      setStandFailed(
        [bookingRes, maintenanceRes].some((r) => r.status === 'rejected' && !isForbidden(r.reason)),
      );
      setLoading(false);
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const vehicleIdsKey = vehicles.map((v) => v.id).join(',');
  useEffect(() => {
    if (damagesLevel === 'none' || !vehicleIdsKey) return;
    let cancelled = false;
    const ids = vehicleIdsKey.split(',');
    void Promise.allSettled(ids.map((id) => api.getVehicleDamages(id, 'OPEN'))).then((results) => {
      if (cancelled) return;
      const next = new Map<string, number>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next.set(ids[i], r.value.length);
      });
      setDamageCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [damagesLevel, vehicleIdsKey]);

  // ── Derived data ──────────────────────────────────────────────

  const todayKey = toInputDate(new Date());
  const states = useMemo(
    () => new Map<string, FleetState>(vehicles.map((v) => [v.id, vehicleState(v.id, bookings, maintenance, todayKey)])),
    [vehicles, bookings, maintenance, todayKey],
  );

  const counts = useMemo(() => {
    const count = (s: FleetState) => vehicles.filter((v) => states.get(v.id) === s).length;
    return { all: vehicles.length, available: count('available'), rented: count('rented'), reserved: count('reserved'), maintenance: count('maintenance') };
  }, [vehicles, states]);
  const visibleCount = useMemo(() => vehicles.filter((v) => v.isAvailable).length, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles
      .filter((v) => filter === 'all' || states.get(v.id) === filter)
      .filter((v) => !q || `${vehicleName(v)} ${vehicleMeta(v)} ${v.year} ${v.licensePlate ?? ''} ${formatPlate(v.licensePlate)}`.toLowerCase().includes(q))
      .sort((a, b) => vehicleName(a).localeCompare(vehicleName(b), 'de'));
  }, [vehicles, states, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /** Bookings of the open vehicle, for the damage form ("found during rental"). */
  const damageBookings = useMemo<DamageBookingOption[]>(
    () =>
      selectedVehicle
        ? bookings
            .filter((b) => b.vehicleId === selectedVehicle.id && b.status !== 'cancelled')
            .map((b) => ({ id: b.id, customerName: b.customerName, startDate: b.startDate, endDate: b.endDate, status: b.status }))
        : [],
    [bookings, selectedVehicle],
  );

  const filterOptions: { value: FleetFilter; label: string; count: number }[] = [
    { value: 'all', label: t('common.alle'), count: counts.all },
    { value: 'available', label: t('fleet.verfuegbar'), count: counts.available },
    { value: 'rented', label: t('fleet.vermietet'), count: counts.rented },
    { value: 'reserved', label: t('common.reserviert'), count: counts.reserved },
    { value: 'maintenance', label: t('common.wartung'), count: counts.maintenance },
  ];

  // ── URL state (?id=<vehicleId> | ?id=new) ─────────────────────

  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true;
    return confirm({
      title: tr('common.aenderungenVerwerfen'),
      description: tr('fleet.ihreNichtGespeichertenAenderun'),
      confirmLabel: tr('common.verwerfen'),
      cancelLabel: tr('common.weiterBearbeiten'),
      icon: <Undo2 size={20} />,
    });
  }, [confirm]);

  const goTo = useCallback(
    async (id: string | null) => {
      if (id === selectedParam) return;
      if (!(await confirmDiscard())) return;
      dirtyRef.current = false;
      router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });
    },
    [selectedParam, confirmDiscard, router, pathname],
  );

  const closeDrawer = useCallback(() => {
    setMaintenanceIntent(null);
    void goTo(null);
  }, [goTo]);

  // ?id= of a vehicle that does not exist (deleted, or a stale link)
  const warnedMissing = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedParam || creating || loading || selectedVehicle) return;
    if (warnedMissing.current === selectedParam) return;
    warnedMissing.current = selectedParam;
    toast.error(tr('fleet.fahrzeugNichtGefunden'), tr('fleet.derLinkVerweistAuf'));
    router.replace(pathname, { scroll: false });
  }, [selectedParam, creating, loading, selectedVehicle, toast, router, pathname]);

  // ── Actions ───────────────────────────────────────────────────

  const patchVehicle = useCallback((id: string, patch: Partial<FleetVehicle>) => {
    setVehicles((rows) => rows.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** "Auf Website" switch: optimistic, rolled back with a toast if the request fails. */
  const toggleVisible = useCallback(
    async (vehicle: FleetVehicle) => {
      const next = !vehicle.isAvailable;
      setBusy(vehicle.id, true);
      patchVehicle(vehicle.id, { isAvailable: next });
      try {
        await api.updateVehicle(vehicle.id, { isAvailable: next });
        toast.success(next ? tr('fleet.aufDerWebsiteSichtbar') : tr('fleet.vonDerWebsiteAusgeblendet'), vehicleName(vehicle));
      } catch (err) {
        patchVehicle(vehicle.id, { isAvailable: vehicle.isAvailable });
        toast.error(tr('fleet.sichtbarkeitKonnteNichtGeaende'), errorText(err));
      } finally {
        setBusy(vehicle.id, false);
      }
    },
    [patchVehicle, setBusy, toast],
  );

  const deleteVehicle = useCallback(
    async (vehicle: FleetVehicle) => {
      const open = openBookingCount(vehicle.id, bookings);
      const total = allBookingCount(vehicle.id, bookings);
      const warning = standFailed ? (
        <>{tr('fleet.offeneBuchungenKonntenNicht')}</>
      ) : (
        <>
          {tr.rich('fleet.deleteWarning', { open, b: (chunks) => <b>{chunks}</b> })}
          {total > 0 && <> {tr('fleet.fahrzeugeMitBuchungenLassen')}</>}
        </>
      );
      const done = await confirm({
        title: tr('fleet.loeschen', { vehicleName: vehicleName(vehicle) }),
        description: tr('fleet.dasFahrzeugVerschwindetAus'),
        warning,
        confirmLabel: tr('fleet.fahrzeugLoeschen'),
        icon: <Trash2 size={20} />,
        onConfirm: async () => {
          try {
            await api.deleteVehicle(vehicle.id);
          } catch (err) {
            throw new Error(
              total > 0
                ? tr('fleet.dasFahrzeugHatBuchungen')
                : errorText(err, tr('fleet.dasFahrzeugKonnteNicht')),
            );
          }
        },
      });
      if (!done) return;
      toast.success(tr('fleet.fahrzeugGeloescht'), vehicleName(vehicle));
      setVehicles((rows) => rows.filter((v) => v.id !== vehicle.id));
      if (selectedParam === vehicle.id) {
        dirtyRef.current = false;
        router.replace(pathname, { scroll: false });
      }
    },
    [bookings, standFailed, confirm, toast, selectedParam, router, pathname],
  );

  const openDamages = useCallback(
    async (vehicle: FleetVehicle) => {
      if (selectedParam !== vehicle.id && !(await confirmDiscard())) return;
      dirtyRef.current = false;
      setMaintenanceIntent(null);
      router.replace(`${pathname}?id=${vehicle.id}&tab=damages`, { scroll: false });
    },
    [selectedParam, confirmDiscard, router, pathname],
  );

  const actions: FleetListActions = {
    canEdit,
    selectedId: selectedVehicle?.id ?? null,
    busyIds,
    open: (v) => {
      setMaintenanceIntent(null);
      void goTo(v.id);
    },
    toggleVisible: (v) => void toggleVisible(v),
    addMaintenance: (v) => {
      setMaintenanceIntent(v.id);
      void goTo(v.id);
    },
    remove: (v) => void deleteVehicle(v),
    damageCounts: damagesLevel === 'none' ? undefined : damageCounts,
    openDamages: (v) => void openDamages(v),
  };

  const startCreate = () => {
    setMaintenanceIntent(null);
    void goTo('new');
  };

  // ── Render ────────────────────────────────────────────────────

  const subtitle = t('fleet.aufDerWebsiteSichtbar2', { length: vehicles.length, visibleCount });

  const resetFilters = () => {
    setFilter('all');
    setSearch('');
    setPage(1);
  };

  const errorBlock = loadError ? (
    <Alert
      tone="err"
      title={t('fleet.fahrzeugeKonntenNichtGeladen')}
      action={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          {t('common.erneutVersuchen')}
        </Button>
      }
    >
      {loadError}
    </Alert>
  ) : standFailed ? (
    <Alert
      tone="warn"
      title={t('fleet.derAktuelleStandFehlt')}
      action={
        <Button variant="outline" size="sm" onClick={() => void load(true)}>
          {t('common.erneutVersuchen')}
        </Button>
      }
    >
      {t('fleet.vermietetReserviertUndWartung')}
    </Alert>
  ) : null;

  const listBody = loading ? (
    isTabletUp ? (
      <Table aria-label={t('fleet.fahrzeugeWerdenGeladen')}>
        <TBody>
          <SkeletonTableRows rows={6} columns={5} />
        </TBody>
      </Table>
    ) : (
      <SkeletonRows rows={4} />
    )
  ) : loadError ? null : vehicles.length === 0 ? (
    <EmptyState
      icon={<CarFront size={32} />}
      title={t('fleet.nochKeineFahrzeugeIn')}
      text={t('fleet.legenSieDasErste')}
      actions={canEdit ? <Button onClick={startCreate}>{t('fleet.fahrzeugHinzufuegen')}</Button> : undefined}
    />
  ) : filtered.length === 0 ? (
    <EmptyState
      compact
      tone="neutral"
      icon={<CarFront size={32} />}
      title={t('fleet.keineFahrzeugeGefunden')}
      text={t('fleet.mitDemGewaehltenFilter')}
      actions={
        <Button variant="ghost" onClick={resetFilters}>
          {t('fleet.filterZuruecksetzen')}
        </Button>
      }
    />
  ) : isTabletUp ? (
    <>
      <FleetTable vehicles={paged} states={states} a={actions} />
      <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
        <span className="sm mut" aria-live="polite">{t('fleet.von', { value: (safePage - 1) * PAGE_SIZE + 1, value2: (safePage - 1) * PAGE_SIZE + paged.length, length: filtered.length })}</span>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            {t('common.zurueck')}
          </Button>
          <Button variant="ghost" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
            {t('fleet.weiter')}
          </Button>
        </div>
      </div>
    </>
  ) : (
    <FleetCards vehicles={filtered} states={states} a={actions} />
  );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DrawerLayout className="lg:-m-8">
        <div className="flex min-w-0 flex-col gap-5 md:gap-6 lg:p-8">
          <div className="max-md:hidden">
            <PageHeader
              title={t('common.flotte')}
              subtitle={loading ? t('fleet.fahrzeugeWerdenGeladen') : loadError ? undefined : subtitle}
              actions={
                canEdit ? (
                  <Button iconLeft={<Plus size={18} aria-hidden="true" />} onClick={startCreate}>
                    {t('fleet.fahrzeugHinzufuegen')}
                  </Button>
                ) : undefined
              }
            />
          </div>
          <h1 className="sr-only md:hidden">{t('common.flotte')}</h1>

          {errorBlock}

          {loadError ? null : isTabletUp ? (
            <Panel aria-labelledby="fleet-heading" className="overflow-hidden">
              <div className="panel-h">
                <h2 className="h2" id="fleet-heading">
                  {t('common.fahrzeuge')}
                </h2>
                <ChipGroup
                  aria-label={t('fleet.standFiltern')}
                  options={filterOptions}
                  value={filter}
                  onChange={(v) => {
                    setFilter(v);
                    setPage(1);
                  }}
                />
              </div>
              {listBody}
            </Panel>
          ) : (
            <>
              <div className="relative">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
                <Input
                  type="search"
                  aria-label={t('fleet.fahrzeugSuchen')}
                  placeholder={t('fleet.fahrzeugSuchen')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <ChipGroup
                aria-label={t('fleet.standFiltern')}
                scrollable
                options={filterOptions}
                value={filter}
                onChange={(v) => {
                  setFilter(v);
                  setPage(1);
                }}
                className="-mx-4 px-4"
              />
              {listBody}
            </>
          )}
        </div>

        {drawerOpen && (
          <VehicleDrawer
            key={creating ? 'new' : (selectedVehicle?.id ?? 'none')}
            vehicle={creating ? null : selectedVehicle}
            readOnly={!canEdit}
            tiers={tiers}
            maintenance={selectedVehicle ? maintenance.filter((m) => m.vehicleId === selectedVehicle.id) : []}
            bookings={damageBookings}
            onOpenDamagesChange={(vehicleId, count) =>
              setDamageCounts((prev) => (prev.get(vehicleId) === count ? prev : new Map(prev).set(vehicleId, count)))
            }
            openMaintenance={Boolean(selectedVehicle) && maintenanceIntent === selectedVehicle?.id}
            onClose={closeDrawer}
            onSaved={async (saved, created) => {
              dirtyRef.current = false;
              await load(true);
              if (created) router.replace(`${pathname}?id=${saved.id}`, { scroll: false });
            }}
            onDelete={(v) => void deleteVehicle(v)}
            onImageDeleted={(vehicleId, imageId) =>
              setVehicles((rows) => rows.map((v) => (v.id === vehicleId ? { ...v, images: v.images.filter((i) => i.id !== imageId) } : v)))
            }
            onImagesChanged={(vehicleId, images) =>
              setVehicles((rows) => rows.map((v) => (v.id === vehicleId ? { ...v, images } : v)))
            }
            onMaintenanceCreated={(entry) => setMaintenance((rows) => [...rows, entry])}
            onMaintenanceDeleted={(id) => setMaintenance((rows) => rows.filter((m) => m.id !== id))}
            onDirtyChange={onDirtyChange}
          />
        )}
      </DrawerLayout>

      {canEdit && !isTabletUp && !drawerOpen && (
        <button
          type="button"
          onClick={startCreate}
          aria-label={t('fleet.fahrzeugHinzufuegen')}
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-ruby text-white shadow-[0_8px_20px_rgba(166,14,14,.35)] hover:bg-ruby-hover"
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
