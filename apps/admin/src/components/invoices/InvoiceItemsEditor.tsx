'use client';

/**
 * Line items of a damage / fine / other invoice: description, quantity, unit price (net), VAT %, line
 * total. Lines can be typed, taken from the fee catalog or from the damages of the booking's vehicle.
 * The totals block shows net, VAT per rate and the total in the invoice currency.
 */
import { Plus, Trash2 } from 'lucide-react';
import type { FeeDto, VehicleDamageDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, IconButton, Input, Select, StatusPill } from '@/components/ui';
import { fmtMoney } from '@/lib/format';
import {
  emptyLine,
  lineFromDamage,
  lineFromFee,
  type EditorErrors,
  type InvoiceLine,
  type InvoiceTotals,
} from '@/lib/invoice-model';

export interface InvoiceItemsEditorProps {
  lines: InvoiceLine[];
  onChange: (lines: InvoiceLine[]) => void;
  totals: InvoiceTotals;
  currency: string;
  defaultVat: number;
  /** VAT preset of a new empty line ('0' for fines). */
  newLineVat: string;
  errors: EditorErrors;
  fees: FeeDto[];
  damages: VehicleDamageDto[] | null;
  /** Booking the damages belong to, for the "found during this rental" hint. */
  bookingId: string;
  disabled?: boolean;
}

