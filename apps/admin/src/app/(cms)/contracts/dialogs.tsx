'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { CreateInvoiceRequest, FeeDto, VehicleDamageDto } from '@hoppdrive/shared';
import { Alert, Button, Checkbox, ChipGroup, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { InvoiceItemsEditor } from '@/components/invoices/InvoiceItemsEditor';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney, toInputDate } from '@/lib/format';
import {
  EMPTY_DEBTOR,
  INVOICE_KINDS,
  buildCustomRequest,
  computeTotals,
  debtorFromBooking,
  defaultVatFor,
  emptyLine,
  hasErrors,
  lineFromDamage,
  qrMissingList,
  validateEditor,
  type DebtorForm,
  type EditorErrors,
  type InvoiceKind,
  type InvoiceLine,
} from '@/lib/invoice-model';
import { formatPlate } from '@/lib/plate';
import { canInvoice, vehicleOf, type Booking, type Invoice } from './types';
import { useTranslations } from 'next-intl';

// ─── E-Mail hinzufügen / ändern ─────────────────────────────────

export function EmailModal({
  booking,
  saving,
  error,
  onClose,
  onSave,
}: {
  booking: Booking | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (email: string) => void;
}) {
  const t = useTranslations();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (booking) {
      setValue(booking.customerEmail ?? '');
      setTouched(false);
    }
  }, [booking]);

  const trimmed = value.trim();
  const invalid = touched && (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed));

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) return;
    onSave(trimmed);
  }

  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title={booking?.customerEmail ? t('contracts.eMailAendern') : t('common.eMailHinzufuegen')}
      description={booking ? t('contracts.fuerDerVertragWird', { customerName: booking.customerName }) : undefined}
      size="sm"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="email-form" loading={saving}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id="email-form" onSubmit={submit} noValidate className="flex flex-col gap-3">
        {error && <Alert tone="err">{error}</Alert>}
        <Field label={t('common.eMail')} required error={invalid ? t('contracts.bitteEineGueltigeE') : undefined}>
          <Input
            type="email"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="kunde@beispiel.ch"
            data-autofocus
          />
        </Field>
      </form>
    </Modal>
  );
}

// ─── Rechnung erstellen ─────────────────────────────────────────

/** Why creating an invoice failed; `qrMissing` lists the creditor settings a refused QR bill lacks. */
export interface InvoiceModalError {
  text: string;
  qrMissing?: string[];
}

const DEFAULT_SETTINGS = { vatRate: 8.1, dueDays: 30, defaultWithQrBill: false };

