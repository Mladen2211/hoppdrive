'use client';

import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  IconButton,
  PageHeader,
  Panel,
  Select,
  SkeletonRows,
  Tabs,
  useConfirm,
  useMediaQuery,
  useToast,
} from '@/components/ui';
import { useNewBooking, useOnBookingChange } from '@/components/NewBookingModal';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { fetchBookings } from '@/lib/bookings';
import {
  agendaGroups,
  buildItems,
  ganttVehicles,
  monthDays,
  upcomingBookings,
  vehicleLabel,
  type CalBooking,
  type CalInquiry,
  type CalItem,
  type CalMaintenance,
  type CalVehicle,
} from '@/lib/calendar-model';
import { contractFilename } from '@/lib/booking';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtDate, monthName, toInputDate } from '@/lib/format';
import { AgendaView } from './AgendaView';
import { DayDrawer } from './DayDrawer';
import { GanttView } from './GanttView';
import { MonthGridView } from './MonthGridView';
import { NextBookings, bookingOpenDay } from './NextBookings';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

type DesktopView = 'fahrzeuge' | 'monat';
type MobileView = 'agenda' | 'fahrzeuge';

export default function AvailabilityPage() {
  const tt = useTranslations();
  const t = useTranslations();
  const router = useRouter();
  const { token, role } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const newBooking = useNewBooking();
  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const canSign = useCan('contracts', 'edit');
  const canDownload = useCan('contracts', 'view');
  const canDeleteMaintenance = useCan('fleet', 'edit');
  const canSeeInquiries = useCan('inquiries', 'view');

  // Data
  const [vehicles, setVehicles] = useState<CalVehicle[]>([]);
  const [bookings, setBookings] = useState<CalBooking[]>([]);
  const [maintenance, setMaintenance] = useState<CalMaintenance[]>([]);
  const [inquiries, setInquiries] = useState<CalInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // View state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [desktopView, setDesktopView] = useState<DesktopView>('fahrzeuge');
  const [mobileView, setMobileView] = useState<MobileView>('agenda');
  const [selected, setSelected] = useState<{ dayKey: string; itemKey: string | null } | null>(null);

  // Signing and downloads
  const [signing, setSigning] = useState<CalBooking | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── Loading ───────────────────────────────────────────────────

  const load = useCallback(
    async (silent = false) => {
      if (!token || !role) return; // wait for the role: it decides whether inquiries may be read
      if (!silent) setLoading(true);
      const [vehicleRes, bookingRes, maintenanceRes, pendingRes, reviewedRes] = await Promise.allSettled([
        api.getAllVehicles(),
        fetchBookings(),
        api.getMaintenance(),
        // Open inquiries paint dashed amber bars. Roles without access to inquiries simply get none.
        canSeeInquiries ? api.getContactRequests({ status: 'pending', pageSize: 100 }) : Promise.resolve(null),
        canSeeInquiries ? api.getContactRequests({ status: 'reviewed', pageSize: 100 }) : Promise.resolve(null),
      ]);

      if (vehicleRes.status === 'fulfilled' && bookingRes.status === 'fulfilled' && maintenanceRes.status === 'fulfilled') {
        setVehicles(vehicleRes.value as CalVehicle[]);
        setBookings(bookingRes.value.items as CalBooking[]);
        setMaintenance(maintenanceRes.value as CalMaintenance[]);
        setLoadError(null);
      } else if (!silent) {
        const failed = [vehicleRes, bookingRes, maintenanceRes].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        setLoadError(errorText(failed?.reason, tr('availability.dieKalenderdatenKonntenNicht')));
      }

      const open: CalInquiry[] = [];
      let inquiryFailed = false;
      for (const res of [pendingRes, reviewedRes]) {
        if (res.status === 'fulfilled') {
          if (res.value) open.push(...(res.value.items as CalInquiry[]));
        } else inquiryFailed = true;
      }
      if (!inquiryFailed || !silent) setInquiries(open);
      setLoading(false);
    },
    [token, role, canSeeInquiries],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // A booking was created or signed through the global "Neue Buchung" dialog.
  useOnBookingChange(() => void load(true));

  // ── Derived data ──────────────────────────────────────────────

  const todayKey = toInputDate(new Date());

  const items: CalItem[] = useMemo(
    () => buildItems({ vehicles, bookings, maintenance, inquiries, vehicleFilter }),
    [vehicles, bookings, maintenance, inquiries, vehicleFilter],
  );
  const rowVehicles = useMemo(() => ganttVehicles(vehicles, items, vehicleFilter), [vehicles, items, vehicleFilter]);
  const days = useMemo(() => monthDays(year, month), [year, month]);
  const agenda = useMemo(() => agendaGroups(items, days), [items, days]);
  const upcoming = useMemo(() => upcomingBookings(bookings, vehicleFilter, todayKey), [bookings, vehicleFilter, todayKey]);
  const vehicleOptions = useMemo(
    () => [...vehicles].sort((a, b) => vehicleLabel(a).localeCompare(vehicleLabel(b), 'de')),
    [vehicles],
  );

  // ── Navigation ────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const openDay = useCallback((dayKey: string, itemKey?: string) => setSelected({ dayKey, itemKey: itemKey ?? null }), []);
  const openNewBooking = useCallback((dayKey?: string) => newBooking.open(dayKey ? { date: dayKey } : undefined), [newBooking]);

  // ── Actions ───────────────────────────────────────────────────

  async function downloadContract(booking: CalBooking) {
    setBusyId(booking.id);
    try {
      triggerBlobDownload(await api.downloadContract(booking.id), contractFilename(booking.id));
    } catch (err) {
      toast.error(tr('common.vertragKonnteNichtHeruntergela'), errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSign(signatureDataUrl: string) {
    if (!signing) return;
    setSigningLoading(true);
    try {
      await api.finalizeContract(signing.id, { signature: signatureDataUrl, customerEmail: signing.customerEmail || undefined });
      toast.success(tr('common.vertragSigniert'), signing.customerEmail ? tr('common.derVertragWurdePer') : tr('availability.vertragVonGespeichert', { customerName: signing.customerName }));
      setSigning(null);
      void load(true);
    } catch (err) {
      toast.error(tr('common.vertragKonnteNichtSigniert'), errorText(err));
    } finally {
      setSigningLoading(false);
    }
  }

  function quickSign(booking: CalBooking) {
    // The signature pad is a full-screen layer of its own: close the day panel first so the two never fight over focus.
    setSelected(null);
    setSigning(booking);
  }

  async function deleteMaintenance(item: Extract<CalItem, { kind: 'maintenance' }>) {
    const period = item.maintenance;
    const done = await confirm({
      title: tr('availability.wartungszeitraumLoeschen'),
      description: `${item.vehicleName}, ${fmtDate(period.startDate)} – ${fmtDate(period.endDate)}`,
      warning: tr('availability.dasFahrzeugIstDanach'),
      confirmLabel: tr('availability.wartungLoeschen'),
      icon: <Trash2 size={20} />,
      onConfirm: async () => {
        try {
          await api.deleteMaintenance(period.id);
        } catch (err) {
          throw new Error(errorText(err, tr('availability.derWartungszeitraumKonnteNicht')));
        }
        setMaintenance((prev) => prev.filter((p) => p.id !== period.id));
      },
    });
    if (done) toast.success(tr('availability.wartungGeloescht'), item.vehicleName);
  }

  // ── Render ────────────────────────────────────────────────────

  const monthTitle = `${monthName(month)} ${year}`;

  const vehicleSelect = (
    <Select aria-label={t('availability.fahrzeugFiltern')} value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="w-[220px] max-md:w-full">
      <option value="all">{t('availability.alleFahrzeuge')}</option>
      {vehicleOptions.map((v) => (
        <option key={v.id} value={v.id}>
          {vehicleLabel(v)}
        </option>
      ))}
    </Select>
  );

  const monthNav = (
    <div className="flex items-center justify-between gap-1.5 max-md:w-full">
      <IconButton variant="outline" aria-label={t('availability.vorherigerMonat')} onClick={prevMonth}>
        <ChevronLeft size={20} aria-hidden="true" />
      </IconButton>
      <b className="h2 min-w-[150px] text-center" aria-live="polite">
        {monthTitle}
      </b>
      <IconButton variant="outline" aria-label={t('availability.naechsterMonat')} onClick={nextMonth}>
        <ChevronRight size={20} aria-hidden="true" />
      </IconButton>
    </div>
  );

  const desktopControls = (
    <>
      {monthNav}
      <Button variant="ghost" onClick={goToday}>
        {t('common.heute')}
      </Button>
      <Tabs
        aria-label={t('availability.ansicht')}
        value={desktopView}
        onChange={(id) => setDesktopView(id as DesktopView)}
        tabs={[
          { id: 'fahrzeuge', label: tt('availability.fahrzeuge') },
          { id: 'monat', label: tt('availability.monat') },
        ]}
      />
      {vehicleSelect}
    </>
  );

  const errorBlock = loadError ? (
    <Alert
      tone="err"
      title={t('availability.kalenderKonnteNichtGeladen')}
      action={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          {t('common.erneutVersuchen')}
        </Button>
      }
    >
      {loadError}
    </Alert>
  ) : null;

  const nextBookingsPanel = (
    <NextBookings
      bookings={upcoming}
      vehicles={vehicles}
      canCreate={newBooking.canCreate}
      onCreate={() => openNewBooking()}
      onOpen={(booking) => {
        const dayKey = bookingOpenDay(booking, todayKey);
        const [y, m] = dayKey.split('-').map(Number);
        setYear(y);
        setMonth(m - 1);
        openDay(dayKey, `booking:${booking.id}`);
      }}
    />
  );

  const ganttPanel = (
    <GanttView year={year} month={month} vehicles={rowVehicles} items={items} todayKey={todayKey} onOpen={openDay} />
  );

  let content: ReactNode;
  if (loading) {
    content = (
      <>
        <Panel className="overflow-hidden" aria-busy="true">
          <SkeletonRows rows={5} avatar={false} pill={false} className="px-5 py-2" label={t('availability.kalenderWirdGeladen')} />
        </Panel>
        {isTabletUp && (
          <Panel className="overflow-hidden" aria-busy="true">
            <SkeletonRows rows={4} avatar={false} pill={false} className="px-5 py-2" label={t('availability.monatsuebersichtWirdGeladen')} />
          </Panel>
        )}
      </>
    );
  } else if (loadError) {
    content = null;
  } else if (!isTabletUp) {
    content =
      mobileView === 'agenda' ? (
        <AgendaView
          groups={agenda}
          month={month}
          year={year}
          canCreate={newBooking.canCreate}
          onCreate={() => openNewBooking()}
          onOpen={openDay}
        />
      ) : (
        <>
          {ganttPanel}
          {nextBookingsPanel}
        </>
      );
  } else if (desktopView === 'monat') {
    content = (
      <>
        <MonthGridView year={year} month={month} items={items} todayKey={todayKey} maxChips={4} roomy onOpen={openDay} />
        {nextBookingsPanel}
      </>
    );
  } else {
    content = (
      <>
        {ganttPanel}
        <MonthGridView year={year} month={month} items={items} todayKey={todayKey} onOpen={openDay} />
        {nextBookingsPanel}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="max-md:hidden">
        <PageHeader title={t('availability.kalender')} subtitle={t('availability.belegungAnfragenUndWartung')} actions={desktopControls} />
      </div>
      <h1 className="sr-only md:hidden">{t('availability.kalender')}</h1>

      {!isTabletUp && (
        <div className="flex flex-col gap-3.5">
          {monthNav}
          <Tabs
            aria-label={t('availability.ansicht')}
            value={mobileView}
            onChange={(id) => setMobileView(id as MobileView)}
            className="w-full [&>.tab]:flex-1 [&>.tab]:justify-center"
            tabs={[
              { id: 'agenda', label: tt('availability.agenda') },
              { id: 'fahrzeuge', label: tt('availability.fahrzeuge') },
            ]}
          />
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">{vehicleSelect}</div>
            <Button variant="ghost" onClick={goToday}>
              {t('common.heute')}
            </Button>
          </div>
        </div>
      )}

      {errorBlock}
      {content}

      <DayDrawer
        dayKey={selected?.dayKey ?? null}
        highlightKey={selected?.itemKey ?? null}
        items={items}
        canCreate={newBooking.canCreate}
        canSign={canSign}
        canDownload={canDownload}
        canDeleteMaintenance={canDeleteMaintenance}
        busyId={busyId}
        onClose={() => setSelected(null)}
        onCreate={(dayKey) => openNewBooking(dayKey)}
        onDeleteMaintenance={(item) => void deleteMaintenance(item)}
        onDownload={(booking) => void downloadContract(booking)}
        onSignOnDevice={(booking) => router.push(`/contracts/${booking.id}/sign`)}
        onQuickSign={quickSign}
      />

      {signing && (
        <SignaturePad
          customerName={signing.customerName}
          loading={signingLoading}
          onConfirm={handleSign}
          onCancel={() => setSigning(null)}
        />
      )}
    </div>
  );
}
