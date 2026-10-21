'use client';

/**
 * Preisregeln: the real day-tier discounts applied to every booking (not the marketing copy above).
 * Rules are created, edited and deleted one by one against the API. Day ranges must not overlap:
 * the panel warns while editing and blocks saving a rule that overlaps another or has an inverted range.
 */
import { Percent, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Field, IconButton, Input, SkeletonRows, useConfirm, useToast } from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { orUserError } from '@/lib/content-errors';
import { errorText } from '@/lib/errors';
import { ruleProblems, type PricingRule } from '@/lib/settings-defaults';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

export function PricingRulesPanel() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data: PricingRule[] = await api.getPricingRules();
      setRules([...data].sort((a, b) => a.fromDay - b.fromDay));
    } catch (err) {
      // Leave the list empty: new rules can still be added
      setLoadError(errorText(err, tr('settings.diePreisregelnKonntenNicht')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const problems = useMemo(() => ruleProblems(rules), [rules]);
  const hasProblems = Object.keys(problems).length > 0;

  function updateRuleField(id: string, field: 'fromDay' | 'toDay' | 'discountPercent', value: number | null) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleAddRule() {
    setAdding(true);
    try {
      const created = await api.createPricingRule({ fromDay: 1, toDay: null, discountPercent: 0 });
      setRules((prev) => [...prev, created].sort((a, b) => a.fromDay - b.fromDay));
      toast.info(tr('settings.preisregelAngelegt'), tr('settings.passenSieDieTage'));
    } catch (err) {
      toast.error(tr('settings.regelKonnteNichtErstellt'), errorText(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveRule(rule: PricingRule) {
    if (problems[rule.id]) return;
    setSavingId(rule.id);
    try {
      await api.updatePricingRule(rule.id, {
        fromDay: rule.fromDay,
        toDay: rule.toDay,
        discountPercent: rule.discountPercent,
      });
      toast.success(tr('settings.preisregelGespeichert'));
    } catch (err) {
      toast.error(tr('settings.regelKonnteNichtGespeichert'), errorText(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteRule(rule: PricingRule) {
    const range = rule.toDay === null ? tr('settings.abTag', { fromDay: rule.fromDay }) : tr('settings.tagBis', { fromDay: rule.fromDay, toDay: rule.toDay });
    const ok = await confirm({
      title: tr('settings.preisregelLoeschen'),
      description: tr('settings.dieRegelMitRabatt', { range, discountPercent: rule.discountPercent }),
      confirmLabel: tr('settings.regelLoeschen'),
      icon: <Trash2 size={20} />,
      onConfirm: () => orUserError(api.deletePricingRule(rule.id), tr('settings.dieRegelKonnteNicht')),
    });
    if (!ok) return;
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    toast.success(tr('settings.preisregelGeloescht'));
  }

  return (
    <section className="panel" aria-labelledby="rules-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="rules-h">
            {t('settings.preisregeln')}
          </h2>
          <p className="sm mut mt-0.5">
            {t('settings.dieseStaffelungWirdTatsaechlic')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={adding}
          onClick={() => void handleAddRule()}
          iconLeft={<Plus size={18} aria-hidden="true" />}
        >
          {t('settings.preisregelHinzufuegen')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {loadError && (
          <Alert
            tone="err"
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {t('common.erneutVersuchen')}
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}

        {hasProblems && (
          <Alert tone="warn" title={t('settings.dieTagBereicheSind')}>
            {t('settings.speichernIstFuerBetroffene')}
          </Alert>
        )}

        {loading ? (
          <SkeletonRows rows={3} avatar={false} label={t('settings.preisregelnWerdenGeladen')} />
        ) : rules.length === 0 && !loadError ? (
          <p className="mut flex items-center gap-2 py-2">
            <Percent size={18} aria-hidden="true" /> {t('settings.keinePreisregelnVorhanden')}
          </p>
        ) : (
          rules.map((rule, index) => {
            const problem = problems[rule.id];
            return (
              <div
                key={rule.id}
                role="group"
                aria-label={t('settings.preisregel', { value: index + 1 })}
                className="rounded-xl border border-line bg-row p-3.5"
              >
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-3 max-md:grid-cols-2">
                  <Field label={t('settings.abTag2')}>
                    <Input
                      type="number"
                      min={1}
                      value={rule.fromDay}
                      invalid={Boolean(problem)}
                      onChange={(e) => updateRuleField(rule.id, 'fromDay', Number(e.target.value) || 1)}
                    />
                  </Field>
                  <Field label={t('settings.bisTagLeerUnbegrenzt')}>
                    <Input
                      type="number"
                      min={1}
                      value={rule.toDay ?? ''}
                      invalid={Boolean(problem)}
                      onChange={(e) => updateRuleField(rule.id, 'toDay', e.target.value ? Number(e.target.value) : null)}
                      placeholder={t('settings.unbegrenzt')}
                    />
                  </Field>
                  <Field label={t('settings.rabatt')}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={rule.discountPercent}
                      onChange={(e) => updateRuleField(rule.id, 'discountPercent', Number(e.target.value) || 0)}
                    />
                  </Field>
                  <div className="flex items-center gap-1.5 max-md:col-span-2 max-md:justify-end">
                    <Button
                      size="sm"
                      loading={savingId === rule.id}
                      disabled={Boolean(problem)}
                      onClick={() => void handleSaveRule(rule)}
                      aria-label={t('settings.preisregelSpeichern', { value: index + 1 })}
                    >
                      {t('common.speichern')}
                    </Button>
                    <IconButton aria-label={t('settings.preisregelLoeschen2', { value: index + 1 })} onClick={() => void handleDeleteRule(rule)} className="text-err">
                      <Trash2 size={20} aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
                {problem && (
                  <p className="errm mt-2" role="alert">
                    {problem}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
