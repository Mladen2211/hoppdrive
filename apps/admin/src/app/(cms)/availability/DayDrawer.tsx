'use client';

/**
 * Day details for the Kalender (replaces the old right-hand panel). Keeps every behaviour of it:
 * Wartung entries with delete, booking cards (status, vehicle, dates, price, e-mail, notes) with the
 * contract actions (PDF / Auf Gerät unterschreiben / Schnell unterschreiben) and "Buchung hinzufügen".
 * New: open inquiries of that day, and the item you clicked in the Gantt is highlighted.
 */
import { Banknote, CalendarDays, CarFront, CircleCheck, Download, FileText, Mail, PenTool, Plus, Tablet, Trash2, Wrench } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Button, Drawer, IconButton, StatusPill, cn } from '@/components/ui';
import { MAINTENANCE_REASON_LABELS, itemsOnDay, longDateLabel, type CalBooking, type CalItem } from '@/lib/calendar-model';
import { fmtDate, fmtMoney } from '@/lib/format';
import { fmtZurichPeriod } from '@/lib/zurich';
import { useTranslations } from 'next-intl';

export interface DayDrawerProps {
  dayKey: string | null;
  highlightKey: string | null;
  items: CalItem[];
  canCreate: boolean;
  canSign: boolean;
  canDownload: boolean;
  canDeleteMaintenance: boolean;
  busyId: string | null;
  onClose: () => void;
  onCreate: (dayKey: string) => void;
  onDeleteMaintenance: (item: Extract<CalItem, { kind: 'maintenance' }>) => void;
  onDownload: (booking: CalBooking) => void;
  onSignOnDevice: (booking: CalBooking) => void;
  onQuickSign: (booking: CalBooking) => void;
}

const CARD = 'rounded-14 border bg-card p-3.5';

