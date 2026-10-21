'use client';

/**
 * "Fahrzeugkontrolle" section of the booking drawer: the inspections already recorded for the booking
 * (Abholung / Rückgabe with time, mileage, fuel, report PDF) and the buttons that start a new one.
 * Visible for roles with the damages permission; recording needs "edit".
 */
import type { BookingInspectionDto, InspectionType } from '@hoppdrive/shared';
import { ClipboardCheck, Download, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, IconButton, Skeleton, StatusPill, useToast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtNumber } from '@/lib/format';
import { openPdfInTab } from '@/lib/inspection-pdf';
import { fmtZurichDateTime } from '@/lib/zurich';
import { InspectionModal } from './InspectionModal';
import type { Booking } from './types';

const reportName = (inspection: BookingInspectionDto) =>
  `HoppDrive-Fahrzeugkontrolle-${inspection.type === 'PICKUP' ? 'Uebergabe' : 'Rueckgabe'}-${inspection.bookingId.slice(0, 8).toUpperCase()}.pdf`;

export function InspectionSection({ booking }: { booking: Booking }) {
  const t = useTranslations();
  const { toast } = useToast();
  const level = usePermission('damages');
  const [inspections, setInspections] = useState<BookingInspectionDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recording, setRecording] = useState<InspectionType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const bookingId = booking.id;
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setInspections(await api.getBookingInspections(bookingId));
    } catch (err) {
      setLoadError(errorText(err, t('inspection.errors.loadFailed')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (level === 'none') return;
    setInspections(null);
    void load();
  }, [level, load]);

  if (level === 'none') return null;

  const canRecord = level === 'edit' && booking.status !== 'cancelled';
  const pickupDone = inspections?.some((i) => i.type === 'PICKUP') ?? false;

  const view = async (inspection: BookingInspectionDto) => {
    setBusyId(inspection.id);
    try {
      await openPdfInTab(() => api.downloadInspectionReport(inspection.id), reportName(inspection));
    } catch (err) {
      toast.error(t('inspection.errors.reportFailed'), errorText(err));
    } finally {
      setBusyId(null);
    }
  };
  const download = async (inspection: BookingInspectionDto) => {
    setBusyId(inspection.id);
    try {
      triggerBlobDownload(await api.downloadInspectionReport(inspection.id), reportName(inspection));
    } catch (err) {
      toast.error(t('inspection.errors.reportFailed'), errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex flex-col gap-2.5" aria-label={t('inspection.sectionTitle')}>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('inspection.sectionTitle')}</h3>

      {loadError ? (
        <Alert
          tone="err"
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : inspections === null ? (
        <Skeleton className="h-16" rounded={12} />
      ) : inspections.length === 0 ? (
        <p className="mut">{t('inspection.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {inspections.map((inspection) => (
            <li key={inspection.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={inspection.type === 'PICKUP' ? 'blue' : 'vio'} label={t(`inspection.type.${inspection.type}`)} />
                    <span className="num sm">{fmtZurichDateTime(inspection.at)}</span>
                  </div>
                  <p className="sm mut mt-1">
                    {t('inspection.facts', {
                      mileage: inspection.mileage !== null ? `${fmtNumber(inspection.mileage)} km` : '–',
                      fuel: inspection.fuelLevel !== null ? `${inspection.fuelLevel} %` : '–',
                      damages: inspection.damageIds.length,
                    })}
                    {inspection.type === 'RETURN' && inspection.newDamageIds.length > 0 && (
                      <b className="text-ruby-fg"> · {t('inspection.newDamages', { count: inspection.newDamageIds.length })}</b>
                    )}
                  </p>
                </div>
                {inspection.hasReport && (
                  <div className="flex flex-none items-center">
                    <IconButton aria-label={t('inspection.viewReport')} disabled={busyId === inspection.id} onClick={() => void view(inspection)}>
                      <Eye size={20} aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label={t('inspection.downloadReport')} disabled={busyId === inspection.id} onClick={() => void download(inspection)}>
                      <Download size={20} aria-hidden="true" />
                    </IconButton>
                  </div>
                )}
              </div>
              {inspection.notes && <p className="sm whitespace-pre-wrap break-words rounded-lg bg-paper px-3 py-2">{inspection.notes}</p>}
              {inspection.createdByName && <p className="sm mut">{t('inspection.recordedBy', { name: inspection.createdByName })}</p>}
            </li>
          ))}
        </ul>
      )}

      {canRecord && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={pickupDone || booking.status === 'completed' ? 'outline' : 'primary'}
            size="sm"
            iconLeft={<ClipboardCheck size={16} aria-hidden="true" />}
            onClick={() => setRecording('PICKUP')}
          >
            {t('inspection.recordPickup')}
          </Button>
          <Button
            variant={booking.status === 'active' ? 'primary' : 'outline'}
            size="sm"
            iconLeft={<ClipboardCheck size={16} aria-hidden="true" />}
            onClick={() => setRecording('RETURN')}
          >
            {t('inspection.recordReturn')}
          </Button>
        </div>
      )}

      {recording && (
        <InspectionModal
          booking={booking}
          type={recording}
          onClose={() => setRecording(null)}
          onCreated={(inspection) => setInspections((list) => [inspection, ...(list ?? [])])}
        />
      )}
    </section>
  );
}
