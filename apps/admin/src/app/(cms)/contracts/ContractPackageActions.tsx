'use client';

/**
 * Extras of the "Vertrag" section in the booking drawer:
 *  - which contract template is used and who signs for the company; a warning (with links) while that signer has
 *    no stored signature, because the contract cannot be created without it (422 company_signature_missing),
 *  - "Vertragsentwurf ansehen": the contract pre-filled and signed by the company, opened as PDF,
 *  - "Vertragspaket senden": e-mails the signed contract, the pick-up damage report and the invoice
 *    (to the booking's address or another one).
 */
import type { ContractPreviewDto } from '@hoppdrive/shared';
import { Eye, Send } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Modal, useToast } from '@/components/ui';
import { useCan } from '@/hooks/usePermission';
import { ApiError, api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { apiErrorCode, isCompanySignatureMissing } from '@/lib/inspection-errors';
import { openPdfInTab } from '@/lib/inspection-pdf';
import type { Booking } from './types';

type PackageResult = Awaited<ReturnType<typeof api.sendContractPackage>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Warning shown whenever the company signer has no signature. Links to where it can be fixed. */
export function SignatureMissingAlert({ signerName }: { signerName?: string | null }) {
  const t = useTranslations();
  const canSettings = useCan('websiteSettings', 'view');
  return (
    <Alert tone="warn" title={t('contractPackage.signatureMissingTitle')}>
      <p>{signerName ? t('contractPackage.signatureMissingNamed', { name: signerName }) : t('contractPackage.signatureMissing')}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/profile?tab=signature" className="font-semibold underline">
          {t('contractPackage.addMySignature')}
        </Link>
        {canSettings && (
          <Link href="/settings?tab=documents" className="font-semibold underline">
            {t('contractPackage.chooseSigner')}
          </Link>
        )}
      </p>
    </Alert>
  );
}

function PackageModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const t = useTranslations();
  const { toast } = useToast();
  const [email, setEmail] = useState(booking.customerEmail ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PackageResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const target = email.trim();
    if (!target) {
      setFieldError(t('contractPackage.errors.noRecipient'));
      return;
    }
    if (!EMAIL_PATTERN.test(target)) {
      setFieldError(t('contractPackage.errors.emailInvalid'));
      return;
    }
    setFieldError(null);
    setError(null);
    setSending(true);
    try {
      const res = await api.sendContractPackage(booking.id, target.toLowerCase() === (booking.customerEmail ?? '').toLowerCase() ? undefined : target);
      setResult(res);
      if (res.status === 'SENT') toast.success(t('contractPackage.sent'), target);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'contract_not_signed') setError(t('contractPackage.errors.notSigned'));
      else if (code === 'no_recipient') setFieldError(t('contractPackage.errors.noRecipient'));
      else setError(errorText(err, t('contractPackage.errors.sendFailed')));
    } finally {
      setSending(false);
    }
  }

  if (result) {
    const parts = [
      result.includes.contract && t('contractPackage.partContract'),
      result.includes.damageReport && t('contractPackage.partDamageReport'),
      result.includes.invoice && t('contractPackage.partInvoice'),
    ].filter(Boolean) as string[];
    return (
      <Modal
        open
        onClose={onClose}
        title={t('contractPackage.title')}
        footer={
          <Button variant="outline" onClick={onClose}>
            {t('ui.schliessen')}
          </Button>
        }
      >
        {result.status === 'SENT' && <Alert tone="ok">{t('contractPackage.resultSent', { email: email.trim() })}</Alert>}
        {result.status === 'QUEUED' && <Alert tone="info">{t('contractPackage.resultQueued', { email: email.trim() })}</Alert>}
        {result.status === 'FAILED' && (
          <Alert tone="err" title={t('contractPackage.resultFailed')}>
            {result.error || t('contractPackage.resultFailedText')}
          </Alert>
        )}
        {parts.length > 0 && <p className="mut">{t('contractPackage.includes', { list: parts.join(', ') })}</p>}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!sending}
      title={t('contractPackage.title')}
      description={t('contractPackage.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="contract-package-form" loading={sending} iconLeft={<Send size={18} aria-hidden="true" />}>
            {t('contractPackage.send')}
          </Button>
        </>
      }
    >
      <form id="contract-package-form" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3.5">
        <ul className="m-0 list-disc pl-5 text-[15px]">
          <li>{t('contractPackage.partContract')}</li>
          <li>{t('contractPackage.partDamageReport')}</li>
          <li>{t('contractPackage.partInvoice')}</li>
        </ul>
        <Field label={t('contractPackage.recipient')} hint={t('contractPackage.recipientHint')} error={fieldError} required>
          <Input
            data-autofocus
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(null);
            }}
            disabled={sending}
          />
        </Field>
        {error && <Alert tone="err">{error}</Alert>}
      </form>
    </Modal>
  );
}

export function ContractPackageActions({ booking, canEdit }: { booking: Booking; canEdit: boolean }) {
  const t = useTranslations();
  const { toast } = useToast();
  const signed = booking.contractStatus === 'SIGNED';
  const cancelled = booking.status === 'cancelled';
  const [preview, setPreview] = useState<ContractPreviewDto | null>(null);
  const [signatureMissing, setSignatureMissing] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const bookingId = booking.id;
  useEffect(() => {
    setPreview(null);
    setSignatureMissing(false);
    if (signed || cancelled) return;
    let stale = false;
    api
      .getContractPreview(bookingId)
      .then((p) => {
        if (stale) return;
        setPreview(p);
        setSignatureMissing(!p.companySigner.hasSignature);
      })
      .catch(() => {
        /* the buttons below still work; the warning is a convenience */
      });
    return () => {
      stale = true;
    };
  }, [bookingId, signed, cancelled]);

  async function openDraft() {
    setDraftBusy(true);
    try {
      await openPdfInTab(() => api.downloadContractDraft(bookingId), `Vertragsentwurf-${bookingId.slice(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      if (await isCompanySignatureMissing(err)) setSignatureMissing(true);
      else if ((await apiErrorCode(err)) === 'invalid_pdf') toast.error(t('contractPackage.errors.draftFailed'), t('contractPackage.errors.templateBroken'));
      else toast.error(t('contractPackage.errors.draftFailed'), errorText(err));
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <>
      {!signed && !cancelled && preview && !signatureMissing && (
        <p className="sm mut">
          {preview.templateName ? t('contractPackage.templateNamed', { name: preview.templateName }) : t('contractPackage.templateBuiltIn')}
          {preview.companySigner.name ? ` · ${t('contractPackage.signerNamed', { name: preview.companySigner.name })}` : ''}
        </p>
      )}
      {signatureMissing && !signed && !cancelled && <SignatureMissingAlert signerName={preview?.companySigner.name} />}
      {(!signed && !cancelled) || (signed && canEdit) ? (
        <div className="flex flex-wrap gap-2">
          {!signed && !cancelled && (
            <Button variant="outline" size="sm" loading={draftBusy} onClick={() => void openDraft()} iconLeft={<Eye size={18} aria-hidden="true" />}>
              {t('contractPackage.viewDraft')}
            </Button>
          )}
          {signed && canEdit && (
            <Button variant="outline" size="sm" onClick={() => setSending(true)} iconLeft={<Send size={18} aria-hidden="true" />}>
              {t('contractPackage.send')}
            </Button>
          )}
        </div>
      ) : null}
      {sending && <PackageModal booking={booking} onClose={() => setSending(false)} />}
    </>
  );
}
