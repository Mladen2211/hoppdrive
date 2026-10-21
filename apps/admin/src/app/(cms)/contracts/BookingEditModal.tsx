'use client';

/**
 * "Buchung bearbeiten": pickup / return date and time (reserved and active bookings only), the
 * Fahrerdaten and the price recalculation, saved with PATCH /bookings/:id.
 *
 * Times are entered in Swiss time. Legacy whole-day bookings (stored at 00:00) start with the default
 * times 09:00 / 18:00 but their dates are only sent once the admin touches one of the four inputs.
 * Overlap and closed-booking errors (409 booking_overlap | maintenance_overlap | booking_closed) are shown
 * in plain words.
 */
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import type { BookingDetailDto, UpdateBookingRequest } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Checkbox, Input, Modal } from '@/components/ui';
import { DriverFields } from '@/components/booking/DriverFields';
import { api } from '@/lib/api';
import { bookingErrorText } from '@/lib/booking-errors';
import {
  driverEquals,
  driverErrorsFromApi,
  driverFromBooking,
  driverUpdatePayload,
  validateDriver,
  type DriverErrors,
  type DriverForm,
} from '@/lib/driver';
import { fmtMoney } from '@/lib/format';
import { daysForRange } from '@/lib/pricing';
import { DEFAULT_PICKUP_TIME, DEFAULT_RETURN_TIME, zurichParts, zurichToIso } from '@/lib/zurich';
import { tr } from '@/i18n/active';
import type { Booking } from './types';

export interface BookingEditModalProps {
  booking: Booking | null;
  onClose: () => void;
  /** The booking as the server saved it. */
  onSaved: (updated: BookingDetailDto) => void;
}

export function BookingEditModal({ booking, onClose, onSaved }: BookingEditModalProps) {
  if (!booking) return null;
  return <EditForm key={booking.id} booking={booking} onClose={onClose} onSaved={onSaved} />;
}