function Line({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 text-[13px] text-graphite', className)}>
      <span className="mt-0.5 flex-none" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function DayDrawer(props: DayDrawerProps) {
  const t = useTranslations();
  const { dayKey, highlightKey, items, canCreate, canSign, canDownload, canDeleteMaintenance, busyId } = props;

  // Bring the clicked item into view (the Gantt passes its key).
  useEffect(() => {
    if (!dayKey || !highlightKey) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`cal-${highlightKey}`)?.scrollIntoView({ block: 'nearest' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [dayKey, highlightKey]);

  const open = dayKey !== null;
  const onDay = dayKey ? itemsOnDay(items, dayKey) : [];
  const maintenance = onDay.filter((i): i is Extract<CalItem, { kind: 'maintenance' }> => i.kind === 'maintenance');
  const bookings = onDay.filter((i): i is Extract<CalItem, { kind: 'booking' }> => i.kind === 'booking');
  const inquiries = onDay.filter((i): i is Extract<CalItem, { kind: 'inquiry' }> => i.kind === 'inquiry');

  const subtitle = [
    bookings.length ? `${bookings.length} ${t('availability.buchungN', { count: bookings.length })}` : null,
    maintenance.length ? t('availability.wartung', { length: maintenance.length }) : null,
    inquiries.length ? `${inquiries.length} ${t('availability.offeneAnfrageN', { count: inquiries.length })}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Drawer
      open={open}
      onClose={props.onClose}
      title={dayKey ? longDateLabel(dayKey) : ''}
      subtitle={subtitle || t('availability.keineTermine')}
      headerActions={
        canCreate && dayKey ? (
          <IconButton aria-label={t('availability.neueBuchungAnDiesem')} onClick={() => props.onCreate(dayKey)}>
            <Plus size={20} aria-hidden="true" />
          </IconButton>
        ) : undefined
      }
    >
      {maintenance.length > 0 && (
        <section aria-label={t('common.wartung')} className="flex flex-col gap-2.5">
          {maintenance.map((item) => {
            const m = item.maintenance;
            return (
              <article
                key={item.key}
                id={`cal-${item.key}`}
                className={cn(CARD, 'border-edge-warn-soft bg-warn-tint', highlightKey === item.key && 'ring-2 ring-ink')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-warn-ink">
                    <Wrench size={16} aria-hidden="true" />
                    {item.vehicleName}
                  </span>
                  {canDeleteMaintenance && (
                    <IconButton
                      aria-label={t('availability.wartungFuerEntfernen', { vehicleName: item.vehicleName })}
                      className="-mr-2 -mt-2 text-warn-ink"
                      disabled={busyId === m.id}
                      onClick={() => props.onDeleteMaintenance(item)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-1 text-[13px] text-warn-ink">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={14} aria-hidden="true" />
                    <span className="num">
                      {fmtDate(m.startDate)} – {fmtDate(m.endDate)}
                    </span>
                  </span>
                  <span>{MAINTENANCE_REASON_LABELS[m.reason] ?? m.reason}</span>
                  {m.notes && (
                    <span className="flex items-start gap-1.5">
                      <FileText size={14} className="mt-0.5 flex-none" aria-hidden="true" />
                      <span>{m.notes}</span>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {inquiries.length > 0 && (
        <section aria-label={t('availability.offeneAnfragen')} className="flex flex-col gap-2.5">
          {inquiries.map((item) => (
            <article
              key={item.key}
              id={`cal-${item.key}`}
              className={cn(CARD, 'border-dashed border-edge-warn', highlightKey === item.key && 'ring-2 ring-ink')}
            >
              <div className="flex items-start justify-between gap-2">
                <b className="font-semibold">{item.title}</b>
                <StatusPill kind="contact" status={item.inquiry.status} />
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                <Line icon={<CarFront size={14} />}>{item.vehicleName}</Line>
                <Line icon={<CalendarDays size={14} />}>
                  <span className="num">
                    {fmtDate(item.startKey)} – {fmtDate(item.endKey)}
                  </span>
                </Line>
              </div>
              <div className="mt-2.5 border-t border-line-soft pt-2.5">
                <Button variant="ghost" size="sm" href={`/inquiries?id=${item.inquiry.id}`}>
                  {t('availability.anfrageOeffnen')}
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CalendarDays size={40} className="text-cool" aria-hidden="true" />
          <p className="mut">{t('availability.keineBuchungen')}</p>
          {canCreate && dayKey && (
            <Button variant="ghost" iconLeft={<Plus size={18} aria-hidden="true" />} onClick={() => props.onCreate(dayKey)}>
              {t('availability.buchungHinzufuegen')}
            </Button>
          )}
        </div>
      ) : (
        <section aria-label={t('common.buchungen')} className="flex flex-col gap-2.5">
          {bookings.map((item) => {
            const b = item.booking;
            const signed = b.contractStatus === 'SIGNED';
            return (
              <article
                key={item.key}
                id={`cal-${item.key}`}
                className={cn(CARD, 'border-line', highlightKey === item.key && 'border-ink ring-2 ring-ink/25')}
              >
                <div className="flex items-start justify-between gap-2">
                  <b className="font-semibold">{b.customerName}</b>
                  <StatusPill kind="booking" status={b.status} />
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  <Line icon={<CarFront size={14} />}>{item.vehicleName}</Line>
                  <Line icon={<CalendarDays size={14} />}>
                    <span className="num">{fmtZurichPeriod(b)}</span>
                  </Line>
                  {b.totalPrice != null && b.totalPrice > 0 && (
                    <Line icon={<Banknote size={14} />} className="font-semibold text-ok">
                      <span className="num">{fmtMoney(b.totalPrice, { currency: b.currency || 'CHF' })}</span>
                    </Line>
                  )}
                  {b.customerEmail && <Line icon={<Mail size={14} />}>{b.customerEmail}</Line>}
                  {b.notes && <Line icon={<FileText size={14} />}>{b.notes}</Line>}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line-soft pt-2.5">
                  {signed ? (
                    <>
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                        <CircleCheck size={16} aria-hidden="true" />
                        {t('common.signiert')}
                      </span>
                      {canDownload && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          iconLeft={<Download size={16} aria-hidden="true" />}
                          loading={busyId === b.id}
                          onClick={() => props.onDownload(b)}
                          aria-label={t('availability.vertragVonAlsPDF', { customerName: b.customerName })}
                        >
                          PDF
                        </Button>
                      )}
                    </>
                  ) : canSign ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={<Tablet size={16} aria-hidden="true" />}
                        onClick={() => props.onSignOnDevice(b)}
                        title={t('availability.aufGeraetUnterschreibenKunde')}
                      >
                        {t('common.aufGeraetUnterschreiben')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={<PenTool size={16} aria-hidden="true" />}
                        onClick={() => props.onQuickSign(b)}
                        title={t('availability.schnellHierUnterschreiben')}
                      >
                        {t('common.schnellUnterschreiben')}
                      </Button>
                    </>
                  ) : (
                    <span className="sm mut">{t('availability.vertragAusstehend')}</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </Drawer>
  );
}