export function InvoiceItemsEditor({
  lines,
  onChange,
  totals,
  currency,
  defaultVat,
  newLineVat,
  errors,
  fees,
  damages,
  bookingId,
  disabled,
}: InvoiceItemsEditorProps) {
  const t = useTranslations();

  const patch = (key: string, change: Partial<InvoiceLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));
  const usedDamage = new Set(lines.map((l) => l.damageId).filter(Boolean));
  const foundHere = (dmg: VehicleDamageDto) => Boolean(bookingId) && dmg.discoveredBookingId === bookingId;
  const damageOptions = (damages ?? [])
    .filter((d) => !usedDamage.has(d.id))
    .sort((a, b) => Number(foundHere(b)) - Number(foundHere(a)) || Number(a.status === 'REPAIRED') - Number(b.status === 'REPAIRED'));

  return (
    <section aria-labelledby="inv-items-h" className="flex flex-col gap-3">
      <h3 id="inv-items-h" className="text-[15px] font-semibold">
        {t('invoiceEditor.itemsTitle')}
      </h3>
      {errors.items && (
        <p className="errm" role="alert">
          {t(errors.items)}
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {lines.map((line, index) => {
          const e = errors.lines[line.key] ?? {};
          const total = totals.lines[index]?.total ?? 0;
          return (
            <li key={line.key} className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <Field label={t('invoiceEditor.description')} error={e.description ? t(e.description) : undefined} className="min-w-0 flex-1">
                  <Input
                    value={line.description}
                    onChange={(ev) => patch(line.key, { description: ev.target.value })}
                    maxLength={500}
                    disabled={disabled}
                    autoComplete="off"
                    placeholder={t('invoiceEditor.descriptionPlaceholder')}
                  />
                </Field>
                <IconButton
                  aria-label={t('invoiceEditor.removeItem', { number: index + 1 })}
                  className="mt-[26px] max-md:mt-[26px]"
                  disabled={disabled}
                  onClick={() => remove(line.key)}
                >
                  <Trash2 size={20} aria-hidden="true" />
                </IconButton>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)_96px_minmax(0,1fr)] items-start gap-3 max-sm:grid-cols-2">
                <Field label={t('invoiceEditor.quantity')} error={e.quantity ? t(e.quantity) : undefined}>
                  <Input type="number" inputMode="decimal" min="0" step="any" value={line.quantity} disabled={disabled} onChange={(ev) => patch(line.key, { quantity: ev.target.value })} className="num" />
                </Field>
                <Field label={t('invoiceEditor.unitPrice', { currency })} error={e.unitPrice ? t(e.unitPrice) : undefined}>
                  <Input type="number" inputMode="decimal" step="0.05" value={line.unitPrice} disabled={disabled} onChange={(ev) => patch(line.key, { unitPrice: ev.target.value })} placeholder="0.00" className="num" />
                </Field>
                <Field label={t('invoiceEditor.vat')} error={e.vat ? t(e.vat) : undefined}>
                  <Input type="number" inputMode="decimal" min="0" max="100" step="0.1" value={line.vat} disabled={disabled} placeholder={String(defaultVat)} onChange={(ev) => patch(line.key, { vat: ev.target.value })} className="num" />
                </Field>
                <div className="fld">
                  <span className="lbl">{t('invoiceEditor.lineTotal')}</span>
                  <output className="num flex min-h-[44px] items-center text-base font-semibold max-md:min-h-[48px]">{fmtMoney(total, { currency })}</output>
                </div>
              </div>
              {(line.feeId || line.damageId) && (
                <div className="flex flex-wrap gap-2">
                  {line.feeId && <StatusPill tone="gray" plain label={t('invoiceEditor.fromFee')} />}
                  {line.damageId && <StatusPill tone="gray" plain label={t('invoiceEditor.fromDamage')} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="sm" disabled={disabled} iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => onChange([...lines, emptyLine(newLineVat)])}>
          {t('invoiceEditor.addItem')}
        </Button>
        {fees.length > 0 && (
          <Select
            aria-label={t('invoiceEditor.addFee')}
            className="!w-auto min-w-[220px] max-sm:!w-full"
            value=""
            disabled={disabled}
            onChange={(ev) => {
              const fee = fees.find((f) => f.id === ev.target.value);
              if (fee) onChange([...lines.filter((l) => l.description.trim() || l.unitPrice.trim() || l.feeId || l.damageId), lineFromFee(fee, defaultVat)]);
            }}
          >
            <option value="">{t('invoiceEditor.addFee')}</option>
            {fees.map((fee) => (
              <option key={fee.id} value={fee.id}>
                {fee.name} · {fmtMoney(fee.defaultAmount, { currency })}
              </option>
            ))}
          </Select>
        )}
        {damages !== null && damageOptions.length > 0 && (
          <Select
            aria-label={t('invoiceEditor.addDamage')}
            className="!w-auto min-w-[220px] max-sm:!w-full"
            value=""
            disabled={disabled}
            onChange={(ev) => {
              const damage = damageOptions.find((d) => d.id === ev.target.value);
              if (damage) onChange([...lines.filter((l) => l.description.trim() || l.unitPrice.trim() || l.feeId || l.damageId), lineFromDamage(damage, newLineVat)]);
            }}
          >
            <option value="">{t('invoiceEditor.addDamage')}</option>
            {damageOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {t(`invoiceEditor.damageType.${d.type}`)} · {d.zone}
                {d.discoveredBookingId && d.discoveredBookingId === bookingId ? ` · ${t('invoiceEditor.thisRental')}` : ''}
                {d.status === 'REPAIRED' ? ` · ${t('invoiceEditor.repaired')}` : ''}
              </option>
            ))}
          </Select>
        )}
      </div>

      {damages !== null && damages.length === 0 && bookingId && <p className="sm mut">{t('invoiceEditor.noDamages')}</p>}

      <dl className="ml-auto grid w-full max-w-[360px] grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-xl bg-row px-4 py-3.5" aria-label={t('invoiceEditor.totalsTitle')}>
        <dt className="mut">{t('invoiceEditor.subtotal')}</dt>
        <dd className="num text-right">{fmtMoney(totals.subtotal, { currency })}</dd>
        {totals.vatBreakdown.map((g) => (
          <VatRow key={g.rate} label={t('invoiceEditor.vatRow', { rate: g.rate })} amount={fmtMoney(g.amount, { currency })} />
        ))}
        <dt className="font-semibold">{t('invoiceEditor.total')}</dt>
        <dd className="num text-right text-lg font-bold">{fmtMoney(totals.total, { currency })}</dd>
      </dl>
      {errors.total && <Alert tone="warn">{t(errors.total)}</Alert>}
    </section>
  );
}

function VatRow({ label, amount }: { label: string; amount: string }) {
  return (
    <>
      <dt className="mut">{label}</dt>
      <dd className="num text-right">{amount}</dd>
    </>
  );
}
