'use client';

/**
 * "Wer hatte das Fahrzeug?": plate + date (+ optional time) -> the bookings that were running then.
 * The result explains the situation (one match, several, nobody, unknown plate) and offers
 * "Busse erfassen" with the plate, time and (for a candidate) the renter prefilled.
 */
import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { FineLookupCandidateDto, FineLookupDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Input } from '@/components/ui';
import { CandidateCard } from '@/components/fines/CandidateCard';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtDate, toInputDate } from '@/lib/format';
import { normalizePlate, formatPlate } from '@/lib/plate';
import { occurredAtFor } from '@/lib/fine-model';
import { tr } from '@/i18n/active';

/** What "Busse erfassen" starts with. */
export interface FinePrefill {
  licensePlate: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm or '' */
  time: string;
  /** Assign the new fine to this booking right after it is created. */
  candidate?: FineLookupCandidateDto;
}

export function LookupCard({ canEdit, onRecord }: { canEdit: boolean; onRecord: (prefill: FinePrefill) => void }) {
  const t = useTranslations();
  const [plate, setPlate] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<{ plate?: string; date?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(FineLookupDto & { queryDate: string; queryTime: string }) | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (normalizePlate(plate).length < 2) next.plate = t('fines.errPlate');
    if (!date) next.date = t('fines.errDate');
    setErrors(next);
    if (next.plate || next.date) return;
    setLoading(true);
    setError(null);
    try {
      const at = occurredAtFor(date, time);
      if (!at) {
        setErrors({ date: t('fines.errDate') });
        return;
      }
      const data = await api.lookupFine(plate.trim(), at);
      setResult({ ...data, queryDate: date, queryTime: time });
      setPlate(formatPlate(data.plate));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'invalid_plate') setErrors({ plate: t('fines.errPlateFormat') });
      else setError(errorText(err, tr('fines.lookupFailed')));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const record = (candidate?: FineLookupCandidateDto) => {
    if (!result) return;
    onRecord({ licensePlate: result.plate, date: result.queryDate, time: result.queryTime, candidate });
  };

  return (
    <section className="panel" aria-labelledby="fine-lookup-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="fine-lookup-h">
            {t('fines.lookup.title')}
          </h2>
          <p className="sm mut mt-0.5">{t('fines.lookup.subtitle')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-5 max-md:p-4">
        <form onSubmit={(e) => void submit(e)} noValidate className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] items-start gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Field label={t('fines.plate')} required error={errors.plate}>
            <Input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              onBlur={() => setPlate((p) => (p.trim() ? formatPlate(p) : p))}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              placeholder="ZH 123 456"
              className="num uppercase"
            />
          </Field>
          <Field label={t('fines.date')} required error={errors.date}>
            <Input type="date" value={date} max={toInputDate(new Date())} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('fines.time')} hint={t('fines.timeHint')}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Button type="submit" loading={loading} iconLeft={<Search size={18} aria-hidden="true" />} className="mt-[26px] max-sm:mt-0 max-sm:w-full">
            {t('fines.lookup.search')}
          </Button>
        </form>

        <div aria-live="polite" className="flex flex-col gap-3">
          {error && <Alert tone="err">{error}</Alert>}
          {result && <LookupResult result={result} canEdit={canEdit} onRecord={record} />}
        </div>
      </div>
    </section>
  );
}

function LookupResult({
  result,
  canEdit,
  onRecord,
}: {
  result: FineLookupDto & { queryDate: string; queryTime: string };
  canEdit: boolean;
  onRecord: (candidate?: FineLookupCandidateDto) => void;
}) {
  const t = useTranslations();
  const plateText = formatPlate(result.plate);
  const when = result.queryTime ? `${fmtDate(result.queryDate)}, ${result.queryTime}` : `${fmtDate(result.queryDate)} (${t('fines.timeUnknownShort')})`;

  return (
    <>
      <p className="text-sm">
        {result.vehicle ? (
          <>
            <b className="font-semibold">
              {result.vehicle.brand} {result.vehicle.model}
            </b>{' '}
            <span className="num mut">{plateText}</span>
          </>
        ) : (
          <b className="num font-semibold">{plateText}</b>
        )}
        <span className="mut"> · {when}</span>
      </p>

      {result.warning === 'no_vehicle' && (
        <Alert tone="warn" title={t('fines.warn.noVehicleTitle')}>
          {t('fines.warn.noVehicle', { plate: plateText })}
        </Alert>
      )}
      {result.warning === 'none' && (
        <Alert tone="warn" title={t('fines.warn.noneTitle')}>
          {t('fines.warn.none')}
        </Alert>
      )}
      {result.warning === 'multiple' && (
        <Alert tone="warn" title={t('fines.warn.multipleTitle', { count: result.candidates.length })}>
          {t('fines.warn.multiple')}
        </Alert>
      )}
      {result.warning === null && result.candidates.length === 1 && <Alert tone="ok">{t('fines.warn.single')}</Alert>}

      {result.candidates.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {result.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.bookingId}
              candidate={candidate}
              actions={
                canEdit ? (
                  <Button variant="outline" size="sm" iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => onRecord(candidate)}>
                    {t('fines.lookup.recordForRenter')}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div>
          <Button variant="ghost" size="sm" iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => onRecord(undefined)}>
            {result.candidates.length > 0 ? t('fines.lookup.recordUnassigned') : t('fines.lookup.record')}
          </Button>
        </div>
      )}
    </>
  );
}
