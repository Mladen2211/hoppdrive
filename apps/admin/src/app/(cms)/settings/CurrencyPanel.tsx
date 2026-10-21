'use client';

/**
 * Einstellungen > Website > Währung. CHF or EUR for the whole business. Saving relabels the currency of
 * EVERY vehicle (the prices are NOT converted); existing bookings and invoices keep their own currency,
 * new ones use the active one. A confirmation spells that out before anything changes.
 */
import { Coins } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CURRENCY_CODES, type CurrencyCode } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Select, Skeleton, useConfirm, useToast } from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { setCurrencyCache } from '@/hooks/useCurrency';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtMoney } from '@/lib/format';
import { tr } from '@/i18n/active';

export function CurrencyPanel() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [saved, setSaved] = useState<CurrencyCode | null>(null);
  const [selected, setSelected] = useState<CurrencyCode>('CHF');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api
      .getCurrency()
      .then((setting) => {
        if (!alive) return;
        const code: CurrencyCode = setting?.code === 'EUR' ? 'EUR' : 'CHF';
        setSaved(code);
        setSelected(code);
      })
      .catch((err) => {
        if (alive) setLoadError(errorText(err, tr('settings.currency.loadFailed')));
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const dirty = saved !== null && selected !== saved;

  async function handleSave() {
    if (!dirty || !saved) return;
    const from = saved;
    const to = selected;
    const done = await confirm({
      title: t('settings.currency.confirmTitle', { code: to }),
      description: t('settings.currency.confirmText', { from, to }),
      warning: t.rich('settings.currency.confirmWarning', {
        from,
        to,
        example: fmtMoney(79, { currency: from }),
        result: fmtMoney(79, { currency: to }),
        b: (chunks) => <b>{chunks}</b>,
      }),
      confirmLabel: t('settings.currency.confirmAction', { code: to }),
      tone: 'primary',
      icon: <Coins size={20} />,
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.setCurrency(to);
        } catch (err) {
          throw new Error(errorText(err, tr('settings.currency.saveFailed')));
        } finally {
          setSaving(false);
        }
      },
    });
    if (!done) return;
    setSaved(to);
    setCurrencyCache(to);
    toast.success(t('settings.currency.saved'), t('settings.currency.savedText', { code: to }));
  }

  return (
    <section className="panel" aria-labelledby="currency-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="currency-h">
            {t('settings.currency.title')}
          </h2>
          <p className="sm mut mt-0.5">{t('settings.currency.subtitle')}</p>
        </div>
        <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void handleSave()}>
          {t('common.speichern')}
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {loadError && <Alert tone="warn">{loadError}</Alert>}
        {saved === null && !loadError ? (
          <Skeleton className="h-11 w-full max-w-[360px]" rounded={10} />
        ) : (
          <Field label={t('settings.currency.label')} hint={t('settings.currency.hint')} className="max-w-[360px]">
            <Select value={selected} onChange={(e) => setSelected(e.target.value as CurrencyCode)} disabled={saved === null}>
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} · {t(`settings.currency.names.${code}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Alert tone="info">{t('settings.currency.note')}</Alert>
      </div>
    </section>
  );
}
