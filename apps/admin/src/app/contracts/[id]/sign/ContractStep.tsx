'use client';

/**
 * Step "Vertrag". With an active contract template the pre-filled contract (signed by the company, renter's
 * signature still empty) is shown as a PDF; without one, the summary and the clauses of the built-in contract.
 * Blocks the way on for staff while the company signer has no stored signature (the API refuses to create
 * the contract then: 422 company_signature_missing).
 */
import type { ContractPreviewDto } from '@hoppdrive/shared';
import { Download, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Alert, Button, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { contractFilename } from '@/lib/booking';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { isCompanySignatureMissing } from '@/lib/inspection-errors';
import { Summary, VehicleCard } from './SignParts';

const BIG_BUTTON = 'min-h-[52px] text-base';

type Draft =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string; blob: Blob }
  | { status: 'signature' }
  | { status: 'error'; message: string };

export interface ContractStepProps {
  preview: ContractPreviewDto;
  thumbnail: string | null;
  onBack: () => void;
  onNext: () => void;
}

export function ContractStep({ preview, thumbnail, onBack, onNext }: ContractStepProps) {
  const t = useTranslations();
  const bookingId = preview.booking.id;
  const hasTemplate = Boolean(preview.templateId);
  const [draft, setDraft] = useState<Draft>({ status: hasTemplate ? 'loading' : 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hasTemplate) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setDraft({ status: 'loading' });
    api
      .downloadContractDraft(bookingId)
      .then((blob) => {
        if (cancelled) return;
        const pdf = new Blob([blob], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(pdf);
        setDraft({ status: 'ready', url: objectUrl, blob: pdf });
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (await isCompanySignatureMissing(err)) setDraft({ status: 'signature' });
        else setDraft({ status: 'error', message: errorText(err, t('sign.draftFailed')) });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, hasTemplate, attempt]);

  const signatureMissing = !preview.companySigner.hasSignature || draft.status === 'signature';
  const blocked = signatureMissing || draft.status === 'loading' || draft.status === 'error';

  return (
    <section className="panel flex flex-col gap-4 p-5" aria-labelledby="contract-h">
      <h2 className="sr-only" id="contract-h">
        {t('sign.mietvertrag')}
      </h2>
      <VehicleCard preview={preview} thumbnail={thumbnail} />
      <Summary preview={preview} />

      {signatureMissing && (
        <Alert tone="err" title={t('sign.signatureMissingTitle')}>
          <p>{t('sign.signatureMissingText')}</p>
          <p className="sm mt-2">
            {t('sign.signatureMissingStaff')}{' '}
            <Link href="/profile?tab=signature" className="font-semibold underline">
              {t('contractPackage.addMySignature')}
            </Link>
          </p>
        </Alert>
      )}

      {hasTemplate && signatureMissing ? null : hasTemplate ? (
        <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
          <h3 className="h3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-ruby-fg" aria-hidden="true" />
            {t('sign.draftHeading')}
          </h3>
          {draft.status === 'loading' && <Skeleton className="h-[60vh] w-full" rounded={12} />}
          {draft.status === 'error' && (
            <Alert
              tone="err"
              action={
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.erneutVersuchen')}
                </Button>
              }
            >
              {draft.message}
            </Alert>
          )}
          {draft.status === 'ready' && (
            <>
              <iframe src={draft.url} title={t('sign.draftHeading')} className="block h-[62vh] w-full rounded-xl border border-line bg-paper" />
              <div className="flex flex-wrap gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<ExternalLink size={16} aria-hidden="true" />}
                  onClick={() => window.open(draft.url, '_blank', 'noopener')}
                >
                  {t('sign.draftOpen')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Download size={16} aria-hidden="true" />}
                  onClick={() => triggerBlobDownload(draft.blob, contractFilename(bookingId))}
                >
                  {t('sign.draftDownload')}
                </Button>
              </div>
              <p className="sm mut">{t('sign.draftNote')}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
          <h3 className="h3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-ruby-fg" aria-hidden="true" />
            {t('sign.vertragsbedingungen')}
          </h3>
          <div className="flex max-h-[42vh] flex-col gap-4 overflow-y-auto pr-1" tabIndex={0} aria-label={t('sign.vertragsbedingungen')}>
            {preview.clauses.map((c) => (
              <div key={c.id}>
                <h4 className="mb-1 font-semibold">{c.heading}</h4>
                <p className="leading-relaxed text-graphite">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2.5 border-t border-line-soft pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} className={BIG_BUTTON}>
          {t('common.zurueck')}
        </Button>
        <Button onClick={onNext} disabled={blocked} className={BIG_BUTTON}>
          {t('sign.weiterZurUnterschrift')}
        </Button>
      </div>
    </section>
  );
}
