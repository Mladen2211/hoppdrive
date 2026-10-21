'use client';

/**
 * Discount code input with LIVE validation (GET /discount-codes/validate, debounced). It tells right away
 * whether the code can be used and, when a price is known, what the reduced price is:
 *
 *   <DiscountCodeField value={code} onChange={setCode} email={email} vehicleId={vehicleId} days={days}
 *                      currency="CHF" basePrice={price} onResult={setResult} />
 *
 * `basePrice` is the price BEFORE the discount (the entered price or the quote); the reduction is computed
 * with the same rule as the server, so the line matches what is booked.
 */
import { Check, CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { DiscountValidationDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Field, Input, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { describeDiscount, discountAmount, discountReasonText } from '@/lib/discount';
import { fmtMoney } from '@/lib/format';

export interface DiscountCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Customer address: personal codes and the per-address limit need it. */
  email?: string;
  vehicleId?: string;
  days?: number;
  currency: string;
  /** Price before the discount, for the "Preis nach Rabatt" line. */
  basePrice?: number | null;
  /** Latest validation result (null = nothing to validate or still checking). */
  onResult?: (result: DiscountValidationDto | null) => void;
  /** A server-side error to show under the field (e.g. 422 discount_invalid on save). */
  error?: string | null;
  label?: ReactNode;
  disabled?: boolean;
  /** Extra control next to the input (e.g. a remove button). */
  action?: ReactNode;
}

type State = { phase: 'idle' } | { phase: 'checking' } | { phase: 'done'; result: DiscountValidationDto } | { phase: 'failed' };

export function DiscountCodeField({
  value,
  onChange,
  email,
  vehicleId,
  days,
  currency,
  basePrice,
  onResult,
  error,
  label,
  disabled,
  action,
}: DiscountCodeFieldProps) {
  const t = useTranslations();
  const [state, setState] = useState<State>({ phase: 'idle' });
  const liveId = useId();
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  const code = value.trim();
  useEffect(() => {
    if (code.length < 3) {
      setState({ phase: 'idle' });
      resultRef.current?.(null);
      return;
    }
    let alive = true;
    setState({ phase: 'checking' });
    resultRef.current?.(null);
    const timer = window.setTimeout(() => {
      api
        .validateDiscountCode({
          code,
          email: email?.trim() || undefined,
          vehicleId: vehicleId || undefined,
          days: days && days > 0 ? days : undefined,
        })
        .then((result) => {
          if (!alive) return;
          setState({ phase: 'done', result });
          resultRef.current?.(result);
        })
        .catch(() => {
          if (!alive) return;
          setState({ phase: 'failed' });
          resultRef.current?.(null);
        });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code, email, vehicleId, days]);

  let status: ReactNode = null;
  if (state.phase === 'checking') {
    status = (
      <span className="inline-flex items-center gap-1.5 text-graphite">
        <Spinner size={14} />
        {t('discount.checking')}
      </span>
    );
  } else if (state.phase === 'failed') {
    status = <span className="text-graphite">{t('discount.checkFailed')}</span>;
  } else if (state.phase === 'done') {
    const result = state.result;
    if (result.valid) {
      const known = basePrice !== null && basePrice !== undefined && Number.isFinite(basePrice);
      const reduction = known ? discountAmount(result.type, result.value, basePrice as number) : result.discount;
      status = (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-ok">
          <Check size={16} aria-hidden="true" />
          {t('discount.valid', { discount: describeDiscount(result.type, result.value, result.currency ?? currency) })}
          {reduction !== null && reduction !== undefined && (
            <span className="font-normal text-ink">
              {known
                ? t('discount.reducedPrice', {
                    discount: fmtMoney(reduction, { currency }),
                    price: fmtMoney(Math.max(0, (basePrice as number) - reduction), { currency }),
                  })
                : t('discount.reductionOnly', { discount: fmtMoney(reduction, { currency }) })}
            </span>
          )}
        </span>
      );
    } else {
      status = (
        <span className="inline-flex items-start gap-1.5 font-semibold text-err-strong">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          {discountReasonText(result.reason, result.message)}
        </span>
      );
    }
  }

  return (
    <Field
      label={label ?? t('discount.label')}
      hint={
        <span id={liveId} aria-live="polite" className="block">
          {status ?? t('discount.hint')}
        </span>
      }
      error={error}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled}
          maxLength={40}
          placeholder="HD-XXXX-XXXX"
          className="num uppercase"
        />
        {action}
      </div>
    </Field>
  );
}