interface TimesForm {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

function EditForm({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (updated: BookingDetailDto) => void }) {
  const t = useTranslations();
  const formId = useId();
  const movable = booking.status === 'reserved' || booking.status === 'active';

  const initialTimes = useMemo<TimesForm>(() => {
    const start = zurichParts(booking.startDate);
    const end = zurichParts(booking.endDate);
    return {
      startDate: start?.date ?? '',
      startTime: booking.hasTimes ? start?.time ?? DEFAULT_PICKUP_TIME : DEFAULT_PICKUP_TIME,
      endDate: end?.date ?? '',
      endTime: booking.hasTimes ? end?.time ?? DEFAULT_RETURN_TIME : DEFAULT_RETURN_TIME,
    };
  }, [booking]);
  const initialDriver = useMemo(() => driverFromBooking(booking), [booking]);

  const [times, setTimes] = useState<TimesForm>(initialTimes);
  const [touched, setTouched] = useState(false);
  const [driver, setDriver] = useState<DriverForm>(initialDriver);
  const [driverErrors, setDriverErrors] = useState<DriverErrors>({});
  const [recalc, setRecalc] = useState(false);
  const [recalcTouched, setRecalcTouched] = useState(false);
  const [error, setError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [saving, setSaving] = useState(false);

  const startIso = times.startDate && times.startTime ? zurichToIso(times.startDate, times.startTime) : '';
  const endIso = times.endDate && times.endTime ? zurichToIso(times.endDate, times.endTime) : '';
  const periodChanged = movable && touched && Boolean(startIso && endIso) && (startIso !== new Date(booking.startDate).toISOString() || endIso !== new Date(booking.endDate).toISOString());
  const oldDays = daysForRange(booking.startDate, booking.endDate);
  const newDays = daysForRange(startIso, endIso);
  const daysChanged = periodChanged && newDays > 0 && newDays !== oldDays;

  // The price is recalculated by default when the rental length changes (an admin can opt out).
  useEffect(() => {
    if (!recalcTouched) setRecalc(daysChanged);
  }, [daysChanged, recalcTouched]);

  const driverChanged = !driverEquals(driver, initialDriver);
  const dirty = periodChanged || driverChanged;
  const currency = booking.currency || 'CHF';

  function updateTimes(patch: Partial<TimesForm>) {
    setTimes((current) => ({ ...current, ...patch }));
    setTouched(true);
    setTimeError('');
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problems = validateDriver(driver);
    setDriverErrors(problems);
    if (Object.keys(problems).length > 0) {
      setError(tr('bookingEdit.checkFields'));
      return;
    }
    if (movable && touched) {
      if (!startIso || !endIso) {
        setTimeError(tr('bookingEdit.timesRequired'));
        return;
      }
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        setTimeError(tr('newBooking.returnAfterPickup'));
        return;
      }
    }

    const payload: UpdateBookingRequest = {};
    if (driverChanged) Object.assign(payload, driverUpdatePayload(driver));
    if (periodChanged) {
      payload.startDate = startIso;
      payload.endDate = endIso;
      if (recalc) payload.recalculatePrice = true;
    }
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await api.updateBooking(booking.id, payload);
      onSaved(updated);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const mapped = driverErrorsFromApi((err as { details?: Record<string, string[]> }).details);
      if (Object.keys(mapped).length > 0) setDriverErrors(mapped);
      const text = bookingErrorText(err, tr('bookingEdit.saveFailed'));
      if (code === 'booking_overlap' || code === 'maintenance_overlap' || code === 'booking_closed' || code === 'invalid_period') setTimeError(text);
      else setError(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={t('bookingEdit.title')}
      description={`${booking.customerName}${booking.vehicle ? ` · ${booking.vehicle.brand} ${booking.vehicle.model}` : ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={!dirty}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4" disabled={!movable || saving}>
          <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('bookingEdit.timesTitle')}</legend>
          {!movable && <Alert tone="info">{t('bookingEdit.closedNote')}</Alert>}
          {movable && !booking.hasTimes && <Alert tone="info">{t('bookingEdit.legacyNote')}</Alert>}
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div className="fld" role="group" aria-label={t('newBooking.pickup')}>
              <span className="lbl">{t('newBooking.pickup')}</span>
              <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
                <Input type="date" aria-label={t('newBooking.pickupDate')} value={times.startDate} onChange={(e) => updateTimes({ startDate: e.target.value })} />
                <Input type="time" aria-label={t('newBooking.pickupTime')} value={times.startTime} step={300} onChange={(e) => updateTimes({ startTime: e.target.value })} className="num" />
              </div>
            </div>
            <div className="fld" role="group" aria-label={t('newBooking.return')}>
              <span className="lbl">{t('newBooking.return')}</span>
              <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
                <Input type="date" aria-label={t('newBooking.returnDate')} value={times.endDate} min={times.startDate || undefined} onChange={(e) => updateTimes({ endDate: e.target.value })} />
                <Input type="time" aria-label={t('newBooking.returnTime')} value={times.endTime} step={300} onChange={(e) => updateTimes({ endTime: e.target.value })} className="num" />
              </div>
            </div>
          </div>
          {timeError && (
            <Alert tone="err" icon={false}>
              {timeError}
            </Alert>
          )}
          {periodChanged && (
            <Checkbox
              checked={recalc}
              onChange={(e) => {
                setRecalc(e.target.checked);
                setRecalcTouched(true);
              }}
              label={t('bookingEdit.recalculate')}
            />
          )}
          {periodChanged && (
            <p className="hint -mt-1">
              {daysChanged ? t('bookingEdit.daysChanged', { from: oldDays, to: newDays }) : t('bookingEdit.daysSame', { days: oldDays })}
              {' · '}
              {t('bookingEdit.currentPrice', { price: fmtMoney(booking.totalPrice ?? 0, { currency }) })}
            </p>
          )}
          {booking.discountCode && (
            <p className="sm mut">
              {t('bookingEdit.discountInfo', {
                code: booking.discountCode.code,
                amount: fmtMoney(booking.discountAmount ?? 0, { currency }),
              })}
            </p>
          )}
        </fieldset>

        <DriverFields value={driver} onChange={(patch) => setDriver((d) => ({ ...d, ...patch }))} errors={driverErrors} disabled={saving} />
      </form>
    </Modal>
  );
}

