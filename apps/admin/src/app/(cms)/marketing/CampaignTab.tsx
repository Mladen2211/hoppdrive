'use client';

/**
 * Marketing > Kampagne: write a discount mail and send it to customers.
 *  - Betreff and Nachricht (plain text, blank line = new paragraph; the mail is always German)
 *  - Code: none / one shared code for everybody / a personal single-use code per recipient
 *  - Empfänger: the selection from "Kunden" or all eligible customers (the server re-checks eligibility
 *    and adds the unsubscribe link to every mail)
 *  - Vorschau: recipient count, skipped addresses and the mail rendered in a sandboxed iframe
 *  - Senden: confirmation with the recipient count, then the mails are queued and the Verlauf opens.
 */
import { Eye, Info, Send, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CampaignCodeInput,
  CampaignCodeMode,
  CampaignPreviewDto,
  CreateCampaignRequest,
  DiscountCodeDto,
  DiscountType,
} from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Input, Select, Skeleton, Textarea, cn, useConfirm, useToast } from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { api } from '@/lib/api';
import { renderCampaignPreview } from '@/lib/email-preview';
import { errorText } from '@/lib/errors';
import { fmtDate, fmtNumber } from '@/lib/format';
import { tr } from '@/i18n/active';
import { discountText } from './shared';

type RecipientMode = 'selected' | 'all';
type CodeSource = 'existing' | 'new';

interface CodeParams {
  type: DiscountType;
  value: string;
  code: string;
  validFrom: string;
  validUntil: string;
  minDays: string;
  maxRedemptions: string;
  perEmailLimit: string;
}

const EMPTY_PARAMS: CodeParams = { type: 'PERCENT', value: '10', code: '', validFrom: '', validUntil: '', minDays: '', maxRedemptions: '', perEmailLimit: '1' };

type Errors = Partial<Record<'subject' | 'message' | 'value' | 'existing' | 'recipients' | 'validUntil' | 'code', string>>;

export interface CampaignTabProps {
  canEdit: boolean;
  selection: Set<string>;
  onPickCustomers: () => void;
  onSent: (campaignId: string) => void;
}

