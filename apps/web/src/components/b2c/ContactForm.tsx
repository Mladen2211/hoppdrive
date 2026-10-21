'use client';

import { Check, Info, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useEstimate, useSelectedVehicle } from '@/components/b2c/SelectedVehicleContext';
import { Alert, Button, Checkbox, Field, Input, PricePill, Select, Spinner, Textarea, cn } from '@/components/ui';
import { useCurrency, useSiteFormatters } from '@/i18n/CurrencyProvider';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { Translate } from '@/i18n/types';
import { ApiError, api, type SubmitContactPayload } from '@/lib/api';
import { discountAmount, discountReasonKey, normalizeDiscountCode } from '@/lib/discount';
import { describeEstimate } from '@/lib/estimate';
import { DEFAULT_CONTACT_EMAIL } from '@/lib/site';
import type { ContactContent } from '@/types/homepage-sections';

export type { ContactContent };

interface ContactFormProps {
  content?: ContactContent;
  /** Address shown in the "Oder schreiben Sie an ..." fallback. */
  contactEmail?: string;
}

const FIELD_KEYS = [
  'fullName',
  'phone',
  'email',
  'message',
  'privacyConsent',
  'desiredStartDate',
  'desiredEndDate',
  'discountCode',
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];
type Errors = Partial<Record<FieldKey, string>>;
type Status = 'idle' | 'sending' | 'success' | 'failed';

interface Values {
  fullName: string;
  phone: string;
  email: string;
  message: string;
  privacy: boolean;
  marketing: boolean;
}

interface SuccessSnapshot {
  firstName: string;
  email: string;
  vehicle: string | null;
  from: string;
  to: string;
  days: number | null;
  /** Richtpreis (already reduced by a valid discount code). */
  total: number | null;
  /** "HD-AB12-CD34 (−10 %)" when a valid code was sent. */
  code: string | null;
}

/** Result of the live check of the discount code (GET /discount-codes/validate). */
type CodeCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid'; type: 'PERCENT' | 'FIXED'; value: number }
  | { status: 'invalid'; reason: string }
  /** Network error / rate limit: the code is sent anyway and checked by the team. */
  | { status: 'unavailable' };

/** The code may be given as `?code=` or `?rabatt=` (campaign e-mails link with it). */
const CODE_PARAMS = ['code', 'rabatt'];
const CODE_MIN_LENGTH = 3;
const CODE_DEBOUNCE_MS = 700;

