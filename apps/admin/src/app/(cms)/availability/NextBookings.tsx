'use client';

/** "Nächste Buchungen": the next bookings, shown when no day is open (below the calendar). */
import { CalendarDays } from 'lucide-react';
import { Button, Panel, PanelHeader, StatusPill } from '@/components/ui';
import { dayKeyOf, vehicleLabel, type CalBooking, type CalVehicle } from '@/lib/calendar-model';
import { fmtDate } from '@/lib/format';
import { useTranslations } from 'next-intl';

export interface NextBookingsProps {
  bookings: CalBooking[];
  vehicles: CalVehicle[];
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (booking: CalBooking) => void;
}

export function NextBookings({ bookings, vehicles, canCreate, onCreate, onOpen }: NextBookingsProps) {
  const t = useTranslations();
  return (
    <Panel aria-labelledby="next-heading">
      <PanelHeader title={<span id="next-heading">{t('availability.naechsteBuchungen')}</span>} />
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <CalendarDays size={40} className="text-cool" aria-hidden="true" />
          <p className="mut">{t('availability.nochKeineBuchungen')}</p>
          {canCreate && (
            <Button variant="ghost" onClick={onCreate}>
              {t('availability.ersteBuchungErstellen')}
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {bookings.map((booking) => {
            const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
            const name = vehicle ? vehicleLabel(vehicle) : booking.vehicle ? vehicleLabel(booking.vehicle) : '–';
            return (
              <li key={booking.id}>
                <button
                  type="button"
                  onClick={() => onOpen(booking)}
                  aria-label={t('availability.bisDetailsOeffnen', { customerName: booking.customerName, name, date: fmtDate(booking.startDate), date2: fmtDate(booking.endDate) })}
                  className="m-card h-full min-h-[48px] w-full gap-1.5 text-left hover:border-ink"
                >
                  <span className="flex items-start justify-between gap-2">
                    <b className="min-w-0 break-words font-semibold">{booking.customerName}</b>
                    <StatusPill kind="booking" status={booking.status} />
                  </span>
                  <span className="sm mut">{name}</span>
                  <span className="num sm">
                    {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** The day a booking should open on: its start, or today when it has already begun. */
export function bookingOpenDay(booking: CalBooking, todayKey: string): string {
  const start = dayKeyOf(booking.startDate);
  return start < todayKey ? todayKey : start;
}
