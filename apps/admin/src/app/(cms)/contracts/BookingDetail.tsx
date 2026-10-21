'use client';

import { Ban, CalendarClock, CarFront, Download, IdCard, Mail, MapPin, Pencil, PenTool, Phone, Plus, Receipt, RefreshCw, Tablet, Tag, User } from 'lucide-react';
import { Button, Drawer, IconButton, ProgressSteps, Skeleton, StatusPill, Alert, cn } from '@/components/ui';
import { bookingProgress, contractNumber } from '@/lib/booking';
import { driverAddressLine } from '@/lib/driver';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/format';
import { formatPlate } from '@/lib/plate';
import { fmtZurichPeriod } from '@/lib/zurich';
import { ContractPackageActions } from './ContractPackageActions';
import { InspectionSection } from './InspectionSection';
import { canInvoice, invoiceState, vehicleOf, type Booking, type ContractActions, type Invoice } from './types';
import { useTranslations } from 'next-intl';

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)} aria-label={title}>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{title}</h3>
      {children}
    </section>
  );
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-none text-graphite" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function BookingDetail({
  booking,
  invoices,
  invoicesLoading,
  actions,
  onClose,
}: {
  booking: Booking | null;
  invoices: Invoice[];
  invoicesLoading: boolean;
  actions: ContractActions;
  onClose: () => void;
}) {
  const t = useTranslations();
  if (!booking) {
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  }

  const { canEdit, busyId } = actions;
  const signed = booking.contractStatus === 'SIGNED';
  const cancelled = booking.status === 'cancelled';
  const progress = bookingProgress(booking, invoices);
  const busy = busyId === booking.id;
  const driverLine = driverAddressLine(booking);
  const hasDriverInfo = Boolean(driverLine || booking.driverBirthDate || booking.driverLicenseNumber || booking.driverLicenseCountry);

  return (
    <Drawer
      open
      onClose={onClose}
      title={booking.customerName}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill kind="booking" status={booking.status} />
          <StatusPill kind="contract" status={booking.contractStatus || 'PENDING'} />
          <span className="sm font-mono">{t('contracts.nr', { contractNumber: contractNumber(booking.id) })}</span>
        </span>
      }
    >
      {!canEdit && <Alert tone="info">{t('contracts.mitIhrerRolleKoennen')}</Alert>}

      <ProgressSteps steps={progress.steps} aria-label={t('contracts.fortschrittDerBuchung')} />

      <Section title={t('contracts.kundendaten')}>
        <Line icon={<User size={18} />}>{booking.customerName}</Line>
        {booking.customerPhone && (
          <Line icon={<Phone size={18} />}>
            <a href={`tel:${booking.customerPhone.replace(/\s+/g, '')}`} className="num font-semibold text-ruby-dark underline">
              {booking.customerPhone}
            </a>
          </Line>
        )}
        <Line icon={<Mail size={18} />}>
          {booking.customerEmail ? (
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="break-all">{booking.customerEmail}</span>
              {canEdit && (
                <button type="button" onClick={() => actions.editEmail(booking)} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-ruby-dark underline">
                  <Pencil size={14} aria-hidden="true" />
                  {t('contracts.aendern')}
                </button>
              )}
            </span>
          ) : canEdit ? (
            <button type="button" onClick={() => actions.editEmail(booking)} className="inline-flex min-h-[36px] items-center gap-1 font-semibold text-ruby-dark underline">
              <Plus size={14} aria-hidden="true" />
              {t('common.eMailHinzufuegen')}
            </button>
          ) : (
            <span className="mut">{t('contracts.keineEMailHinterlegt')}</span>
          )}
        </Line>
      </Section>

      <Section title={t('contracts.buchung')}>
        <Line icon={<CarFront size={18} />}>
          {vehicleOf(booking)}
          {booking.vehicle?.licensePlate && (
            <span className="num ml-2 rounded-md border border-line px-1.5 py-px text-[12px] font-semibold">{formatPlate(booking.vehicle.licensePlate)}</span>
          )}
        </Line>
        <Line icon={<CalendarClock size={18} />}>
          <span className="num">{fmtZurichPeriod(booking)}</span>
          {booking.hasTimes === false && <span className="sm mut ml-2">{t('bookingEdit.wholeDays')}</span>}
          {canEdit && (booking.status === 'reserved' || booking.status === 'active') && (
            <button type="button" onClick={() => actions.editBooking(booking)} className="ml-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-ruby-dark underline">
              <Pencil size={14} aria-hidden="true" />
              {t('bookingEdit.changeTimes')}
            </button>
          )}
        </Line>
        {booking.totalPrice != null && booking.totalPrice > 0 && (
          <Line icon={<Receipt size={18} />}>
            <b className="num text-base">{fmtMoney(booking.totalPrice, { currency: booking.currency || 'CHF' })}</b>
          </Line>
        )}
        {booking.discountCode && (
          <Line icon={<Tag size={18} />}>
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="num rounded-md bg-ruby-tint px-1.5 py-px text-[13px] font-semibold text-ruby-fg">{booking.discountCode.code}</span>
              <span className="sm">
                {t('bookingEdit.discountUsed', { amount: fmtMoney(booking.discountAmount ?? 0, { currency: booking.currency || 'CHF' }) })}
              </span>
            </span>
          </Line>
        )}
        {booking.notes && (
          <p className="whitespace-pre-wrap rounded-xl bg-paper px-3.5 py-3 text-sm">{booking.notes}</p>
        )}
        {canEdit && (booking.status === 'reserved' || booking.status === 'active') && (
          <div className="flex flex-wrap gap-2 pt-1">
            {booking.status === 'reserved' && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.transition(booking, 'active')}>
                {t('contracts.alsAbgeholtMarkieren')}
              </Button>
            )}
            {booking.status === 'active' && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.transition(booking, 'completed')}>
                {t('contracts.alsZurueckgegebenMarkieren')}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-err" disabled={busy} onClick={() => actions.transition(booking, 'cancelled')} iconLeft={<Ban size={16} aria-hidden="true" />}>
              {t('contracts.stornieren')}
            </Button>
          </div>
        )}
      </Section>

      <Section title={t('driver.title')}>
        {hasDriverInfo ? (
          <>
            {driverLine && (
              <Line icon={<MapPin size={18} />}>
                <span className="break-words">{driverLine}</span>
              </Line>
            )}
            {booking.driverBirthDate && (
              <Line icon={<User size={18} />}>
                <span className="sm mut">{t('driver.birthDate')}: </span>
                <span className="num">{fmtDate(booking.driverBirthDate)}</span>
              </Line>
            )}
            {(booking.driverLicenseNumber || booking.driverLicenseCountry) && (
              <Line icon={<IdCard size={18} />}>
                <span className="sm mut">{t('driver.licenseNumber')}: </span>
                <span className="num">{booking.driverLicenseNumber || '–'}</span>
                {booking.driverLicenseCountry && <span className="sm mut"> ({booking.driverLicenseCountry})</span>}
              </Line>
            )}
          </>
        ) : (
          <p className="mut">{t('driver.none')}</p>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => actions.editBooking(booking)} iconLeft={<Pencil size={16} aria-hidden="true" />}>
            {hasDriverInfo ? t('driver.edit') : t('driver.add')}
          </Button>
        )}
      </Section>

      <Section title={t('common.vertrag')}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill kind="contract" status={booking.contractStatus || 'PENDING'} />
          {booking.signedAt && <span className="sm mut">{t('contracts.signiertAm', { dateTime: fmtDateTime(booking.signedAt) })}</span>}
        </div>
        <p className="sm mut font-mono">{t('contracts.nr', { contractNumber: contractNumber(booking.id) })}</p>
        <div className="flex flex-wrap gap-2">
          {!signed && !cancelled && canEdit && (
            <>
              <Button onClick={() => actions.signOnDevice(booking)} iconLeft={<Tablet size={18} aria-hidden="true" />} size="sm">
                {t('common.aufGeraetUnterschreiben')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => actions.quickSign(booking)} iconLeft={<PenTool size={18} aria-hidden="true" />}>
                {t('common.schnellUnterschreiben')}
              </Button>
            </>
          )}
          {signed && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.downloadContract(booking)} iconLeft={<Download size={18} aria-hidden="true" />}>
              {t('contracts.vertragPDF')}
            </Button>
          )}
        </div>
        <ContractPackageActions booking={booking} canEdit={canEdit} />
      </Section>

      <InspectionSection booking={booking} />

      {canInvoice(booking) && (
        <Section title={t('common.rechnungen')}>
          {canEdit && (
            <Button variant="outline" size="sm" className="self-start" onClick={() => actions.createInvoice(booking)} iconLeft={<Plus size={16} aria-hidden="true" />}>
              {t('common.rechnungErstellen')}
            </Button>
          )}
          {invoicesLoading ? (
            <Skeleton className="h-16" rounded={12} />
          ) : invoices.length === 0 ? (
            <p className="mut">{t('contracts.keineRechnungenVorhanden')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invoices.map((inv) => {
                const state = invoiceState(inv);
                const rowBusy = busyId === inv.id;
                return (
                  <li key={inv.id} className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="num">{inv.invoiceNumber}</b>
                          {inv.parentInvoiceId && <span className="st s-amber st-plain !h-[22px] !text-xs">{t('common.mahnung')}</span>}
                        </div>
                        <p className="sm mut">
                          {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
                          {inv.penalty > 0 && t('contracts.inklMahngebuehr', { cHF: fmtMoney(inv.penalty, { currency: inv.currency }) })}
                        </p>
                        <p className="sm mut">{t('contracts.ausgestelltFaellig', { date: fmtDate(inv.issueDate), date2: fmtDate(inv.dueDate) })}</p>
                      </div>
                      <div className="flex flex-none flex-col items-end gap-1.5">
                        <b className="num text-base">{fmtMoney(inv.total, { currency: inv.currency })}</b>
                        <StatusPill kind="invoice" status={state} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit && (
                        <Button variant="ghost" size="sm" disabled={rowBusy} onClick={() => actions.toggleInvoice(inv)}>
                          {state === 'PAID' ? t('contracts.alsOffenMarkieren') : t('contracts.alsBezahltMarkieren')}
                        </Button>
                      )}
                      {canEdit && state !== 'PAID' && (
                        <Button variant="ghost" size="sm" disabled={rowBusy} onClick={() => actions.dunning(inv)} iconLeft={<RefreshCw size={16} aria-hidden="true" />}>
                          {t('common.mahnungSenden')}
                        </Button>
                      )}
                      <IconButton aria-label={t('contracts.rechnungHerunterladen', { invoiceNumber: inv.invoiceNumber })} disabled={rowBusy} onClick={() => actions.downloadInvoice(inv)} className="ml-auto">
                        <Download size={20} aria-hidden="true" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
    </Drawer>
  );
}