const EMPTY_VALUES: Values = { fullName: '', phone: '', email: '', message: '', privacy: false, marketing: false };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isFieldKey(key: string): key is FieldKey {
  return (FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * Validation messages live in messages/<locale>.json -> contact.errors.<field>.{empty,invalid}.
 * The API answers a 422 with English `details`; those are mapped by field key.
 * `t` = translator of the `contact` namespace.
 */
function checkField(key: FieldKey, values: Values, t: Translate): string | undefined {
  switch (key) {
    case 'fullName':
      return values.fullName.trim() ? undefined : t('errors.fullName.empty');
    case 'phone': {
      const phone = values.phone.trim();
      if (!phone) return t('errors.phone.empty');
      return phone.length < 7 ? t('errors.phone.invalid') : undefined;
    }
    case 'email': {
      const email = values.email.trim();
      if (!email) return t('errors.email.empty');
      return EMAIL_RE.test(email) ? undefined : t('errors.email.invalid');
    }
    case 'message':
      return values.message.trim() ? undefined : t('errors.message.empty');
    case 'privacyConsent':
      return values.privacy ? undefined : t('errors.privacyConsent.empty');
    default:
      return undefined;
  }
}

const mailLink = 'underline underline-offset-2 hover:text-ruby-dark';

/** Reads `?code=` / `?rabatt=` (inside a Suspense boundary, like the vehicle selection) and prefills the code field. */
function DiscountCodeFromUrl({ onCode }: { onCode: (code: string) => void }) {
  const searchParams = useSearchParams();
  const raw = CODE_PARAMS.map((name) => searchParams.get(name)).find((value) => value && value.trim()) ?? '';

  useEffect(() => {
    if (raw) onCode(raw);
    // The parameter is the trigger; onCode only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  return null;
}

/** Steps shown next to / under the form. */
function NextSteps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ul className="flex flex-col gap-[18px] max-md:gap-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex items-start gap-3.5">
          <div
            className="num flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ruby-tint text-base font-bold text-ruby-dark"
            aria-hidden="true"
          >
            {index + 1}
          </div>
          <div>
            <b>{step.title}</b>
            <div className="text-sm leading-[1.45] text-graphite">{step.text}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ContactForm({ content, contactEmail = DEFAULT_CONTACT_EMAIL }: ContactFormProps) {
  const t = useTranslations('contact');
  const tEstimate = useTranslations('estimate');
  const f = useSiteFormatters();
  const currency = useCurrency();
  const c = content || {};
  const label = c.label ?? t('label');
  const heading = c.heading ?? t('heading');
  const formDescription = c.description ?? t('description');
  const ctaText = c.ctaText ?? t('cta');
  const trustLine = c.trustLine;

  const { vehicles, selection, setVehicleId, setFrom, setTo, clearVehicle } = useSelectedVehicle();
  const estimate = useEstimate();
  const ids = useId();

  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessSnapshot | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [code, setCode] = useState('');
  const [codeCheck, setCodeCheck] = useState<CodeCheck>({ status: 'idle' });
  // The code is only checked automatically once the visitor has finished typing it once
  // (blur / Enter / "Prüfen" / prefill from the URL), so the public endpoint is not hammered.
  const [codeActive, setCodeActive] = useState(false);
  const checkSeq = useRef(0);
  const checkedKey = useRef<string | null>(null);

  const summaryRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const vehicleSelectRef = useRef<HTMLSelectElement>(null);

  const sending = status === 'sending';
  const ready = Boolean(values.fullName.trim() && values.email.trim() && values.privacy);
  const dateOrderError = estimate.invalid ? t('errors.desiredEndDate.invalid') : undefined;
  const fieldError = (key: FieldKey): string | undefined => errors[key] ?? (key === 'desiredEndDate' ? dateOrderError : undefined);

  const errorKeys = useMemo(
    () => (Object.keys(errors) as FieldKey[]).filter((key) => errors[key]),
    [errors],
  );

  // ─── Discount code ─────────────────────────────────────────
  const codeValue = normalizeDiscountCode(code);
  const emailForCheck = EMAIL_RE.test(values.email.trim()) ? values.email.trim() : '';
  // What the check depends on: a change of any of these makes the last answer stale.
  const checkKey = `${codeValue}|${emailForCheck.toLowerCase()}|${selection.vehicleId ?? ''}|${estimate.days ?? ''}`;
  const reasonText = (reason: string | undefined) => t(`discount.reasons.${discountReasonKey(reason)}`);

  async function checkCode(): Promise<CodeCheck> {
    if (!codeValue) {
      setCodeCheck({ status: 'idle' });
      return { status: 'idle' };
    }
    const seq = ++checkSeq.current;
    setCodeCheck({ status: 'checking' });
    let result: CodeCheck;
    try {
      const answer = await api.validateDiscountCode({
        code: codeValue,
        email: emailForCheck || undefined,
        vehicleId: selection.vehicleId || undefined,
        days: estimate.days || undefined,
      });
      if (!answer.valid) result = { status: 'invalid', reason: answer.reason ?? 'not_found' };
      else if (answer.type && typeof answer.value === 'number') {
        result = { status: 'valid', type: answer.type, value: answer.value };
      } else result = { status: 'unavailable' };
    } catch {
      result = { status: 'unavailable' };
    }
    if (seq === checkSeq.current) {
      checkedKey.current = checkKey;
      setCodeCheck(result);
    }
    return result;
  }

  // Re-check (debounced) when the code, e-mail, vehicle or period changed after a first check.
  useEffect(() => {
    if (!codeActive || codeValue.length < CODE_MIN_LENGTH || checkedKey.current === checkKey) return;
    const timer = window.setTimeout(() => {
      void checkCode();
    }, CODE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // checkCode reads the current render's values; checkKey covers every one of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeActive, checkKey]);

  function changeCode(next: string) {
    checkSeq.current++; // forget an answer that is still on its way
    checkedKey.current = null;
    setCode(normalizeDiscountCode(next).slice(0, 40));
    setCodeCheck({ status: 'idle' });
    if (!next.trim()) setCodeActive(false);
    if (errors.discountCode) setErrors((prev) => ({ ...prev, discountCode: undefined }));
  }

  function prefillCode(raw: string) {
    const prefilled = normalizeDiscountCode(raw).slice(0, 40);
    if (!prefilled) return;
    setCode(prefilled);
    setCodeActive(true);
  }

  function checkNow() {
    if (!codeValue) return;
    setCodeActive(true);
    void checkCode();
  }

  const codeRule = codeCheck.status === 'valid' ? { type: codeCheck.type, value: codeCheck.value } : null;
  const codeLabel = codeRule
    ? codeRule.type === 'PERCENT'
      ? t('discount.percentOff', { percent: f.number(codeRule.value, Number.isInteger(codeRule.value) ? 0 : 1) })
      : `−${f.money(codeRule.value, { decimals: 'auto' })}`
    : '';
  const originalTotal = estimate.result?.total ?? null;
  const codeSaving = codeRule && originalTotal !== null ? discountAmount(codeRule, originalTotal) : 0;
  const reducedTotal = originalTotal !== null ? Math.round((originalTotal - codeSaving) * 100) / 100 : null;
  const showReduced = codeSaving > 0 && reducedTotal !== null && Boolean(estimate.days) && !estimate.invalid;

  // Move focus to the error summary / failure notice / success card when they appear.
  useEffect(() => {
    if (focusRequest === 0) return;
    if (errorKeys.length > 0) summaryRef.current?.focus();
    else if (status === 'failed') failureRef.current?.focus();
  }, [focusRequest, errorKeys.length, status]);

  useEffect(() => {
    if (status === 'success') {
      successRef.current?.focus();
      successRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [status]);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    const errorKey: FieldKey = key === 'privacy' ? 'privacyConsent' : (key as FieldKey);
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }

  /** Validate on blur, but do not nag about untouched empty fields. */
  function blur(key: FieldKey, value: string) {
    if (!value.trim()) return;
    const message = checkField(key, values, t);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }

  function validateAll(): Errors {
    const found: Errors = {};
    (['fullName', 'phone', 'email', 'message', 'privacyConsent'] as FieldKey[]).forEach((key) => {
      const message = checkField(key, values, t);
      if (message) found[key] = message;
    });
    if (estimate.invalid) found.desiredEndDate = t('errors.desiredEndDate.invalid');
    return found;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (sending) return;

    const found = validateAll();
    if (codeCheck.status === 'invalid') found.discountCode = reasonText(codeCheck.reason);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStatus('idle');
      setFailure(null);
      setFocusRequest((n) => n + 1);
      return;
    }

    setErrors({});
    setFailure(null);
    setStatus('sending');

    // A code that was typed but not checked for the current inputs is checked now: an invalid code
    // stops the submit (fix it or empty the field), an unreachable check does not.
    let appliedCode = codeCheck;
    if (codeValue && (checkedKey.current !== checkKey || codeCheck.status === 'checking' || codeCheck.status === 'idle')) {
      appliedCode = await checkCode();
      if (appliedCode.status === 'invalid') {
        setErrors({ discountCode: reasonText(appliedCode.reason) });
        setStatus('idle');
        setFocusRequest((n) => n + 1);
        return;
      }
    }
    const appliedRule = appliedCode.status === 'valid' ? { type: appliedCode.type, value: appliedCode.value } : null;
    const appliedSaving = appliedRule && originalTotal !== null ? discountAmount(appliedRule, originalTotal) : 0;

    const payload: SubmitContactPayload = {
      fullName: values.fullName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      vehicleOfInterest: selection.name || undefined,
      desiredStartDate: selection.from ? new Date(selection.from).toISOString() : undefined,
      desiredEndDate: selection.to ? new Date(selection.to).toISOString() : undefined,
      message: values.message.trim(),
      privacyConsent: values.privacy,
      marketingConsent: values.marketing,
      // Language of the page, so the team (and later mails) can answer in it.
      locale: f.locale as Locale,
      discountCode: codeValue || undefined,
    };

    try {
      await api.submitContact(payload);
      setSuccess({
        firstName: values.fullName.trim().split(/\s+/)[0] ?? '',
        email: values.email.trim(),
        vehicle: selection.name,
        from: selection.from,
        to: selection.to,
        days: estimate.days,
        total: originalTotal !== null ? Math.round((originalTotal - appliedSaving) * 100) / 100 : null,
        code:
          appliedRule && codeValue
            ? `${codeValue} (${
                appliedRule.type === 'PERCENT'
                  ? t('discount.percentOff', {
                      percent: f.number(appliedRule.value, Number.isInteger(appliedRule.value) ? 0 : 1),
                    })
                  : `−${f.money(appliedRule.value, { decimals: 'auto' })}`
              })`
            : null,
      });
      setStatus('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.details) {
        // Map the API's per-field messages (English) to the translated ones.
        const mapped: Errors = {};
        for (const key of Object.keys(err.details)) {
          if (isFieldKey(key)) mapped[key] = t(`errors.${key}.invalid`);
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
          setStatus('idle');
          setFocusRequest((n) => n + 1);
          return;
        }
      }
      setFailure(
        err instanceof ApiError && err.network
          ? t('failureNetwork')
          : err instanceof ApiError && err.status === 429
            ? t('failureTooMany')
            : t('failureGeneric'),
      );
      setStatus('failed');
      setFocusRequest((n) => n + 1);
    }
  }

  const estimateText = describeEstimate({
    t: tEstimate,
    locale: f.locale,
    currency,
    basePricePerDay: estimate.vehicle?.basePricePerDay ?? null,
    days: estimate.days,
    result: estimate.result,
    invalid: estimate.invalid,
  });

  // ─── Success (state 4) ───────────────────────────────────────
  if (status === 'success' && success) {
    return (
      <section id="contact-form" tabIndex={-1} className="sec bg-white outline-none">
        <div className="wrap">
          <div
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="card flex max-w-[760px] flex-col gap-5 !p-8 outline-none max-md:!p-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-ok-tint text-ok" aria-hidden="true">
                <Check size={30} strokeWidth={2.6} />
              </div>
              <div>
                <h2 className="h3 !text-[26px] max-md:!text-[22px]">
                  {success.firstName ? t('successTitleNamed', { name: success.firstName }) : t('successTitle')}
                </h2>
                <p className="mut">
                  {t.rich('successText', {
                    email: success.email,
                    addr: (chunks) => <span className="break-all">{chunks}</span>,
                  })}
                </p>
              </div>
            </div>

            {(success.vehicle || (success.from && success.to) || success.total !== null || success.code) && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 rounded-xl bg-paper p-4 text-[15px]">
                {success.vehicle && (
                  <>
                    <dt className="mut">{t('summaryVehicle')}</dt>
                    <dd className="m-0 font-semibold">{success.vehicle}</dd>
                  </>
                )}
                {success.from && success.to && (
                  <>
                    <dt className="mut">{t('summaryPeriod')}</dt>
                    <dd className="m-0 font-semibold">
                      {f.date(success.from)} – {f.date(success.to)}
                      {success.days ? ` ${t('summaryDays', { days: success.days })}` : ''}
                    </dd>
                  </>
                )}
                {success.code && (
                  <>
                    <dt className="mut">{t('discount.summaryCode')}</dt>
                    <dd className="num m-0 font-semibold">{success.code}</dd>
                  </>
                )}
                {success.total !== null && (
                  <>
                    <dt className="mut">{t('summaryEstimate')}</dt>
                    <dd className="num m-0 font-semibold">{f.money(success.total)}</dd>
                  </>
                )}
              </dl>
            )}

            <NextSteps
              steps={[
                { title: t('afterConfirmTitle'), text: t('afterConfirmText') },
                { title: t('afterCheckTitle'), text: t('afterCheckText') },
              ]}
            />

            <div className="flex flex-wrap gap-3">
              <Button href="/fahrzeuge">{t('moreVehicles')}</Button>
              <Button href="/" variant="ghost">
                {t('toHome')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── Form (states 1, 2, 3, 5, 6) ─────────────────────────────
  const showPicked = selection.picked && estimate.vehicle;

  return (
    <section id="contact-form" tabIndex={-1} className="sec bg-white outline-none">
      <div className="wrap">
        <div className="sec-head">
          <p className="kick">{label}</p>
          <h2 className="h2">{heading}</h2>
          <p className="lead">{formDescription}</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,.65fr)] items-start gap-10 max-lg:grid-cols-1 max-lg:gap-7">
          <form className="card" aria-label={t('formAria')} noValidate aria-busy={sending} onSubmit={submit}>
            <Suspense fallback={null}>
              <DiscountCodeFromUrl onCode={prefillCode} />
            </Suspense>

            {/* 2 · Eingabefehler: summary */}
            {errorKeys.length > 0 && (
              <div ref={summaryRef} tabIndex={-1} className="mb-4 outline-none">
                <Alert tone="err" title={t('summaryTitle', { count: errorKeys.length })}>
                  {f.list(errorKeys.map((key) => t(`fields.${key}`)))}.
                </Alert>
              </div>
            )}

            {/* 5 · Senden fehlgeschlagen */}
            {status === 'failed' && failure && (
              <div ref={failureRef} tabIndex={-1} className="mb-4 outline-none">
                <Alert
                  tone="err"
                  icon={<WifiOff size={20} />}
                  title={t('failedTitle')}
                  action={
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Button className="!min-h-[44px]" onClick={() => submit()}>
                        {t('resend')}
                      </Button>
                      <span className="text-sm">
                        {t('orWriteTo')}{' '}
                        <a href={`mailto:${contactEmail}`} className={mailLink}>
                          {contactEmail}
                        </a>
                      </span>
                    </div>
                  }
                >
                  {failure}
                </Alert>
              </div>
            )}

            {/* 6 · Fahrzeug vorbelegt */}
            {showPicked && (
              <Alert
                tone="info"
                icon={<Info size={20} />}
                actionPlacement="end"
                className="mb-4"
                action={
                  <Button
                    variant="ghost"
                    className="!min-h-[40px] !px-3 !text-sm"
                    onClick={() => {
                      clearVehicle();
                      vehicleSelectRef.current?.focus();
                    }}
                  >
                    {t('change')}
                  </Button>
                }
              >
                {t.rich('picked', {
                  name: estimate.vehicle?.name ?? '',
                  b: (chunks) => <b>{chunks}</b>,
                })}
              </Alert>
            )}

            <fieldset disabled={sending} className={cn('m-0 min-w-0 border-0 p-0 transition-opacity', sending && 'opacity-60')}>
              <legend className="sr-only">{t('legend')}</legend>
              <div className="grid grid-cols-2 gap-[18px] max-md:grid-cols-1 [&>.full]:col-span-full">
                <Field label={t('labels.fullName')} htmlFor={`${ids}-name`} error={fieldError('fullName')}>
                  <Input
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder={t('placeholders.fullName')}
                    value={values.fullName}
                    onChange={(event) => update('fullName', event.target.value)}
                    onBlur={() => blur('fullName', values.fullName)}
                  />
                </Field>
                <Field label={t('labels.phone')} htmlFor={`${ids}-phone`} error={fieldError('phone')}>
                  <Input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder={t('placeholders.phone')}
                    value={values.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    onBlur={() => blur('phone', values.phone)}
                  />
                </Field>
                <Field label={t('labels.email')} htmlFor={`${ids}-email`} error={fieldError('email')} className="full">
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('placeholders.email')}
                    value={values.email}
                    onChange={(event) => update('email', event.target.value)}
                    onBlur={() => blur('email', values.email)}
                  />
                </Field>

                <Field label={t('labels.vehicle')} htmlFor={`${ids}-vehicle`} className="full">
                  <Select
                    ref={vehicleSelectRef}
                    name="vehicleOfInterest"
                    value={selection.vehicleId ?? ''}
                    valid={Boolean(showPicked)}
                    onChange={(event) => setVehicleId(event.target.value || null)}
                  >
                    <option value="">{t('anyVehicle')}</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {estimate.vehicle && (
                  <div className="full">
                    <PricePill
                      label={estimateText.label}
                      price={
                        showReduced && reducedTotal !== null ? (
                          <>
                            <s className="mr-2 text-[16px] font-medium text-graphite">
                              <span className="sr-only">{t('discount.priceWas')} </span>
                              {estimateText.price}
                            </s>
                            <span className="sr-only">{t('discount.priceNow')} </span>
                            {f.money(reducedTotal)}
                          </>
                        ) : (
                          estimateText.price
                        )
                      }
                      sub={
                        showReduced && reducedTotal !== null && estimate.days
                          ? t('discount.pillSub', { label: codeLabel, perDay: f.money(reducedTotal / estimate.days) })
                          : estimateText.sub
                      }
                      live
                    />
                  </div>
                )}

                <Field label={t('labels.start')} htmlFor={`${ids}-from`} error={fieldError('desiredStartDate')}>
                  <Input
                    name="desiredStartDate"
                    type="date"
                    value={selection.from}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      if (errors.desiredStartDate || errors.desiredEndDate) {
                        setErrors((prev) => ({ ...prev, desiredStartDate: undefined, desiredEndDate: undefined }));
                      }
                    }}
                  />
                </Field>
                <Field label={t('labels.end')} htmlFor={`${ids}-to`} error={fieldError('desiredEndDate')}>
                  <Input
                    name="desiredEndDate"
                    type="date"
                    min={selection.from || undefined}
                    value={selection.to}
                    onChange={(event) => {
                      setTo(event.target.value);
                      if (errors.desiredEndDate) setErrors((prev) => ({ ...prev, desiredEndDate: undefined }));
                    }}
                  />
                </Field>

                {/* Optional discount code: checked live against the API, sent with the request */}
                <Field
                  label={
                    <>
                      {t('labels.discountCode')} <span className="mut font-normal">{t('optional')}</span>
                    </>
                  }
                  htmlFor={`${ids}-code`}
                  error={fieldError('discountCode') ?? (codeCheck.status === 'invalid' ? reasonText(codeCheck.reason) : undefined)}
                  hint={codeValue ? undefined : t('discount.hint')}
                  className="full"
                >
                  <div className="flex gap-2.5">
                    <Input
                      name="discountCode"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={40}
                      placeholder={t('placeholders.discountCode')}
                      value={code}
                      valid={codeCheck.status === 'valid'}
                      className="min-w-0 flex-1 uppercase placeholder:normal-case"
                      onChange={(event) => changeCode(event.target.value)}
                      onBlur={() => {
                        if (codeValue.length >= CODE_MIN_LENGTH) {
                          setCodeActive(true);
                          if (checkedKey.current !== checkKey) void checkCode();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          // Enter checks the code instead of sending the whole form.
                          event.preventDefault();
                          checkNow();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      aria-label={t('discount.checkAria')}
                      loading={codeCheck.status === 'checking'}
                      disabled={!codeValue}
                      className="!min-h-[52px] flex-none !px-4"
                      onClick={checkNow}
                    >
                      {t('discount.check')}
                    </Button>
                  </div>
                  <div aria-live="polite" className="empty:hidden">
                    {codeCheck.status === 'checking' && (
                      <p className="hint flex items-center gap-2">
                        <Spinner size={14} />
                        {t('discount.checking')}
                      </p>
                    )}
                    {codeCheck.status === 'valid' && (
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                        <Check size={16} strokeWidth={2.6} className="flex-none" aria-hidden="true" />
                        {t('discount.valid', { label: codeLabel })}
                      </p>
                    )}
                    {codeCheck.status === 'unavailable' && <p className="hint">{t('discount.unavailable')}</p>}
                  </div>
                </Field>

                <Field label={t('labels.message')} htmlFor={`${ids}-message`} error={fieldError('message')} className="full">
                  <Textarea
                    name="message"
                    rows={4}
                    placeholder={t('placeholders.message')}
                    value={values.message}
                    onChange={(event) => update('message', event.target.value)}
                    onBlur={() => blur('message', values.message)}
                  />
                </Field>

                {/* FADP/GDPR mandatory privacy consent */}
                <Field htmlFor={`${ids}-privacy`} error={fieldError('privacyConsent')} className="full">
                  <Checkbox
                    name="privacyConsent"
                    checked={values.privacy}
                    onChange={(event) => update('privacy', event.target.checked)}
                    label={
                      <>
                        <span className="block">
                          {t.rich('privacyLabel', {
                            link: (chunks) => (
                              <Link
                                href="/privacy"
                                target="_blank"
                                rel="noopener"
                                className="font-medium text-ruby-dark underline underline-offset-2"
                              >
                                {chunks}
                              </Link>
                            ),
                            sr: (chunks) => <span className="sr-only">{chunks}</span>,
                          })}
                        </span>
                        <span className="mt-1 block text-[13px] leading-[1.45] text-graphite">{t('privacyDetail')}</span>
                      </>
                    }
                  />
                </Field>

                {/* Optional marketing consent (separate per FADP) */}
                <div className="full">
                  <Checkbox
                    name="marketingConsent"
                    checked={values.marketing}
                    onChange={(event) => update('marketing', event.target.checked)}
                    label={
                      <>
                        {t('marketingLabel')} <span className="mut">{t('optional')}</span>
                        <span className="mt-1 block text-[13px] leading-[1.45] text-graphite">
                          {t('marketingDetail')}
                        </span>
                      </>
                    }
                  />
                </div>
              </div>
            </fieldset>

            <div className="mt-[18px]">
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={sending}
                disabled={!ready && !sending}
                aria-describedby={!ready ? `${ids}-hint` : undefined}
                className={cn(sending && '!bg-ruby-dark gap-3')}
              >
                {sending ? t('sending') : ctaText}
              </Button>
              {!ready && !sending && (
                <p id={`${ids}-hint`} className="hint mt-2">
                  {t('readyHint')}
                </p>
              )}
              {sending && <p className="hint mt-2 text-center">{t('dontClose')}</p>}
              {trustLine && !sending && <p className="mt-3 text-center text-[13px] text-graphite">{trustLine}</p>}
            </div>
          </form>

          <aside className="card flex flex-col gap-5 max-md:gap-[18px]" aria-label={t('asideTitle')}>
            <h3 className="h3">{t('asideTitle')}</h3>
            <NextSteps
              steps={[
                { title: t('nextConfirmTitle'), text: t('nextConfirmText') },
                { title: t('nextCheckTitle'), text: t('nextCheckText') },
                { title: t('nextHandoverTitle'), text: t('nextHandoverText') },
              ]}
            />
          </aside>
        </div>
      </div>
    </section>
  );
}
