'use client';

/**
 * "Rechnung erstellen" for a fine: the fine amount (passed on at cost, no VAT) plus optional fees from
 * the catalog (typically "Bearbeitung Busse"). The invoice goes to the assigned renter; QR bill and
 * e-mail are options. A refused QR bill (creditor data incomplete) is explained with a link to the settings.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CreateFineInvoiceRequest, FeeDto, FineDto, FineInvoiceResultDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Checkbox, Field, Input, Modal, Skeleton, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtMoney } from '@/lib/format';
import { computeTotals, newLineKey, qrBillError, qrMissingList, type InvoiceLine } from '@/lib/invoice-model';
import { fmtFineTime } from '@/lib/fine-model';
import { formatPlate } from '@/lib/plate';
import { tr } from '@/i18n/active';

export function FineInvoiceModal({
  fine,
  onClose,
  onCreated,
}: {
  fine: FineDto;
  onClose: () => void;
  onCreated: (result: FineInvoiceResultDto, options: { sendEmail: boolean }) => void;
}) {
  const t = useTranslations();
  const [fees, setFees] = useState<FeeDto[] | null>(null);
  const [selectedFees, setSelectedFees] = useState<Set<string>>(new Set());
  const [vatDefault, setVatDefault] = useState(8.1);
  const [withQr, setWithQr] = useState(false);
  const email = fine.booking?.customerEmail?.trim() || '';
  const [sendEmail, setSendEmail] = useState(Boolean(email));
  const [dueDays, setDueDays] = useState('');
  const [dueDefault, setDueDefault] = useState(30);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; missing?: string[] } | null>(null);
  const [dueError, setDueError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getFees({ activeOnly: true })
      .then((rows) => {
        if (!alive) return;
        // Admin-fee entries first, then the rest alphabetically.
        setFees(rows.slice().sort((a, b) => (a.category === 'FINE_ADMIN' ? -1 : 0) - (b.category === 'FINE_ADMIN' ? -1 : 0) || a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (alive) setFees([]);
      });
    api
      .getSetting('invoice_settings')
      .then((s) => {
        if (!alive) return;
        const vat = Number(s?.vatRate);
        const due = Number(s?.dueDays);
        if (Number.isFinite(vat) && vat >= 0) setVatDefault(vat);
        if (Number.isFinite(due) && due > 0) setDueDefault(due);
        setWithQr(s?.defaultWithQrBill === true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const chosen = useMemo(() => (fees ?? []).filter((f) => selectedFees.has(f.id)), [fees, selectedFees]);
  const totals = useMemo(() => {
    const lines: InvoiceLine[] = [
      { key: 'fine', description: 'fine', quantity: '1', unitPrice: String(fine.amount), vat: '0' },
      ...chosen.map((f) => ({
        key: newLineKey(),
        description: f.name,
        quantity: '1',
        unitPrice: String(f.defaultAmount),
        vat: f.vatRate === null ? String(vatDefault) : String(f.vatRate),
      })),
    ];
    return computeTotals(lines, vatDefault);
  }, [fine.amount, chosen, vatDefault]);

  function toggle(id: string, on: boolean) {
    setSelectedFees((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (dueDays.trim() !== '' && !(Number.isInteger(Number(dueDays)) && Number(dueDays) >= 0 && Number(dueDays) <= 365)) {
      setDueError(t('invoiceEditor.errDueDays'));
      return;
    }
    setDueError(null);
    setSaving(true);
    setError(null);
    const body: CreateFineInvoiceRequest = {
      feeIds: [...selectedFees],
      sendEmail: sendEmail && Boolean(email),
      withQrBill: withQr,
      ...(dueDays.trim() !== '' ? { dueDays: Number(dueDays) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try {
      const result = await api.createFineInvoice(fine.id, body);
      onCreated(result, { sendEmail: body.sendEmail === true });
    } catch (err) {
      const qr = qrBillError(err);
      if (qr) setError({ text: qr.missing.length > 0 ? tr('invoiceEditor.qrUnavailable') : qr.message || tr('invoiceEditor.qrUnavailable'), missing: qr.missing });
      else setError({ text: errorText(err, tr('fines.invoice.failed')) });
    } finally {
      setSaving(false);
    }
  }

  const currency = fine.currency;

  return (
    <Modal
      open
      onClose={onClose}
      title={t('fines.invoice.title')}
      description={t('fines.invoice.text', { name: fine.booking?.customerName ?? '–' })}
      size="md"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="fine-invoice-form" loading={saving}>
            {t('common.rechnungErstellen')}
          </Button>
        </>
      }
    >
      <form id="fine-invoice-form" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && (
          <Alert
            tone="err"
            action={
              error.missing ? (
                <Button href="/settings#invoice-h" variant="outline" size="sm">
                  {t('invoiceEditor.openInvoiceSettings')}
                </Button>
              ) : undefined
            }
          >
            {error.text}
            {error.missing && error.missing.length > 0 && (
              <>
                {' '}
                <b>{t('invoiceEditor.qrMissingList', { list: qrMissingList(error.missing) })}</b>
              </>
            )}
          </Alert>
        )}

        <div className="rounded-xl border border-line p-3.5 text-sm">
          <b className="font-semibold">{t('fines.invoice.fineLine')}</b>
          <p className="sm mut">
            {[fine.reference ? `${t('fines.reference')} ${fine.reference}` : null, fine.authority || null, formatPlate(fine.licensePlate), fmtFineTime(fine.occurredAt)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="num mt-1">
            {fmtMoney(fine.amount, { currency })} <span className="mut">· {t('fines.invoice.noVat')}</span>
          </p>
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="lbl mb-1">{t('fines.invoice.fees')}</legend>
          {fees === null ? (
            <Skeleton className="h-[88px] w-full" rounded={12} />
          ) : fees.length === 0 ? (
            <p className="sm mut">{t('fines.invoice.noFees')}</p>
          ) : (
            fees.map((fee) => (
              <Checkbox
                key={fee.id}
                checked={selectedFees.has(fee.id)}
                onChange={(e) => toggle(fee.id, e.target.checked)}
                label={
                  <span>
                    {fee.name} <span className="num mut">· {fmtMoney(fee.defaultAmount, { currency })}</span>
                    <span className="mut"> · {fee.vatRate === null ? t('fees.vatDefault', { rate: String(vatDefault) }) : `${fee.vatRate} %`}</span>
                  </span>
                }
              />
            ))
          )}
          <p className="hint">{t('fines.invoice.feesHint')}</p>
        </fieldset>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-xl bg-row px-4 py-3.5" aria-label={t('invoiceEditor.totalsTitle')}>
          <dt className="mut">{t('invoiceEditor.subtotal')}</dt>
          <dd className="num text-right">{fmtMoney(totals.subtotal, { currency })}</dd>
          {totals.vatBreakdown
            .filter((g) => g.rate > 0 && g.base > 0)
            .map((g) => (
              <VatRow key={g.rate} label={t('invoiceEditor.vatRow', { rate: g.rate })} amount={fmtMoney(g.amount, { currency })} />
            ))}
          <dt className="font-semibold">{t('invoiceEditor.total')}</dt>
          <dd className="num text-right text-lg font-bold">{fmtMoney(totals.total, { currency })}</dd>
        </dl>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('invoiceEditor.dueDays')} hint={t('invoiceEditor.dueDaysHint', { days: dueDefault })} error={dueError}>
            <Input type="number" inputMode="numeric" min="0" max="365" step="1" value={dueDays} placeholder={String(dueDefault)} onChange={(e) => setDueDays(e.target.value)} className="num" />
          </Field>
        </div>
        <Field label={t('invoiceEditor.notes')} hint={t('invoiceEditor.notesHint')}>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>

        <div className="flex flex-col gap-1">
          <Checkbox checked={withQr} onChange={(e) => setWithQr(e.target.checked)} label={t('invoiceEditor.withQr')} />
          <p className="hint -mt-1 pl-[34px]">{t('invoiceEditor.withQrHint')}</p>
          <Checkbox
            checked={sendEmail && Boolean(email)}
            disabled={!email}
            onChange={(e) => setSendEmail(e.target.checked)}
            label={email ? t('invoiceEditor.sendEmailTo', { email }) : t('invoiceEditor.sendEmailNone')}
          />
        </div>
      </form>
    </Modal>
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
