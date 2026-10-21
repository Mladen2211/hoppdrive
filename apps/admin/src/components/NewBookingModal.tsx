'use client';

/**
 * Global "Neue Buchung" dialog (top bar button, mobile FAB, calendar day, empty states).
 *
 * Mount <NewBookingProvider> once inside the signed-in shell (it needs the auth context), then
 * anywhere below it:
 *
 *   const booking = useNewBooking();
 *   booking.open();                                   // empty form
 *   booking.open({ date: '2026-12-05' });             // Von/Bis pre-filled (calendar day click)
 *   booking.open({ vehicleId, date });                // + vehicle pre-selected
 *
 * Refetching after a booking was created (or its contract signed in the follow-up dialog):
 *
 *   const { bookingsVersion } = useNewBooking();      // counter, +1 on every change
 *   useEffect(() => { reload(); }, [bookingsVersion]);
 *   useOnBookingChange((event) => { ... });           // or subscribe to the events
 *
 * Behaviour is the one the calendar page had: Fahrzeug*, Kundenname*, E-Mail, Von*, Bis*, price
 * (Gesamtpreis / Pro Tag, empty = automatic pricing), Notizen; POST /bookings; then the SignaturePad opens
 * for the new booking and POST /bookings/:id/finalize-contract.
 * Richtpreis from GET /pricing, warnings for overlapping bookings / maintenance / open inquiries.
 * Pickup and return carry TIMES (default 09:00 / 18:00, entered in Swiss time and sent as UTC instants),
 * an optional Rabattcode with live validation and the optional Fahrerdaten block (Telefon, Adresse,
 * Geburtsdatum, Führerausweis).
 */
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import type { DiscountValidationDto } from '@hoppdrive/shared';
import { Alert, Button, Field, Input, Modal, Select, Skeleton, Textarea, cn, useToast } from '@/components/ui';
import { DiscountCodeField } from '@/components/booking/DiscountCodeField';
import { DriverFields } from '@/components/booking/DriverFields';
import { useCurrency } from '@/hooks/useCurrency';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { fetchBookings } from '@/lib/bookings';
import { bookingErrorText, isDiscountInvalid } from '@/lib/booking-errors';
import {
  driverCreatePayload,
  driverErrorsFromApi,
  emptyDriver,
  hasDriverData,
  validateDriver,
  type DriverErrors,
  type DriverForm,
} from '@/lib/driver';
import { errorText, isCancelled } from '@/lib/errors';
import { fmtDate, fmtMoney } from '@/lib/format';
import { formatPlate } from '@/lib/plate';
import { daysForRange, fetchPriceQuote, type PriceQuote } from '@/lib/pricing';
import { DEFAULT_PICKUP_TIME, DEFAULT_RETURN_TIME, zurichToIso } from '@/lib/zurich';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

// ─── Public API ─────────────────────────────────────────────────

export interface NewBookingOpenOptions {
  /** 'YYYY-MM-DD'; used for Von and Bis. */
  date?: string;
  vehicleId?: string;
}

export interface BookingEvent {
  type: 'created' | 'signed';
  bookingId: string;
}

export interface NewBookingApi {
  /** Opens the dialog (shows a "Keine Berechtigung" toast for read-only roles). */
  open: (options?: NewBookingOpenOptions) => void;
  close: () => void;
  isOpen: boolean;
  /** The role may create bookings (calendar or contracts: edit). Use it to hide buttons. */
  canCreate: boolean;
  /** +1 whenever a booking was created or a contract was signed through this dialog. */
  bookingsVersion: number;
  subscribe: (listener: (event: BookingEvent) => void) => () => void;
}

const NOOP_API: NewBookingApi = {
  open: () => undefined,
  close: () => undefined,
  isOpen: false,
  canCreate: false,
  bookingsVersion: 0,
  subscribe: () => () => undefined,
};

const NewBookingContext = createContext<NewBookingApi>(NOOP_API);