export function CreateInvoiceModal({
  open,
  booking,
  initialKind,
  autoAddDamages,
  bookings,
  creating,
  error,
  onClose,
  onCreate,
}: {
  open: boolean;
  /** Pre-selected booking (from a row / the drawer); without it the dialog asks for one. */
  booking: Booking | null;
  /** Invoice type the dialog opens with (default Miete). Deep link: ?newInvoice=damage|fine|other. */
  initialKind?: InvoiceKind;
  /** Damage invoices: start with the open damages that were found during this booking as lines. */
  autoAddDamages?: boolean;
  bookings: Booking[];
  creating: boolean;
  error: InvoiceModalError | null;
  onClose: () => void;
  onCreate: (request: CreateInvoiceRequest) => void;
}) {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const businessCurrency = useCurrency();

  const [kind, setKind] = useState<InvoiceKind>('RENTAL');
  const [bookingId, setBookingId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [debtor, setDebtor] = useState<DebtorForm>(EMPTY_DEBTOR);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [dueDays, setDueDays] = useState('');
  const [notes, setNotes] = useState('');
  const [withQr, setWithQr] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [errors, setErrors] = useState<EditorErrors & { booking?: string; period?: string }>({ lines: {} });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [fees, setFees] = useState<FeeDto[]>([]);
  const [damages, setDamages] = useState<VehicleDamageDto[] | null>(null);
  const qrTouched = useRef(false);
  const mailTouched = useRef(false);
  const autoDamagesPending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const isRental = kind === 'RENTAL';
  const candidates = useMemo(() => bookings.filter(canInvoice), [bookings]);
  const allBookings = useMemo(
    () => bookings.slice().sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [bookings],
  );
  const selected = bookings.find((b) => b.id === bookingId) ?? (booking && booking.id === bookingId ? booking : undefined);
  const currency = selected?.currency || businessCurrency;
  const defaultVat = settings.vatRate;
  const newLineVat = defaultVatFor(kind);
  const totals = useMemo(() => computeTotals(lines, defaultVat), [lines, defaultVat]);

  // A server error sits at the top of a long form: bring it into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const start0: InvoiceKind = initialKind ?? 'RENTAL';
    qrTouched.current = false;
    mailTouched.current = false;
    autoDamagesPending.current = Boolean(autoAddDamages) && start0 === 'DAMAGE' && Boolean(booking);
    setKind(start0);
    setBookingId(booking?.id ?? '');
    setStart(booking ? toInputDate(booking.startDate) : '');
    setEnd(booking ? toInputDate(booking.endDate) : '');
    setDebtor(debtorFromBooking(booking));
    setLines(start0 === 'RENTAL' ? [] : [emptyLine(defaultVatFor(start0))]);
    setDueDays('');
    setNotes('');
    setSendEmail(start0 === 'RENTAL' && Boolean(booking?.customerEmail?.trim()));
    setDamages(null);
    setErrors({ lines: {} });
  }, [open, booking, initialKind, autoAddDamages]);

  // Invoice settings (VAT rate, term, QR default) and the active fee catalog.
  useEffect(() => {
    if (!open || !token) return;
    let alive = true;
    api
      .getSetting('invoice_settings')
      .then((s) => {
        if (!alive) return;
        const vat = Number(s?.vatRate);
        const due = Number(s?.dueDays);
        const next = {
          vatRate: Number.isFinite(vat) && vat >= 0 ? vat : DEFAULT_SETTINGS.vatRate,
          dueDays: Number.isFinite(due) && due > 0 ? due : DEFAULT_SETTINGS.dueDays,
          defaultWithQrBill: s?.defaultWithQrBill === true,
        };
        setSettings(next);
        if (!qrTouched.current) setWithQr(next.defaultWithQrBill);
      })
      .catch(() => {
        if (alive && !qrTouched.current) setWithQr(false);
      });
    api
      .getFees({ activeOnly: true })
      .then((rows) => {
        if (alive) setFees(rows);
      })
      .catch(() => {
        if (alive) setFees([]);
      });
    return () => {
      alive = false;
    };
  }, [open, token]);

  // Damages of the booking's vehicle, offered as invoice lines.
  const vehicleId = selected?.vehicleId ?? '';
  useEffect(() => {
    if (!open || isRental || !vehicleId) {
      setDamages(null);
      return;
    }
    let alive = true;
    setDamages(null);
    api
      .getVehicleDamages(vehicleId)
      .then((rows) => {
        if (alive) setDamages(rows);
      })
      .catch(() => {
        if (alive) setDamages([]);
      });
    return () => {
      alive = false;
    };
  }, [open, isRental, vehicleId]);

  // Coming from the return inspection: the damages found during this rental become the first lines.
  useEffect(() => {
    if (!open || isRental || !damages || !autoDamagesPending.current) return;
    autoDamagesPending.current = false;
    const found = damages.filter((dmg) => dmg.status === 'OPEN' && dmg.discoveredBookingId === bookingId);
    if (found.length === 0) return;
    setLines((current) => [
      ...current.filter((l) => l.description.trim() || l.unitPrice.trim() || l.feeId || l.damageId),
      ...found.map((dmg) => lineFromDamage(dmg, defaultVatFor('DAMAGE'))),
    ]);
  }, [open, isRental, damages, bookingId]);

  const isPristine = (list: InvoiceLine[]) => list.every((l) => !l.description.trim() && !l.unitPrice.trim() && !l.feeId && !l.damageId);

  function changeKind(next: InvoiceKind) {
    setKind(next);
    setErrors({ lines: {} });
    if (next === 'RENTAL') {
      if (!mailTouched.current) setSendEmail(Boolean(selected?.customerEmail?.trim()));
      return;
    }
    const vat = defaultVatFor(next);
    setLines((current) =>
      current.length === 0 || isPristine(current)
        ? [emptyLine(vat)]
        : current.map((l) => (l.feeId || l.damageId || l.description.trim() || l.unitPrice.trim() ? l : { ...l, vat })),
    );
    if (!mailTouched.current) setSendEmail(false);
    if (selected && !debtor.name.trim()) setDebtor(debtorFromBooking(selected));
  }

  function pickRentalBooking(id: string) {
    setBookingId(id);
    const b = candidates.find((x) => x.id === id);
    // The period defaults to the booking dates.
    setStart(b ? toInputDate(b.startDate) : '');
    setEnd(b ? toInputDate(b.endDate) : '');
    if (!mailTouched.current) setSendEmail(Boolean(b?.customerEmail?.trim()));
    setErrors({ lines: {} });
  }

  function pickCustomBooking(id: string) {
    setBookingId(id);
    const b = bookings.find((x) => x.id === id);
    if (b) setDebtor(debtorFromBooking(b));
    setErrors({ lines: {} });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isRental) {
      const next: typeof errors = { lines: {} };
      if (!bookingId) next.booking = t('contracts.bitteEineBuchungWaehlen');
      if (!start || !end) next.period = t('contracts.bitteZeitraumAuswaehlen');
      else if (end <= start) next.period = t('contracts.dasEndeDesZeitraums');
      setErrors(next);
      if (next.booking || next.period) return;
      onCreate({
        type: 'RENTAL',
        bookingId,
        periodStart: start,
        periodEnd: end,
        withQrBill: withQr,
        sendEmail: sendEmail && Boolean(selected?.customerEmail?.trim()),
        ...(dueDays.trim() !== '' && Number.isInteger(Number(dueDays)) ? { dueDays: Number(dueDays) } : {}),
      });
      return;
    }
    const found = validateEditor({ debtor, lines, dueDays, sendEmail, totals });
    setErrors(found);
    if (hasErrors(found)) return;
    onCreate(
      buildCustomRequest({
        type: kind as Exclude<InvoiceKind, 'RENTAL'>,
        bookingId,
        debtor,
        lines,
        dueDays,
        notes,
        withQrBill: withQr,
        sendEmail,
      }),
    );
  }

  const setDebtorField = (patch: Partial<DebtorForm>) => setDebtor((d) => ({ ...d, ...patch }));
  const rentalEmail = selected?.customerEmail?.trim() || '';
  const emailAvailable = isRental ? Boolean(rentalEmail) : true;
  const kindOptions = INVOICE_KINDS.map((k) => ({ value: k, label: t(`invoiceEditor.kinds.${k}`) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('common.rechnungErstellen')}
      description={
        isRental
          ? selected
            ? `${selected.customerName}, ${vehicleOf(selected)}`
            : t('contracts.zeitraumDerRechnungFestlegen')
          : t(`invoiceEditor.kindHint.${kind}`)
      }
      size={isRental ? 'md' : 'lg'}
      dismissible={!creating}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="invoice-form" loading={creating}>
            {t('common.rechnungErstellen')}
          </Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div ref={errorRef}>
            <Alert
              tone="err"
              action={
                error.qrMissing ? (
                  <Button href="/settings#invoice-h" variant="outline" size="sm">
                    {t('invoiceEditor.openInvoiceSettings')}
                  </Button>
                ) : undefined
              }
            >
              {error.text}
              {error.qrMissing && error.qrMissing.length > 0 && (
                <>
                  {' '}
                  <b>{t('invoiceEditor.qrMissingList', { list: qrMissingList(error.qrMissing) })}</b>
                </>
              )}
            </Alert>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="lbl">{t('invoiceEditor.kindLabel')}</span>
          <ChipGroup aria-label={t('invoiceEditor.kindLabel')} options={kindOptions} value={kind} onChange={changeKind} />
        </div>

        {isRental ? (
          <>
            {!booking && (
              <Field label={t('contracts.buchung')} required error={errors.booking}>
                <Select value={bookingId} onChange={(e) => pickRentalBooking(e.target.value)}>
                  <option value="">{t('contracts.buchungWaehlen')}</option>
                  {candidates.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.customerName}, {vehicleOf(b)} ({fmtDate(b.startDate)} – {fmtDate(b.endDate)})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('common.von')} required error={errors.period}>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-autofocus={booking ? true : undefined} />
              </Field>
              <Field label={t('common.bis')} required>
                <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            {selected && selected.totalPrice != null && (
              <p className="hint">{t('contracts.buchungswertDieRechnungWird', { cHF: fmtMoney(selected.totalPrice, { currency }) })}</p>
            )}
          </>
        ) : (
          <>
            <Field label={t('invoiceEditor.bookingOptional')} hint={t('invoiceEditor.bookingHint')}>
              <Select value={bookingId} onChange={(e) => pickCustomBooking(e.target.value)}>
                <option value="">{t('invoiceEditor.noBooking')}</option>
                {allBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.customerName}, {vehicleOf(b)}
                    {b.vehicle?.licensePlate ? ` (${formatPlate(b.vehicle.licensePlate)})` : ''} · {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('invoiceEditor.debtorTitle')}</legend>
              <div className="grid grid-cols-6 gap-3 max-sm:grid-cols-2">
                <Field
                  label={t('invoiceEditor.debtorName')}
                  required
                  error={errors.debtorName ? t(errors.debtorName) : undefined}
                  className="col-span-3 max-sm:col-span-2"
                >
                  <Input value={debtor.name} onChange={(e) => setDebtorField({ name: e.target.value })} maxLength={200} autoComplete="off" />
                </Field>
                <Field label={t('common.eMail')} error={errors.debtorEmail ? t(errors.debtorEmail) : undefined} className="col-span-3 max-sm:col-span-2">
                  <Input type="email" inputMode="email" value={debtor.email} onChange={(e) => setDebtorField({ email: e.target.value })} maxLength={254} autoComplete="off" />
                </Field>
                <Field label={t('driver.street')} className="col-span-6 max-sm:col-span-2">
                  <Input value={debtor.street} onChange={(e) => setDebtorField({ street: e.target.value })} maxLength={120} autoComplete="off" />
                </Field>
                <Field label={t('driver.zip')} className="col-span-2 max-sm:col-span-1">
                  <Input value={debtor.zip} onChange={(e) => setDebtorField({ zip: e.target.value })} maxLength={20} autoComplete="off" className="num" />
                </Field>
                <Field label={t('driver.city')} className="col-span-2 max-sm:col-span-1">
                  <Input value={debtor.city} onChange={(e) => setDebtorField({ city: e.target.value })} maxLength={80} autoComplete="off" />
                </Field>
                <Field label={t('driver.country')} className="col-span-2 max-sm:col-span-2">
                  <Input value={debtor.country} onChange={(e) => setDebtorField({ country: e.target.value })} maxLength={60} autoComplete="off" placeholder="CH" />
                </Field>
              </div>
              <p className="sm mut">{t('invoiceEditor.debtorHint')}</p>
            </fieldset>

            <InvoiceItemsEditor
              lines={lines}
              onChange={setLines}
              totals={totals}
              currency={currency}
              defaultVat={defaultVat}
              newLineVat={newLineVat}
              errors={errors}
              fees={fees}
              damages={damages}
              bookingId={bookingId}
              disabled={creating}
            />

            <Field label={t('invoiceEditor.notes')} hint={t('invoiceEditor.notesHint')}>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </Field>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('invoiceEditor.dueDays')} hint={t('invoiceEditor.dueDaysHint', { days: settings.dueDays })} error={errors.dueDays ? t(errors.dueDays) : undefined}>
            <Input type="number" inputMode="numeric" min="0" max="365" step="1" value={dueDays} placeholder={String(settings.dueDays)} onChange={(e) => setDueDays(e.target.value)} className="num" />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <Checkbox
            checked={withQr}
            onChange={(e) => {
              qrTouched.current = true;
              setWithQr(e.target.checked);
            }}
            label={t('invoiceEditor.withQr')}
          />
          <p className="hint -mt-1 pl-[34px]">{t('invoiceEditor.withQrHint')}</p>
          <Checkbox
            checked={sendEmail && emailAvailable}
            disabled={!emailAvailable}
            onChange={(e) => {
              mailTouched.current = true;
              setSendEmail(e.target.checked);
            }}
            label={
              isRental
                ? rentalEmail
                  ? t('invoiceEditor.sendEmailTo', { email: rentalEmail })
                  : t('invoiceEditor.sendEmailNone')
                : debtor.email.trim()
                  ? t('invoiceEditor.sendEmailTo', { email: debtor.email.trim() })
                  : t('invoiceEditor.sendEmail')
            }
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── Mahnung senden ─────────────────────────────────────────────

function daysSince(date: string): number {
  const due = new Date(date);
  due.setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86_400_000) + 1);
}

export function DunningModal({
  invoice,
  sending,
  error,
  onClose,
  onSend,
}: {
  invoice: Invoice | null;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: (data: { penalty: number; notes: string; sendEmail: boolean }) => void;
}) {
  const tt = useTranslations();
  const t = useTranslations();
  const [penalty, setPenalty] = useState('');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [penaltyError, setPenaltyError] = useState<string | undefined>();

  const email = invoice?.customerEmail?.trim() || '';

  useEffect(() => {
    if (invoice) {
      setPenalty('');
      setNotes('');
      setSendEmail(Boolean(invoice.customerEmail?.trim()));
      setPenaltyError(undefined);
    }
  }, [invoice]);

  if (!invoice) {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }

  // The reissued invoice repeats the original amount without its own penalty, plus the new fee.
  const base = Math.round((invoice.total - invoice.penalty) * 100) / 100;
  const fee = Number(penalty) > 0 ? Number(penalty) : 0;
  const overdueDays = daysSince(invoice.dueDate);
  const isOverdue = new Date(invoice.dueDate).getTime() < Date.now();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (penalty !== '' && (!Number.isFinite(Number(penalty)) || Number(penalty) < 0)) {
      setPenaltyError(t('contracts.dieMahngebuehrDarfNicht'));
      return;
    }
    setPenaltyError(undefined);
    onSend({ penalty: fee, notes: notes.trim(), sendEmail: sendEmail && Boolean(email) });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('common.mahnungSenden')}
      description={t('contracts.rechnungAn', { invoiceNumber: invoice.invoiceNumber, value: invoice.customerName ?? invoice.booking?.customerName ?? t('contracts.denKunden') })}
      size="md"
      dismissible={!sending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="dunning-form" loading={sending}>
            {sendEmail && email ? tt('contracts.mahnungSenden') : tt('contracts.mahnungErstellen')}
          </Button>
        </>
      }
    >
      <form id="dunning-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        <Alert tone="warn" icon={<TriangleAlert size={20} />}>
          {isOverdue ? (
            <>{t('contracts.faelligSeit', { overdueDays })}</>
          ) : (
            <>{t('contracts.nochNichtUeberfaelligFaellig', { date: fmtDate(invoice.dueDate) })}</>
          )}
          {email ? (
            <>{t.rich('contracts.dunningGoesTo', { email, b: (chunks) => <b>{chunks}</b> })}</>
          ) : (
            <>{t('contracts.fuerDieseRechnungIst')}</>
          )}
        </Alert>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl border-[1.5px] border-line px-4 py-3.5">
          <dt className="mut">{t('contracts.mahnnummer')}</dt>
          <dd className="num text-right">{t('contracts.wirdBeimSendenVergeben')}</dd>
          <dt className="mut">{t('contracts.offenerBetrag')}</dt>
          <dd className="num text-right text-xl">
            <b>{fmtMoney(base, { currency: invoice.currency })}</b>
          </dd>
          {fee > 0 && (
            <>
              <dt className="mut">{t('contracts.mahngebuehr')}</dt>
              <dd className="num text-right">+ {fmtMoney(fee, { currency: invoice.currency })}</dd>
              <dt className="mut">{t('contracts.neuerGesamtbetrag')}</dt>
              <dd className="num text-right">
                <b>{fmtMoney(base + fee, { currency: invoice.currency })}</b>
              </dd>
            </>
          )}
          <dt className="mut">{t('contracts.neueZahlungsfrist')}</dt>
          <dd className="num text-right">{t('contracts.n14TageNachVersand')}</dd>
        </dl>

        <Field label={t('contracts.mahngebuehr2', { currency: invoice.currency })} hint={t('contracts.optionalWirdZumOffenen')} error={penaltyError}>
          <Input type="number" min="0" step="0.01" inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="0.00" data-autofocus />
        </Field>

        <Field label={t('contracts.notizAnDenKunden')} hint={t('contracts.dieNotizErscheintUnter')}>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('contracts.zB2Mahnung')} />
        </Field>

        <Checkbox
          checked={sendEmail && Boolean(email)}
          disabled={!email}
          onChange={(e) => setSendEmail(e.target.checked)}
          label={email ? t('contracts.mahnungPerEMail', { email }) : t('contracts.perEMailSenden')}
        />
      </form>
    </Modal>
  );
}
