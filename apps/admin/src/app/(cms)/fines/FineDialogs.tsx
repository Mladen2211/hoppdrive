'use client';

/**
 * Dialogs of the fine drawer:
 *  - AssignModal: who had the car? Candidates from the lookup at the time of the fine (assign / reassign),
 *    or any other booking of the same vehicle when the times do not fit.
 *  - NotifyModal: e-mail to the renter (fine document attached) with an optional note.
 */
import { Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { FineDto, FineLookupDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Modal, Select, Skeleton, Textarea } from '@/components/ui';
import { CandidateCard } from '@/components/fines/CandidateCard';
import { api } from '@/lib/api';
import { fetchBookings } from '@/lib/bookings';
import { errorText } from '@/lib/errors';
import { isTimeUnknown } from '@/lib/fine-model';
import { fmtZurichPeriod, zurichParts } from '@/lib/zurich';
import { formatPlate } from '@/lib/plate';
import { tr } from '@/i18n/active';

interface BookingOption {
  id: string;
  vehicleId: string;
  label: string;
}

export function AssignModal({
  fine,
  onClose,
  onAssign,
}: {
  fine: FineDto;
  onClose: () => void;
  /** Resolves when the assignment worked (the modal then closes); throws a readable Error otherwise. */
  onAssign: (bookingId: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [lookup, setLookup] = useState<FineLookupDto | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [options, setOptions] = useState<BookingOption[]>([]);
  const [otherId, setOtherId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const parts = zurichParts(fine.occurredAt);
    const at = isTimeUnknown(fine.occurredAt) ? (parts?.date ?? fine.occurredAt) : fine.occurredAt;
    api
      .lookupFine(fine.licensePlate, at)
      .then((data) => {
        if (alive) setLookup(data);
      })
      .catch((err) => {
        if (alive) setLookupError(errorText(err, tr('fines.lookupFailed')));
      });
    fetchBookings(200)
      .then((res) => {
        if (!alive) return;
        const rows = (res.items as { id: string; vehicleId: string; customerName: string; startDate: string; endDate: string; hasTimes?: boolean; vehicle?: { brand?: string; model?: string } | null }[])
          .filter((b) => !fine.vehicleId || b.vehicleId === fine.vehicleId)
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
          .slice(0, 60)
          .map((b) => ({ id: b.id, vehicleId: b.vehicleId, label: `${b.customerName} · ${fmtZurichPeriod(b)}` }));
        setOptions(rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fine.id, fine.licensePlate, fine.occurredAt, fine.vehicleId]);

  async function assign(bookingId: string) {
    setBusyId(bookingId);
    setError(null);
    try {
      await onAssign(bookingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('fines.assignFailed'));
    } finally {
      setBusyId(null);
    }
  }

  const candidateIds = new Set((lookup?.candidates ?? []).map((c) => c.bookingId));
  const others = options.filter((o) => !candidateIds.has(o.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={fine.bookingId ? t('fines.assign.titleReassign') : t('fines.assign.title')}
      description={t('fines.assign.text', { plate: formatPlate(fine.licensePlate) })}
      size="lg"
      dismissible={busyId === null}
      footer={
        <Button variant="ghost" onClick={onClose} disabled={busyId !== null}>
          {t('documents.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        {lookupError && <Alert tone="err">{lookupError}</Alert>}
        {!lookup && !lookupError && <Skeleton className="h-[160px] w-full" rounded={12} />}
        {lookup && lookup.candidates.length === 0 && (
          <Alert tone="warn">{lookup.warning === 'no_vehicle' ? t('fines.warn.noVehicle', { plate: formatPlate(fine.licensePlate) }) : t('fines.warn.none')}</Alert>
        )}
        {lookup && lookup.warning === 'multiple' && <Alert tone="warn">{t('fines.warn.multiple')}</Alert>}
        {lookup && lookup.candidates.length > 0 && (
          <div className="grid gap-3">
            {lookup.candidates.map((candidate) => {
              const current = candidate.bookingId === fine.bookingId;
              return (
                <CandidateCard
                  key={candidate.bookingId}
                  candidate={candidate}
                  highlighted={current}
                  actions={
                    current ? (
                      <span className="sm font-semibold">{t('fines.assign.current')}</span>
                    ) : (
                      <Button size="sm" loading={busyId === candidate.bookingId} disabled={busyId !== null && busyId !== candidate.bookingId} onClick={() => void assign(candidate.bookingId)}>
                        {t('fines.assign.assignThis')}
                      </Button>
                    )
                  }
                />
              );
            })}
          </div>
        )}

        {others.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-row p-4">
            <Field label={t('fines.assign.otherLabel')} hint={t('fines.assign.otherHint')}>
              <Select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
                <option value="">{t('fines.assign.otherPlaceholder')}</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <Button variant="outline" size="sm" disabled={!otherId || otherId === fine.bookingId} loading={busyId === otherId && Boolean(otherId)} onClick={() => void assign(otherId)}>
                {t('fines.assign.assignThis')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function NotifyModal({
  fine,
  onClose,
  onSend,
}: {
  fine: FineDto;
  onClose: () => void;
  onSend: (note: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = fine.booking?.customerEmail?.trim() || '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await onSend(note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('fines.notify.failed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('fines.notify.title')}
      description={email ? t('fines.notify.text', { name: fine.booking?.customerName ?? '–', email }) : t('fines.notify.noEmail')}
      size="md"
      dismissible={!sending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="fine-notify-form" loading={sending} disabled={!email} iconLeft={<Mail size={18} aria-hidden="true" />}>
            {t('fines.notify.send')}
          </Button>
        </>
      }
    >
      <form id="fine-notify-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        {!email && <Alert tone="warn">{t('fines.notify.noEmailHint')}</Alert>}
        <Field label={t('fines.notify.note')} hint={fine.hasDocument ? t('fines.notify.noteHintDoc') : t('fines.notify.noteHint')}>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} data-autofocus />
        </Field>
        <p className="sm mut">{t('fines.notify.status')}</p>
      </form>
    </Modal>
  );
}
