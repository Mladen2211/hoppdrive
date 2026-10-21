'use client';

import { Ban, Check, ChevronDown, Mail, Phone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PricingTierDto } from '@hoppdrive/shared';
import type { DiscountValidationDto } from '@hoppdrive/shared';
import { Alert, Button, Drawer, Field, Select, Skeleton, StatusPill, Textarea, cn } from '@/components/ui';
import { DiscountCodeField } from '@/components/booking/DiscountCodeField';
import { LocaleBadge } from '@/components/LocaleBadge';
import { useCurrency } from '@/hooks/useCurrency';
import { discountAmount } from '@/lib/discount';
import { inquiryDays, matchVehicleByName } from '@/lib/inquiry';
import { buildTierBreakdown, fetchPriceQuote, type PriceQuote } from '@/lib/pricing';
import { fmtDate, fmtDateShort, fmtMoney, fmtRelative } from '@/lib/format';
import { CLOSED_STATUSES, type BookingRow, type Inquiry, type VehicleRow } from './types';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

export interface InquiryBusy {
  updating: boolean;
  converting: boolean;
  denying: boolean;
}

export interface InquiryDetailProps {
  inquiry: Inquiry | null;
  vehicles: VehicleRow[];
  bookings: BookingRow[];
  tiers: PricingTierDto[] | null;
  /** The role may change inquiries (inquiries: edit). */
  canEdit: boolean;
  assignedVehicleId: string;
  onAssignVehicle: (vehicleId: string) => void;
  /** Inline error of the last action (missing dates, vehicle not found, API error). */
  actionError: string | null;
  busy: InquiryBusy;
  onClose: () => void;
  onMarkReviewed: () => void;
  onMarkResponded: () => void;
  onApprove: () => void;
  /** Converts without the discount code (offered after the server rejected it). */
  onApproveWithoutCode?: () => void;
  /** The code that is applied on conversion: the visitor's (default), a replacement, or null (removed). */
  discountCode: string | null;
  /** The server refused the code on the last attempt (422 discount_invalid). */
  discountRejected?: boolean;
  /** '' removes the code. */
  onChangeDiscountCode: (code: string) => void;
  onDeny: (reason: string) => void;
}

/** Vehicles without an overlapping booking in the requested range (reserved/active bookings block). */
export function availableVehiclesFor(vehicles: VehicleRow[], bookings: BookingRow[], start?: string | null, end?: string | null): VehicleRow[] {
  const bookable = vehicles.filter((v) => v.isAvailable !== false); // the API refuses hidden vehicles
  if (!start || !end) return bookable;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return bookable.filter(
    (v) =>
      !bookings.some(
        (b) =>
          b.vehicleId === v.id &&
          (b.status === 'reserved' || b.status === 'active') &&
          new Date(b.startDate).getTime() < e &&
          new Date(b.endDate).getTime() > s,
      ),
  );
}