export function CampaignTab({ canEdit, selection, onPickCustomers, onSent }: CampaignTabProps) {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const currency = useCurrency();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [codeMode, setCodeMode] = useState<CampaignCodeMode>('NONE');
  const [source, setSource] = useState<CodeSource>('new');
  const [existingId, setExistingId] = useState('');
  const [params, setParams] = useState<CodeParams>(EMPTY_PARAMS);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('selected');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');

  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [sharedCodes, setSharedCodes] = useState<DiscountCodeDto[]>([]);
  const [preview, setPreview] = useState<CampaignPreviewDto | null>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  // Without a selection the campaign goes to everybody eligible (until the admin picks customers).
  const selectionCount = selection.size;
  const effectiveMode: RecipientMode = recipientMode === 'selected' && selectionCount === 0 ? 'all' : recipientMode;
  const userChoseMode = useRef(false);

  useEffect(() => {
    if (!token) return;
    api
      .getCustomers({ filter: 'eligible', pageSize: 1 })
      .then((res) => setEligibleCount(res.counts.eligible))
      .catch(() => setEligibleCount(null));
  }, [token]);

  useEffect(() => {
    if (!token || codeMode !== 'SHARED') return;
    api
      .getDiscountCodes({ status: 'active', pageSize: 100 })
      .then((res) => setSharedCodes(res.items))
      .catch(() => setSharedCodes([]));
  }, [token, codeMode]);

  // A new selection from the customer list switches the recipients to it.
  useEffect(() => {
    if (selectionCount > 0 && !userChoseMode.current) setRecipientMode('selected');
  }, [selectionCount]);

  const setParam = <K extends keyof CodeParams>(key: K, value: CodeParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setErrors((e) => ({ ...e, value: key === 'value' ? undefined : e.value, validUntil: key === 'validUntil' ? undefined : e.validUntil, code: key === 'code' ? undefined : e.code }));
  };

  /** The API request, or the field errors that prevent one. */
  const build = useCallback((): { request: CreateCampaignRequest } | { errors: Errors } => {
    const found: Errors = {};
    if (!subject.trim()) found.subject = tr('marketing.campaign.errSubject');
    if (!message.trim()) found.message = tr('marketing.campaign.errMessage');
    let code: CampaignCodeInput | undefined;
    if (codeMode === 'SHARED' && source === 'existing') {
      if (!existingId) found.existing = tr('marketing.campaign.errExisting');
      else code = { id: existingId };
    } else if (codeMode !== 'NONE') {
      const value = Number(params.value);
      if (params.value.trim() === '' || Number.isNaN(value) || value <= 0) found.value = tr('marketing.codes.errValue');
      else if (params.type === 'PERCENT' && value > 100) found.value = tr('marketing.codes.errPercent');
      if (params.validFrom && params.validUntil && params.validUntil < params.validFrom) found.validUntil = tr('marketing.codes.errDates');
      if (codeMode === 'SHARED' && params.code.trim() && !/^[A-Za-z0-9][A-Za-z0-9-]{2,38}$/.test(params.code.trim())) found.code = tr('marketing.codes.errCode');
      code = {
        type: params.type,
        value,
        ...(params.type === 'FIXED' ? { currency } : {}),
        validFrom: params.validFrom || null,
        validUntil: params.validUntil || null,
        minDays: params.minDays.trim() ? Number(params.minDays) : null,
        label: subject.trim().slice(0, 120),
        ...(codeMode === 'SHARED'
          ? {
              ...(params.code.trim() ? { code: params.code.trim().toUpperCase() } : {}),
              maxRedemptions: params.maxRedemptions.trim() ? Number(params.maxRedemptions) : null,
              perEmailLimit: params.perEmailLimit.trim() ? Number(params.perEmailLimit) : 1,
            }
          : {}),
      };
    }
    if (effectiveMode === 'selected' && selectionCount === 0) found.recipients = tr('marketing.campaign.errRecipients');
    if (Object.keys(found).length > 0) return { errors: found };
    return {
      request: {
        subject: subject.trim(),
        message: message.trim(),
        recipients: effectiveMode === 'all' ? { mode: 'all' } : { mode: 'selected', emails: Array.from(selection) },
        codeMode,
        ...(code ? { code } : {}),
      },
    };
  }, [subject, message, codeMode, source, existingId, params, effectiveMode, selection, selectionCount, currency]);

  const currentKey = useMemo(() => {
    const built = build();
    return 'request' in built ? JSON.stringify(built.request) : '';
  }, [build]);

  async function loadPreview() {
    const built = build();
    if ('errors' in built) {
      setErrors(built.errors);
      setFormError(tr('marketing.campaign.checkFields'));
      return null;
    }
    setErrors({});
    setFormError('');
    setPreviewing(true);
    try {
      const result = await api.previewCampaign(built.request);
      setPreview(result);
      setPreviewKey(JSON.stringify(built.request));
      return { request: built.request, preview: result };
    } catch (err) {
      setFormError(errorText(err, tr('marketing.campaign.previewFailed')));
      return null;
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    const prepared = await loadPreview();
    if (!prepared) return;
    const { request, preview: fresh } = prepared;
    if (fresh.recipientCount === 0) {
      setFormError(tr('marketing.campaign.noRecipients'));
      return;
    }
    setSending(true);
    const outcome: { id: string | null; skipped: number } = { id: null, skipped: 0 };
    const done = await confirm({
      title: t('marketing.campaign.confirmTitle', { count: fresh.recipientCount }),
      description: t('marketing.campaign.confirmText', { subject: request.subject }),
      warning:
        fresh.skipped.length > 0 || codeMode === 'PERSONAL' ? (
          <>
            {fresh.skipped.length > 0 && <span className="block">{t('marketing.campaign.skippedNote', { count: fresh.skipped.length })}</span>}
            {codeMode === 'PERSONAL' && <span className="block">{t('marketing.campaign.personalNote')}</span>}
          </>
        ) : undefined,
      confirmLabel: t('marketing.campaign.confirmSend', { count: fresh.recipientCount }),
      tone: 'primary',
      icon: <Send size={20} />,
      onConfirm: async () => {
        try {
          const created = await api.createCampaign(request);
          outcome.id = created.id;
          outcome.skipped = created.skipped?.length ?? 0;
        } catch (err) {
          const code = (err as { code?: string }).code;
          throw new Error(code === 'no_recipients' ? tr('marketing.campaign.noRecipients') : errorText(err, tr('marketing.campaign.sendFailed')));
        }
      },
    });
    setSending(false);
    if (!done || !outcome.id) return;
    toast.success(t('marketing.campaign.sent'), t('marketing.campaign.sentText', { count: fresh.recipientCount - outcome.skipped }));
    setSubject('');
    setMessage('');
    setPreview(null);
    setCodeMode('NONE');
    userChoseMode.current = false;
    onSent(outcome.id);
  }

  const previewHtml = useMemo(
    () =>
      renderCampaignPreview({
        subject: subject || t('marketing.campaign.previewSubjectPlaceholder'),
        message: message || t('marketing.campaign.previewMessagePlaceholder'),
        recipientName: preview?.sampleRecipient?.name ?? t('marketing.campaign.sampleName'),
        code: codeMode === 'NONE' ? null : preview?.sampleCode ?? 'HD-XXXX-XXXX',
        discountText: codeMode === 'NONE' ? null : preview?.discountText ?? null,
        validUntil: preview?.validUntil ? fmtDate(preview.validUntil) : params.validUntil ? fmtDate(params.validUntil) : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subject, message, preview, codeMode, params.validUntil],
  );

  const stale = preview !== null && previewKey !== currentKey;
  const readOnly = !canEdit;
  const recipientLabel =
    effectiveMode === 'all'
      ? t('marketing.campaign.toAll', { count: eligibleCount === null ? '–' : fmtNumber(eligibleCount) })
      : t('marketing.campaign.toSelected', { count: selectionCount });

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <section className="panel" aria-labelledby="campaign-h">
        <div className="panel-h">
          <div className="min-w-0">
            <h2 className="h2" id="campaign-h">
              {t('marketing.campaign.title')}
            </h2>
            <p className="sm mut mt-0.5">{t('marketing.campaign.subtitle')}</p>
          </div>
        </div>
        <form
          className="flex flex-col gap-5 p-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {readOnly && <Alert tone="info">{t('marketing.campaign.readOnly')}</Alert>}
          {formError && <Alert tone="err">{formError}</Alert>}
          <fieldset disabled={readOnly || sending} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
            <Alert tone="info" icon={<Info size={20} />}>
              {t('marketing.campaign.germanNote')}
            </Alert>

            <Field label={t('marketing.campaign.subject')} error={errors.subject} required>
              <Input value={subject} onChange={(e) => { setSubject(e.target.value); setErrors((x) => ({ ...x, subject: undefined })); }} maxLength={200} lang="de" placeholder={t('marketing.campaign.subjectPlaceholder')} />
            </Field>
            <Field label={t('marketing.campaign.message')} hint={t('marketing.campaign.messageHint')} error={errors.message} required>
              <Textarea rows={8} value={message} onChange={(e) => { setMessage(e.target.value); setErrors((x) => ({ ...x, message: undefined })); }} lang="de" maxLength={5000} showCount={false} />
            </Field>

            {/* Code */}
            <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('marketing.campaign.codeTitle')}</legend>
              <div role="radiogroup" aria-label={t('marketing.campaign.codeTitle')} className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                {(['NONE', 'SHARED', 'PERSONAL'] as CampaignCodeMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={cn(
                      'flex min-h-[64px] cursor-pointer flex-col justify-center gap-0.5 rounded-xl border-[1.5px] px-3.5 py-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                      codeMode === mode ? 'border-ruby bg-ruby-tint' : 'border-line hover:bg-paper',
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input type="radio" name="code-mode" value={mode} checked={codeMode === mode} onChange={() => { setCodeMode(mode); setErrors({}); }} className="accent-ruby" />
                      {t(`marketing.campaign.mode.${mode}`)}
                    </span>
                    <span className="sm mut">{t(`marketing.campaign.modeHint.${mode}`)}</span>
                  </label>
                ))}
              </div>

              {codeMode === 'SHARED' && (
                <div role="radiogroup" aria-label={t('marketing.campaign.sharedSource')} className="flex flex-wrap gap-4">
                  {(['new', 'existing'] as CodeSource[]).map((value) => (
                    <label key={value} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-medium">
                      <input type="radio" name="code-source" value={value} checked={source === value} onChange={() => { setSource(value); setErrors({}); }} className="accent-ruby" />
                      {t(`marketing.campaign.source.${value}`)}
                    </label>
                  ))}
                </div>
              )}

              {codeMode === 'SHARED' && source === 'existing' && (
                <Field label={t('marketing.campaign.existingCode')} error={errors.existing}>
                  <Select value={existingId} onChange={(e) => { setExistingId(e.target.value); setErrors((x) => ({ ...x, existing: undefined })); }}>
                    <option value="">{t('marketing.campaign.chooseCode')}</option>
                    {sharedCodes.filter((c) => !c.isPersonal).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {discountText(c)}
                        {c.label ? ` · ${c.label}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {codeMode !== 'NONE' && !(codeMode === 'SHARED' && source === 'existing') && (
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <Field label={t('marketing.codes.fieldType')}>
                    <Select value={params.type} onChange={(e) => setParam('type', e.target.value as DiscountType)}>
                      <option value="PERCENT">{t('marketing.codes.typePercent')}</option>
                      <option value="FIXED">{t('marketing.codes.typeFixed', { currency })}</option>
                    </Select>
                  </Field>
                  <Field label={params.type === 'PERCENT' ? t('marketing.codes.valuePercent') : t('marketing.codes.valueFixed', { currency })} error={errors.value} required>
                    <Input type="number" inputMode="decimal" min={0} max={params.type === 'PERCENT' ? 100 : undefined} step={params.type === 'PERCENT' ? 1 : 0.05} value={params.value} onChange={(e) => setParam('value', e.target.value)} className="num" />
                  </Field>
                  {codeMode === 'SHARED' && (
                    <Field label={t('marketing.codes.fieldCode')} hint={t('marketing.campaign.sharedCodeHint')} error={errors.code}>
                      <Input value={params.code} onChange={(e) => setParam('code', e.target.value.toUpperCase())} className="num uppercase" placeholder="HD-XXXX-XXXX" autoComplete="off" spellCheck={false} />
                    </Field>
                  )}
                  <Field label={t('marketing.codes.validUntil')} hint={t('marketing.campaign.validUntilHint')} error={errors.validUntil}>
                    <Input type="date" value={params.validUntil} min={params.validFrom || undefined} onChange={(e) => setParam('validUntil', e.target.value)} />
                  </Field>
                  <Field label={t('marketing.codes.minDaysLabel')} hint={t('marketing.codes.minDaysHint')}>
                    <Input type="number" inputMode="numeric" min={1} step={1} value={params.minDays} onChange={(e) => setParam('minDays', e.target.value)} className="num" />
                  </Field>
                  {codeMode === 'SHARED' && (
                    <>
                      <Field label={t('marketing.codes.maxRedemptions')} hint={t('marketing.codes.maxHint')}>
                        <Input type="number" inputMode="numeric" min={1} step={1} value={params.maxRedemptions} onChange={(e) => setParam('maxRedemptions', e.target.value)} className="num" />
                      </Field>
                      <Field label={t('marketing.codes.perEmailLimit')} hint={t('marketing.codes.perEmailHint')}>
                        <Input type="number" inputMode="numeric" min={1} step={1} value={params.perEmailLimit} onChange={(e) => setParam('perEmailLimit', e.target.value)} className="num" />
                      </Field>
                    </>
                  )}
                </div>
              )}
            </fieldset>

            {/* Recipients */}
            <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('marketing.campaign.recipientsTitle')}</legend>
              <div role="radiogroup" aria-label={t('marketing.campaign.recipientsTitle')} className="flex flex-col gap-1">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="recipient-mode"
                    checked={effectiveMode === 'selected'}
                    disabled={selectionCount === 0}
                    onChange={() => { userChoseMode.current = true; setRecipientMode('selected'); setErrors((x) => ({ ...x, recipients: undefined })); }}
                    className="accent-ruby"
                  />
                  {t('marketing.campaign.toSelected', { count: selectionCount })}
                </label>
                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="recipient-mode"
                    checked={effectiveMode === 'all'}
                    onChange={() => { userChoseMode.current = true; setRecipientMode('all'); setErrors((x) => ({ ...x, recipients: undefined })); }}
                    className="accent-ruby"
                  />
                  {t('marketing.campaign.toAll', { count: eligibleCount === null ? '–' : fmtNumber(eligibleCount) })}
                </label>
              </div>
              {errors.recipients && <p className="errm">{errors.recipients}</p>}
              <div>
                <Button variant="ghost" size="sm" onClick={onPickCustomers} iconLeft={<Users size={16} aria-hidden="true" />}>
                  {t('marketing.campaign.pickCustomers')}
                </Button>
              </div>
              <p className="hint">{t('marketing.campaign.eligibleNote')}</p>
            </fieldset>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void loadPreview()} loading={previewing} disabled={sending} iconLeft={<Eye size={18} aria-hidden="true" />}>
              {preview ? t('marketing.campaign.refreshPreview') : t('marketing.campaign.preview')}
            </Button>
            {canEdit && (
              <Button type="submit" loading={sending} disabled={previewing} iconLeft={<Send size={18} aria-hidden="true" />}>
                {t('marketing.campaign.send')}
              </Button>
            )}
            <span className="sm mut" aria-live="polite">{recipientLabel}</span>
          </div>
        </form>
      </section>

      {/* ── Preview ── */}
      <section className="panel xl:sticky xl:top-[calc(var(--drawer-offset,0px)+16px)]" aria-labelledby="campaign-preview-h">
        <div className="panel-h">
          <h2 className="h2" id="campaign-preview-h">
            {t('marketing.campaign.previewTitle')}
          </h2>
        </div>
        <div className="flex flex-col gap-3 p-5">
          {stale && <Alert tone="warn">{t('marketing.campaign.stale')}</Alert>}
          {previewing && !preview ? (
            <Skeleton className="h-[200px]" rounded={12} />
          ) : preview ? (
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2">
              <dt className="mut">{t('marketing.campaign.previewRecipients')}</dt>
              <dd>
                <b className="num">{fmtNumber(preview.recipientCount)}</b>
                {preview.skipped.length > 0 && (
                  <span className="sm block text-warn">{t('marketing.campaign.skippedNote', { count: preview.skipped.length })}</span>
                )}
              </dd>
              {preview.sampleCode && (
                <>
                  <dt className="mut">{t('marketing.campaign.previewCode')}</dt>
                  <dd className="num">
                    {preview.sampleCode}
                    {preview.discountText && <span className="sm mut"> · {preview.discountText}</span>}
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="mut">{t('marketing.campaign.previewEmpty')}</p>
          )}
          {preview && preview.skipped.length > 0 && (
            <details className="sm">
              <summary className="cursor-pointer font-semibold">{t('marketing.campaign.skippedList')}</summary>
              <ul className="mt-1 list-disc pl-5 text-graphite">
                {preview.skipped.slice(0, 20).map((email) => (
                  <li key={email} className="break-all">{email}</li>
                ))}
              </ul>
            </details>
          )}
          {/* The rendered mail: sandboxed without any permission, pinned to the light palette. */}
          <div data-theme="light" className="overflow-hidden rounded-xl border border-line bg-card">
            <iframe title={t('marketing.campaign.previewFrame')} sandbox="" srcDoc={previewHtml} referrerPolicy="no-referrer" className="block h-[520px] w-full border-0" />
          </div>
          <p className="hint">{t('marketing.campaign.previewNote')}</p>
        </div>
      </section>
    </div>
  );
}