export function useNewBooking(): NewBookingApi {
  return useContext(NewBookingContext);
}

/** Calls `listener` after every created booking / signed contract (always the latest closure). */
export function useOnBookingChange(listener: (event: BookingEvent) => void): void {
  const { subscribe } = useNewBooking();
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => subscribe((event) => ref.current(event)), [subscribe]);
}

// ─── Provider ───────────────────────────────────────────────────

interface SigningState {
  bookingId: string;
  customerName: string;
  customerEmail: string;
}

export function NewBookingProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const canCalendar = useCan('calendar', 'edit');
  const canContracts = useCan('contracts', 'edit');
  const canCreate = canCalendar || canContracts;

  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<NewBookingOpenOptions>({});
  const [version, setVersion] = useState(0);
  const [signing, setSigning] = useState<SigningState | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const listeners = useRef(new Set<(event: BookingEvent) => void>());

  const emit = useCallback((event: BookingEvent) => {
    setVersion((v) => v + 1);
    listeners.current.forEach((listener) => {
      try {
        listener(event);
      } catch {
        /* a failing subscriber must not break the others */
      }
    });
  }, []);

  const subscribe = useCallback((listener: (event: BookingEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const open = useCallback(
    (options?: NewBookingOpenOptions) => {
      if (!canCreate) {
        toast.error(tr('newBooking.keineBerechtigung'), tr('newBooking.mitIhrerRolleKoennen'));
        return;
      }
      setPrefill(options ?? {});
      setIsOpen(true);
    },
    [canCreate, toast],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const handleCreated = useCallback(
    (created: SigningState & { vehicleLabel: string; discountText?: string }) => {
      setIsOpen(false);
      emit({ type: 'created', bookingId: created.bookingId });
      toast.success(
        tr('newBooking.buchungGespeichert'),
        `${created.customerName}${created.vehicleLabel ? ` · ${created.vehicleLabel}` : ''}${created.discountText ? ` · ${created.discountText}` : ''}`,
        {
          action: { label: tr('common.zurBuchung'), onClick: () => router.push(`/contracts?id=${created.bookingId}`) },
        },
      );
      // Offer to sign the contract right away (same as the calendar page always did).
      setSigning({ bookingId: created.bookingId, customerName: created.customerName, customerEmail: created.customerEmail });
    },
    [emit, router, toast],
  );

  const handleSign = useCallback(
    async (signatureDataUrl: string) => {
      if (!signing) return;
      setSigningLoading(true);
      try {
        await api.finalizeContract(signing.bookingId, {
          signature: signatureDataUrl,
          customerEmail: signing.customerEmail || undefined,
        });
        emit({ type: 'signed', bookingId: signing.bookingId });
        toast.success(tr('common.vertragSigniert'), signing.customerEmail ? tr('common.derVertragWurdePer') : tr('newBooking.derVertragStehtAls'));
        setSigning(null);
      } catch (err) {
        toast.error(tr('common.vertragKonnteNichtSigniert'), errorText(err));
      } finally {
        setSigningLoading(false);
      }
    },
    [emit, signing, toast],
  );

  const value = useMemo<NewBookingApi>(
    () => ({ open, close, isOpen, canCreate, bookingsVersion: version, subscribe }),
    [open, close, isOpen, canCreate, version, subscribe],
  );

  return (
    <NewBookingContext.Provider value={value}>
      {children}
      <NewBookingModal open={isOpen} prefill={prefill} onClose={close} onCreated={handleCreated} />
      {signing && (
        <SignaturePad
          customerName={signing.customerName}
          loading={signingLoading}
          onConfirm={handleSign}
          onCancel={() => setSigning(null)}
        />
      )}
    </NewBookingContext.Provider>
  );
}

// ─── Modal ──────────────────────────────────────────────────────

interface VehicleOption {
  id: string;
  brand: string;
  model: string;
  licensePlate?: string | null;
}

interface BookingRow {
  id: string;
  vehicleId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface MaintenanceRow {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
}

interface InquiryRow {
  id: string;
  fullName: string;
  vehicleOfInterest?: string | null;
  desiredStartDate?: string | null;
  desiredEndDate?: string | null;
  status: string;
}

type PriceMode = 'total' | 'perDay';

interface FormState {
  vehicleId: string;
  customerName: string;
  customerEmail: string;
  startDate: string;
  /** HH:mm, Swiss time */
  startTime: string;
  endDate: string;
  endTime: string;
  priceMode: PriceMode;
  priceValue: string;
  notes: string;
  discountCode: string;
  driver: DriverForm;
}

const emptyForm = (): FormState => ({
  vehicleId: '',
  customerName: '',
  customerEmail: '',
  startDate: '',
  startTime: DEFAULT_PICKUP_TIME,
  endDate: '',
  endTime: DEFAULT_RETURN_TIME,
  priceMode: 'total',
  priceValue: '',
  notes: '',
  discountCode: '',
  driver: emptyDriver(),
});

type FieldErrors = Partial<Record<'vehicleId' | 'customerName' | 'customerEmail' | 'startDate' | 'endDate' | 'discountCode', string>>;

const OPEN_INQUIRY_STATUSES = ['pending', 'reviewed', 'responded'];

/** Date + time input pair for pickup / return (one label, one error). */
function DateTimeRow({
  label,
  dateLabel,
  timeLabel,
  date,
  time,
  min,
  error,
  onDate,
  onTime,
}: {
  label: string;
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  min?: string;
  error?: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="fld" role="group" aria-labelledby={`${id}-l`}>
      <span className="lbl" id={`${id}-l`}>
        {label}
        <span className="text-err" aria-hidden="true">
          {' '}
          *
        </span>
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
        <Input type="date" aria-label={dateLabel} value={date} min={min} required aria-invalid={error ? true : undefined} onChange={(e) => onDate(e.target.value)} />
        <Input type="time" aria-label={timeLabel} value={time} required aria-invalid={error ? true : undefined} step={300} onChange={(e) => onTime(e.target.value)} className="num" />
      </div>
      {error && (
        <span className="errm" aria-live="polite">
          {error}
        </span>
      )}
    </div>
  );
}

const vehicleName = (v: { brand: string; model: string } | undefined) => (v ? `${v.brand} ${v.model}` : '');

function rangeText(start: string, end: string): string {
  return tr('newBooking.rangeText', { from: fmtDate(start), to: fmtDate(end) });
}

function NewBookingModal({
  open,
  prefill,
  onClose,
  onCreated,
}: {
  open: boolean;
  prefill: NewBookingOpenOptions;
  onClose: () => void;
  onCreated: (created: SigningState & { vehicleLabel: string; discountText?: string }) => void;
}) {
  const t = useTranslations();
  const canViewInquiries = useCan('inquiries', 'view');
  const currencyCode = useCurrency();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [driverErrors, setDriverErrors] = useState<DriverErrors>({});
  const [driverOpen, setDriverOpen] = useState(false);
  const [discountResult, setDiscountResult] = useState<DiscountValidationDto | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState(false);

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Reset the form each time the dialog opens (with the optional pre-fill).
  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm(),
      vehicleId: prefill.vehicleId ?? '',
      startDate: prefill.date ?? '',
      endDate: prefill.date ?? '',
    });
    setErrors({});
    setDriverErrors({});
    setDriverOpen(false);
    setDiscountResult(null);
    setFormError('');
    setSaving(false);
    setQuote(null);
    setQuoteState('idle');
  }, [open, prefill]);

  // Reference data: vehicles (required) + bookings / maintenance / open inquiries (for the warnings).
  const loadReference = useCallback(async () => {
    setRefLoading(true);
    setRefError(false);
    const [vehicleRes, bookingRes, maintenanceRes, inquiryRes] = await Promise.allSettled([
      api.getVehicles(),
      fetchBookings(),
      api.getMaintenance(),
      canViewInquiries ? api.getContactRequests({ page: 1, pageSize: 100 }) : Promise.resolve(null),
    ]);
    if (vehicleRes.status === 'fulfilled') setVehicles(vehicleRes.value as VehicleOption[]);
    else setRefError(true);
    if (bookingRes.status === 'fulfilled') setBookings((bookingRes.value.items || []) as BookingRow[]);
    if (maintenanceRes.status === 'fulfilled') setMaintenance(maintenanceRes.value as MaintenanceRow[]);
    if (inquiryRes.status === 'fulfilled' && inquiryRes.value) setInquiries((inquiryRes.value.items || []) as InquiryRow[]);
    setRefLoading(false);
  }, [canViewInquiries]);

  useEffect(() => {
    if (open) void loadReference();
  }, [open, loadReference]);

  // Pickup / return as real instants (entered in Swiss time). The API counts rental days from them.
  const startIso = useMemo(() => (form.startDate && form.startTime ? zurichToIso(form.startDate, form.startTime) : ''), [form.startDate, form.startTime]);
  const endIso = useMemo(() => (form.endDate && form.endTime ? zurichToIso(form.endDate, form.endTime) : ''), [form.endDate, form.endTime]);
  const days = useMemo(() => daysForRange(startIso, endIso), [startIso, endIso]);
  const datesValid = Boolean(startIso && endIso && new Date(endIso).getTime() > new Date(startIso).getTime());
  const selectedVehicle = vehicles.find((v) => v.id === form.vehicleId);

  // Richtpreis (GET /pricing), debounced.
  useEffect(() => {
    if (!open || !form.vehicleId || !datesValid || days < 1) {
      setQuote(null);
      setQuoteState('idle');
      return;
    }
    const controller = new AbortController();
    setQuoteState('loading');
    const timer = window.setTimeout(() => {
      fetchPriceQuote(form.vehicleId, days, controller.signal)
        .then((result) => {
          setQuote(result);
          setQuoteState('ready');
        })
        .catch((err) => {
          if (isCancelled(err) || controller.signal.aborted) return;
          setQuote(null);
          setQuoteState('error');
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, form.vehicleId, datesValid, days]);

  // Overlap warnings. The server refuses reserved/active bookings and maintenance in the range; open
  // inquiries are only a hint (nothing blocks the booking).
  const conflicts = useMemo(() => {
    if (!form.vehicleId || !datesValid) return { bookings: [], maintenance: [], inquiries: [] };
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const overlaps = (aStart: string, aEnd: string) => new Date(aStart).getTime() < end && new Date(aEnd).getTime() > start;
    const label = vehicleName(selectedVehicle).toLowerCase();
    return {
      bookings: bookings.filter(
        (b) => b.vehicleId === form.vehicleId && (b.status === 'reserved' || b.status === 'active') && overlaps(b.startDate, b.endDate),
      ),
      maintenance: maintenance.filter((m) => m.vehicleId === form.vehicleId && overlaps(m.startDate, m.endDate)),
      inquiries: inquiries.filter(
        (i) =>
          OPEN_INQUIRY_STATUSES.includes(i.status) &&
          Boolean(i.desiredStartDate && i.desiredEndDate && i.vehicleOfInterest) &&
          label.includes(String(i.vehicleOfInterest).toLowerCase().trim()) &&
          overlaps(i.desiredStartDate as string, i.desiredEndDate as string),
      ),
    };
  }, [form.vehicleId, startIso, endIso, datesValid, bookings, maintenance, inquiries, selectedVehicle]);

  // Entered price: Gesamtpreis or Pro Tag (empty = automatic pricing on the server).
  const enteredValue = parseFloat(form.priceValue);
  const hasEnteredPrice = Number.isFinite(enteredValue) && enteredValue > 0;
  const derivedPrice = useMemo(() => {
    if (!hasEnteredPrice || days <= 0) return '';
    return form.priceMode === 'total' ? (enteredValue / days).toFixed(2) : (enteredValue * days).toFixed(2);
  }, [hasEnteredPrice, enteredValue, days, form.priceMode]);

  function totalPriceToSend(): number | undefined {
    if (!hasEnteredPrice) return undefined;
    if (form.priceMode === 'total') return Math.round(enteredValue * 100) / 100;
    return Math.round(enteredValue * days * 100) / 100;
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
    if (key === 'startTime') setErrors((current) => ({ ...current, startDate: undefined }));
    if (key === 'endTime') setErrors((current) => ({ ...current, endDate: undefined }));
    setFormError('');
  }

  function updateDriver(patch: Partial<DriverForm>) {
    setForm((current) => ({ ...current, driver: { ...current.driver, ...patch } }));
    setDriverErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof DriverForm];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: FieldErrors = {};
    if (!form.vehicleId) next.vehicleId = tr('newBooking.bitteEinFahrzeugWaehlen');
    if (!form.customerName.trim()) next.customerName = tr('newBooking.bitteDenNamenEingeben');
    if (!form.startDate) next.startDate = tr('newBooking.bitteDasStartdatumWaehlen');
    else if (!form.startTime) next.startDate = tr('newBooking.pickupTimeRequired');
    if (!form.endDate) next.endDate = tr('newBooking.bitteDasEnddatumWaehlen');
    else if (!form.endTime) next.endDate = tr('newBooking.returnTimeRequired');
    const driverProblems = validateDriver(form.driver);
    if (Object.keys(next).length > 0 || Object.keys(driverProblems).length > 0) {
      setErrors(next);
      setDriverErrors(driverProblems);
      if (Object.keys(driverProblems).length > 0) setDriverOpen(true);
      setFormError(tr('newBooking.bitteAllePflichtfelderAusfuell'));
      return;
    }
    // The return must be after the pickup (a same-day booking is fine when the time is later).
    if (!datesValid) {
      setErrors({ endDate: tr('newBooking.returnAfterPickup') });
      setFormError(tr('newBooking.enddatumMussNachStartdatum'));
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const created = await api.createBooking({
        vehicleId: form.vehicleId,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        startDate: startIso,
        endDate: endIso,
        totalPrice: totalPriceToSend(),
        notes: form.notes.trim() || undefined,
        discountCode: form.discountCode.trim() || undefined,
        ...driverCreatePayload(form.driver),
      });
      onCreated({
        bookingId: created.id,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        vehicleLabel: vehicleName(selectedVehicle),
        discountText:
          created.discountAmount > 0
            ? tr('newBooking.discountApplied', { amount: fmtMoney(created.discountAmount, { currency: created.currency }) })
            : undefined,
      });
    } catch (err) {
      if (isDiscountInvalid(err)) {
        setErrors({ discountCode: bookingErrorText(err) });
        setFormError(tr('newBooking.discountRejected'));
      } else {
        const apiErrors = (err as { details?: Record<string, string[]> }).details;
        const mapped = driverErrorsFromApi(apiErrors);
        if (Object.keys(mapped).length > 0) {
          setDriverErrors(mapped);
          setDriverOpen(true);
        }
        setFormError(bookingErrorText(err, tr('newBooking.buchungKonnteNichtErstellt')));
      }
    } finally {
      setSaving(false);
    }
  }

  const vehicleLabel = vehicleName(selectedVehicle);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('common.neueBuchung')}
      description={t('newBooking.direktImSystemAnlegen')}
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="new-booking-form" loading={saving} disabled={refLoading && vehicles.length === 0}>
            {t('newBooking.buchungSpeichern')}
          </Button>
        </>
      }
    >
      <form id="new-booking-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert tone="err">
            {formError}
            {Object.keys(errors).length > 0 && t('newBooking.bitteKorrigierenSieDie')}
          </Alert>
        )}
        {refError && (
          <Alert
            tone="err"
            title={t('newBooking.fahrzeugeKonntenNichtGeladen')}
            action={
              <Button variant="outline" size="sm" onClick={() => void loadReference()}>
                {t('common.erneutVersuchen')}
              </Button>
            }
          >
            {t('newBooking.dieVerbindungZumServer')}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.name')} required error={errors.customerName}>
            <Input
              type="text"
              autoComplete="off"
              value={form.customerName}
              onChange={(e) => update('customerName', e.target.value)}
              placeholder={t('newBooking.maxMustermann')}
              data-autofocus
            />
          </Field>
          <Field label={t('common.eMail')} hint={t('newBooking.fuerDenVertragsversandPer')}>
            <Input
              type="email"
              autoComplete="off"
              value={form.customerEmail}
              onChange={(e) => update('customerEmail', e.target.value)}
              placeholder="kunde@beispiel.ch"
            />
          </Field>
        </div>

        <Field label={t('common.fahrzeug')} required error={errors.vehicleId}>
          {refLoading && vehicles.length === 0 ? (
            <Skeleton className="h-11 w-full max-md:h-12" rounded={10} />
          ) : (
            <Select value={form.vehicleId} onChange={(e) => update('vehicleId', e.target.value)}>
              <option value="">{t('newBooking.fahrzeugWaehlen')}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model}
                  {v.licensePlate ? ` (${formatPlate(v.licensePlate)})` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeRow
            label={t('newBooking.pickup')}
            dateLabel={t('newBooking.pickupDate')}
            timeLabel={t('newBooking.pickupTime')}
            date={form.startDate}
            time={form.startTime}
            error={errors.startDate}
            onDate={(v) => update('startDate', v)}
            onTime={(v) => update('startTime', v)}
          />
          <DateTimeRow
            label={t('newBooking.return')}
            dateLabel={t('newBooking.returnDate')}
            timeLabel={t('newBooking.returnTime')}
            date={form.endDate}
            time={form.endTime}
            min={form.startDate || undefined}
            error={errors.endDate}
            onDate={(v) => update('endDate', v)}
            onTime={(v) => update('endTime', v)}
          />
        </div>
        <p className="hint -mt-2">{t('newBooking.timesHint')}</p>

        {conflicts.bookings.length > 0 && (
          <Alert tone="warn">
            {t.rich('newBooking.overlapBookings', {
              vehicle: vehicleLabel,
              count: conflicts.bookings.length,
              list: conflicts.bookings
                .slice(0, 2)
                .map((b) => `${b.customerName}, ${rangeText(b.startDate, b.endDate)}`)
                .join('; '),
              b: (chunks) => <b>{chunks}</b>,
            })}
          </Alert>
        )}
        {conflicts.maintenance.length > 0 && (
          <Alert tone="warn">
            {t.rich('newBooking.overlapMaintenance', {
              vehicle: vehicleLabel,
              from: fmtDate(conflicts.maintenance[0].startDate),
              to: fmtDate(conflicts.maintenance[0].endDate),
              b: (chunks) => <b>{chunks}</b>,
            })}
          </Alert>
        )}
        {conflicts.inquiries.length > 0 && (
          <Alert tone="info">
            {t.rich('newBooking.overlapInquiries', {
              vehicle: vehicleLabel,
              count: conflicts.inquiries.length,
              list: conflicts.inquiries
                .slice(0, 2)
                .map((i) => `${i.fullName}, ${rangeText(i.desiredStartDate as string, i.desiredEndDate as string)}`)
                .join('; '),
              b: (chunks) => <b>{chunks}</b>,
            })}
          </Alert>
        )}

        <div className="fld">
          <span className="lbl">{t('newBooking.priceLabel', { currency: quote?.currency ?? currencyCode })}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              aria-label={t('newBooking.preisart')}
              className="sm:w-[200px] sm:flex-none"
              value={form.priceMode}
              onChange={(e) => setForm((c) => ({ ...c, priceMode: e.target.value as PriceMode, priceValue: '' }))}
            >
              <option value="total">{t('newBooking.gesamtpreis')}</option>
              <option value="perDay">{t('newBooking.proTag')}</option>
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              aria-label={t('newBooking.amountIn', { currency: quote?.currency ?? currencyCode })}
              aria-describedby="new-booking-price-hint"
              value={form.priceValue}
              onChange={(e) => update('priceValue', e.target.value)}
              placeholder={form.priceMode === 'total' ? t('newBooking.zB150000') : t('newBooking.zB15000')}
            />
          </div>
          <span id="new-booking-price-hint" className="hint">
            {hasEnteredPrice && derivedPrice && days > 0
              ? form.priceMode === 'total'
                ? t('newBooking.perDayAmount', { amount: fmtMoney(Number(derivedPrice), { currency: quote?.currency ?? currencyCode }) })
                : t('newBooking.totalAmount', { amount: fmtMoney(Number(derivedPrice), { currency: quote?.currency ?? currencyCode }) })
              : t('newBooking.leerLassenFuerAutomatische')}
          </span>
        </div>

        <div
          className="flex items-baseline justify-between gap-3 rounded-xl border-[1.5px] border-line px-4 py-3"
          aria-live="polite"
        >
          <span className="mut">{days > 0 && datesValid ? t('newBooking.richtpreis', { days }) : t('newBooking.richtpreis2')}</span>
          {quoteState === 'ready' && quote ? (
            <b className="num text-2xl">{fmtMoney(quote.totalPrice, { currency: quote.currency })}</b>
          ) : quoteState === 'loading' ? (
            <Skeleton className="h-7 w-28" />
          ) : quoteState === 'error' ? (
            <span className="sm mut">{t('newBooking.nichtVerfuegbar')}</span>
          ) : (
            <span className="sm mut">{t('newBooking.fahrzeugUndZeitraumWaehlen')}</span>
          )}
        </div>
        {quoteState === 'ready' && quote && quote.discountPercent > 0 && (
          <p className="hint -mt-2">{t('newBooking.gestaffeltRabattAufDie', { discountPercent: quote.discountPercent })}</p>
        )}

        <DiscountCodeField
          value={form.discountCode}
          onChange={(v) => update('discountCode', v)}
          email={form.customerEmail}
          vehicleId={form.vehicleId}
          days={datesValid ? days : undefined}
          currency={quote?.currency ?? currencyCode}
          basePrice={hasEnteredPrice ? totalPriceToSend() : quote?.totalPrice}
          onResult={setDiscountResult}
          error={errors.discountCode}
          label={t('discount.codeOptional')}
        />
        {form.discountCode.trim() && discountResult?.valid === false && <Alert tone="warn">{t('newBooking.invalidCodeWarning')}</Alert>}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setDriverOpen((open) => !open)}
            aria-expanded={driverOpen}
            aria-controls="new-booking-driver"
            className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border-[1.5px] border-line px-4 text-left font-semibold"
          >
            <span>
              {t('driver.sectionToggle')}
              {hasDriverData(form.driver) && <span className="sm mut ml-2 font-normal">{t('driver.filled')}</span>}
            </span>
            <ChevronDown size={18} aria-hidden="true" className={cn('transition-transform motion-reduce:transition-none', driverOpen && 'rotate-180')} />
          </button>
          <div id="new-booking-driver" hidden={!driverOpen}>
            <DriverFields value={form.driver} onChange={updateDriver} errors={driverErrors} />
          </div>
        </div>

        <Field label={t('newBooking.notizen')}>
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder={t('newBooking.optionaleNotizenZurBuchung')}
          />
        </Field>
      </form>
    </Modal>
  );
}