export function InquiryDetail({
  inquiry,
  vehicles,
  bookings,
  tiers,
  canEdit,
  assignedVehicleId,
  onAssignVehicle,
  actionError,
  busy,
  onClose,
  onMarkReviewed,
  onMarkResponded,
  onApprove,
  onApproveWithoutCode,
  discountCode,
  discountRejected = false,
  onChangeDiscountCode,
  onDeny,
}: InquiryDetailProps) {
  const t = useTranslations();
  const currency = useCurrency();
  const [discountResult, setDiscountResult] = useState<DiscountValidationDto | null>(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const id = inquiry?.id;
  // A different inquiry starts with a closed, empty deny form.
  useEffect(() => {
    setDenyOpen(false);
    setDenyReason('');
    setDiscountResult(null);
  }, [id]);

  const days = inquiry ? inquiryDays(inquiry) : 0;
  const closed = inquiry ? CLOSED_STATUSES.includes(inquiry.status) : true;
  const available = useMemo(
    () => (inquiry ? availableVehiclesFor(vehicles, bookings, inquiry.desiredStartDate, inquiry.desiredEndDate) : []),
    [inquiry, vehicles, bookings],
  );

  // The price is calculated for the assigned vehicle, else for the one named in the inquiry.
  const priceVehicle = useMemo(() => {
    if (!inquiry) return undefined;
    return vehicles.find((v) => v.id === assignedVehicleId) ?? matchVehicleByName(vehicles, inquiry.vehicleOfInterest);
  }, [inquiry, vehicles, assignedVehicleId]);
  const priceVehicleId = priceVehicle?.id;

  useEffect(() => {
    if (!priceVehicleId || days < 1) {
      setQuote(null);
      setQuoteState('idle');
      return;
    }
    const controller = new AbortController();
    setQuoteState('loading');
    fetchPriceQuote(priceVehicleId, days, controller.signal)
      .then((result) => {
        setQuote(result);
        setQuoteState('ready');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteState('error');
      });
    return () => controller.abort();
  }, [priceVehicleId, days, id]);

  if (!inquiry) {
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  }

  const breakdown =
    quote && quoteState === 'ready'
      ? tiers
        ? buildTierBreakdown(quote.baseDaily, days, tiers)
        : t('inquiries.durchschnittlichProTag', { days, cHF: fmtMoney(quote.effectiveDaily, { currency: quote.currency }) })
      : '';

  const hasDates = Boolean(inquiry.desiredStartDate && inquiry.desiredEndDate);
  const status = inquiry.status;
  const quoteCurrency = quote?.currency ?? currency;
  const reducedTotal =
    quoteState === 'ready' && quote && discountResult?.valid
      ? Math.max(0, quote.totalPrice - discountAmount(discountResult.type, discountResult.value, quote.totalPrice))
      : null;
  const canChangeCode = !closed && canEdit;

  const footer = !closed && canEdit && (
    <>
      <Button className="flex-1" loading={busy.converting} disabled={busy.updating || busy.denying} onClick={onApprove}>
        {t('inquiries.inBuchungUmwandeln')}
      </Button>
      {discountRejected && onApproveWithoutCode && (
        <Button variant="outline" loading={busy.converting} disabled={busy.updating || busy.denying} onClick={onApproveWithoutCode}>
          {t('inquiries.convertWithoutCode')}
        </Button>
      )}
      {status !== 'responded' && (
        <Button variant="outline" loading={busy.updating} disabled={busy.converting || busy.denying} onClick={onMarkResponded}>
          {t('inquiries.alsBeantwortetMarkieren')}
        </Button>
      )}
    </>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title={inquiry.fullName}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill kind="contact" status={status} />
          <span className="sm">{t('inquiries.eingang', { relative: fmtRelative(inquiry.createdAt) })}</span>
          <LocaleBadge locale={inquiry.locale} />
        </span>
      }
      footer={footer || undefined}
    >
      {!canEdit && !closed && (
        <Alert tone="info">{t('inquiries.mitIhrerRolleKoennen')}</Alert>
      )}
      {actionError && <Alert tone="err">{actionError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button href={`mailto:${inquiry.email}`} variant="ghost" size="sm" iconLeft={<Mail size={16} aria-hidden="true" />}>
          {inquiry.email}
        </Button>
        {inquiry.phone && (
          <Button href={`tel:${inquiry.phone.replace(/\s+/g, '')}`} variant="ghost" size="sm" iconLeft={<Phone size={16} aria-hidden="true" />}>
            {inquiry.phone}
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2.5 md:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="mut">{t('common.fahrzeug')}</dt>
        <dd>
          {inquiry.vehicleOfInterest ? <b className="font-semibold">{inquiry.vehicleOfInterest}</b> : <span className="mut">{t('inquiries.nochOffen')}</span>}
        </dd>
        <dt className="mut">{t('common.zeitraum')}</dt>
        <dd className="num text-base">
          {hasDates ? (
            <>
              {fmtDateShort(inquiry.desiredStartDate)} – {fmtDateShort(inquiry.desiredEndDate)}
              {days > 0 && ` (${days} ${t('inquiries.tagN', { count: days })})`}
            </>
          ) : (
            <span className="mut font-sans text-[15px]">{t('inquiries.keinZeitraumAngegeben')}</span>
          )}
        </dd>
      </dl>

      <div>
        <div className="lbl mb-1.5">{t('inquiries.nachricht')}</div>
        <p className="whitespace-pre-wrap rounded-xl bg-paper px-3.5 py-3">{inquiry.message}</p>
        <ul className="sm mut mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <li className="inline-flex items-center gap-1.5">
            {inquiry.privacyConsent ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {t('inquiries.consentPrivacy', { state: inquiry.privacyConsent ? 'yes' : 'no' })}
          </li>
          <li className="inline-flex items-center gap-1.5">
            {inquiry.marketingConsent ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {t('inquiries.consentMarketing', { state: inquiry.marketingConsent ? 'yes' : 'no' })}
          </li>
        </ul>
      </div>

      <section aria-label={t('inquiries.richtpreis')} className="rounded-14 border-[1.5px] border-line px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <b>{t('inquiries.richtpreis')}</b>
          {quoteState === 'ready' && quote ? (
            <b className={cn('num text-[26px] max-md:text-2xl', reducedTotal !== null && 'text-graphite line-through decoration-1')}>
              {fmtMoney(quote.totalPrice, { currency: quoteCurrency })}
            </b>
          ) : quoteState === 'loading' ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <span className="mut">–</span>
          )}
        </div>
        {reducedTotal !== null && (
          <div className="mt-1.5 flex items-baseline justify-between gap-3" aria-live="polite">
            <span className="font-semibold text-ok">{t('inquiries.afterDiscount')}</span>
            <b className="num text-[26px] text-ok max-md:text-2xl">{fmtMoney(reducedTotal, { currency: quoteCurrency })}</b>
          </div>
        )}
        <p className="sm mut mt-1.5">
          {quoteState === 'ready' && breakdown
            ? t('inquiries.gestaffeltNachMietdauerWie', { breakdown })
            : quoteState === 'error'
              ? t('inquiries.derRichtpreisKonnteNicht')
              : !hasDates
                ? t('inquiries.ohneZeitraumIstKein')
                : !priceVehicle
                  ? t('inquiries.weisenSieEinFahrzeug')
                  : ''}
        </p>
      </section>

      {(canChangeCode || discountCode) && (
        <section aria-label={t('discount.label')} className="flex flex-col gap-2">
          {canChangeCode ? (
            <DiscountCodeField
              value={discountCode ?? ''}
              onChange={onChangeDiscountCode}
              email={inquiry.email}
              vehicleId={priceVehicleId}
              days={days > 0 ? days : undefined}
              currency={quoteCurrency}
              basePrice={quoteState === 'ready' && quote ? quote.totalPrice : null}
              onResult={setDiscountResult}
              label={inquiry.discountCode ? t('inquiries.visitorCode') : t('discount.codeOptional')}
              action={
                discountCode ? (
                  <Button variant="ghost" size="sm" onClick={() => onChangeDiscountCode('')} iconLeft={<X size={16} aria-hidden="true" />}>
                    {t('inquiries.removeCode')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="rounded-14 border-[1.5px] border-line px-4 py-3">
              <div className="lbl mb-1">{t('discount.label')}</div>
              <span className="num rounded-md bg-ruby-tint px-1.5 py-px text-[13px] font-semibold text-ruby-fg">{discountCode}</span>
            </div>
          )}
          {canChangeCode && inquiry.discountCode && discountCode !== inquiry.discountCode && (
            <p className="sm mut">
              {discountCode ? t('inquiries.codeReplaced', { code: inquiry.discountCode }) : t('inquiries.codeRemoved', { code: inquiry.discountCode })}
            </p>
          )}
        </section>
      )}

      <div>
        <div className="lbl mb-2">{t('inquiries.verlauf')}</div>
        <ul className="flex flex-col gap-2">
          <li className="sm flex gap-2.5">
            <span className="mt-[5px] h-2.5 w-2.5 flex-none rounded-full bg-warn" aria-hidden="true" />
            {t('inquiries.timelineReceived', { relative: fmtRelative(inquiry.createdAt), date: fmtDate(inquiry.createdAt) })}
          </li>
          {status !== 'pending' && inquiry.updatedAt && (
            <li className="sm flex gap-2.5">
              <span className="mt-[5px] h-2.5 w-2.5 flex-none rounded-full bg-ink" aria-hidden="true" />
              <span>
                {t.rich('inquiries.timelineStatus', { status: statusText(status), relative: fmtRelative(inquiry.updatedAt), b: (chunks) => <b className="font-semibold">{chunks}</b> })}
              </span>
            </li>
          )}
          {['pending', 'reviewed'].includes(status) && (
            <li className="sm mut flex gap-2.5">
              <span className="mt-[5px] h-2.5 w-2.5 flex-none rounded-full border-2 border-line" aria-hidden="true" />
              {t('inquiries.nochKeineAntwortGesendet')}
            </li>
          )}
        </ul>
        {status === 'pending' && canEdit && (
          <Button variant="ghost" size="sm" className="mt-3" loading={busy.updating} onClick={onMarkReviewed} iconLeft={<Check size={16} aria-hidden="true" />}>
            {t('inquiries.alsGeprueftMarkieren')}
          </Button>
        )}
      </div>

      {!closed && canEdit && (
        <>
          <Field
            label={t('inquiries.fahrzeugZuweisen')}
            hint={hasDates ? t('inquiries.verfuegbarFuer', { date: fmtDate(inquiry.desiredStartDate), date2: fmtDate(inquiry.desiredEndDate) }) : undefined}
          >
            <Select value={assignedVehicleId} onChange={(e) => onAssignVehicle(e.target.value)}>
              <option value="">{inquiry.vehicleOfInterest ? t('inquiries.autoErkennung', { vehicleOfInterest: inquiry.vehicleOfInterest }) : t('inquiries.fahrzeugWaehlen')}</option>
              {available.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} {v.licensePlate ? `(${v.licensePlate})` : ''}
                </option>
              ))}
              {available.length === 0 && <option disabled>{t('inquiries.keineVerfuegbarenFahrzeuge')}</option>}
            </Select>
          </Field>

          <div className="rounded-14 border-[1.5px] border-line px-4 py-3">
            <button
              type="button"
              onClick={() => setDenyOpen((open) => !open)}
              aria-expanded={denyOpen}
              aria-controls="deny-panel"
              className={cn(
                'flex min-h-[44px] w-full items-center justify-between gap-2 text-left font-semibold',
                !denyOpen && 'text-err-strong',
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Ban size={18} aria-hidden="true" />
                {t('inquiries.ablehnenMitBegruendung')}
              </span>
              <ChevronDown size={18} aria-hidden="true" className={cn('transition-transform motion-reduce:transition-none', denyOpen && 'rotate-180')} />
            </button>
            {denyOpen && (
              <div id="deny-panel" className="mt-2.5 flex flex-col gap-3">
                <Field label={t('inquiries.grundWirdInDer')} hint={t('inquiries.optionalDerKundeWird')}>
                  <Textarea rows={3} value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder={t('inquiries.zBImGewuenschten')} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" size="sm" loading={busy.denying} disabled={busy.converting || busy.updating} onClick={() => onDeny(denyReason.trim())}>
                    {t('inquiries.anfrageAblehnen')}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy.denying} onClick={() => setDenyOpen(false)}>
                    {t('common.abbrechen')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

const STATUS_TEXT: Record<string, string> = {
  get pending() { return tr('common.neu'); },
  get reviewed() { return tr('inquiries.geprueft'); },
  get responded() { return tr('inquiries.beantwortet'); },
  get converted() { return tr('inquiries.buchungErstellt'); },
  get denied() { return tr('inquiries.abgelehnt'); },
  get archived() { return tr('inquiries.archiviert'); },
};

export function statusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}
