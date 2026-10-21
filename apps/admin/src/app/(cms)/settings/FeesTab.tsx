'use client';

/**
 * Einstellungen > Gebühren (?tab=fees, permission area websiteSettings): the fee catalog that invoices
 * and fines draw from (Schadenpauschale, Selbstbehalt, Bearbeitung Busse, Reinigung …).
 * Table from 768 px, cards below. Active switch per row, create / edit modal, delete with confirmation.
 * Without the "edit" level the catalog is shown read-only.
 */
import { Coins, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FEE_CATEGORY_LABELS, type CreateFeeRequest, type FeeCategory, type FeeDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Cell2,
  ChipGroup,
  EmptyState,
  Field,
  IconButton,
  Input,
  MobileCard,
  Modal,
  ResponsiveList,
  Select,
  SkeletonRows,
  StatusPill,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useConfirm,
  useToast,
} from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtMoney } from '@/lib/format';
import { feeFormToRequest, feeToForm, EMPTY_FEE_FORM, validateFeeForm, type FeeForm, type FeeFormErrors } from '@/lib/fee-model';
import { tr } from '@/i18n/active';

const CATEGORIES = Object.keys(FEE_CATEGORY_LABELS) as FeeCategory[];

export function FeesTab() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const currency = useCurrency();
  const canEdit = useCan('websiteSettings', 'edit');

  const [fees, setFees] = useState<FeeDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [defaultVat, setDefaultVat] = useState<number | null>(null);
  const [category, setCategory] = useState<'all' | FeeCategory>('all');
  const [editing, setEditing] = useState<FeeDto | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFees(await api.getFees());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, tr('fees.loadFailed')));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void load();
    api
      .getSetting('invoice_settings')
      .then((s) => {
        const rate = Number(s?.vatRate);
        setDefaultVat(Number.isFinite(rate) ? rate : 8.1);
      })
      .catch(() => setDefaultVat(8.1));
  }, [token, load]);

  const counts = useMemo(() => {
    const map = new Map<FeeCategory, number>();
    (fees ?? []).forEach((f) => map.set(f.category, (map.get(f.category) ?? 0) + 1));
    return map;
  }, [fees]);

  const visible = useMemo(() => (fees ?? []).filter((f) => category === 'all' || f.category === category), [fees, category]);

  const vatText = (fee: FeeDto) =>
    fee.vatRate === null ? t('fees.vatDefault', { rate: defaultVat === null ? '…' : `${defaultVat}` }) : `${fee.vatRate} %`;

  async function toggleActive(fee: FeeDto, active: boolean) {
    setBusyId(fee.id);
    setFees((rows) => (rows ?? []).map((f) => (f.id === fee.id ? { ...f, active } : f)));
    try {
      await api.updateFee(fee.id, { active });
      toast.success(active ? tr('fees.activated') : tr('fees.deactivated'), fee.name);
    } catch (err) {
      setFees((rows) => (rows ?? []).map((f) => (f.id === fee.id ? { ...f, active: fee.active } : f)));
      toast.error(tr('fees.updateFailed'), errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(fee: FeeDto) {
    const done = await confirm({
      title: t('fees.deleteTitle', { name: fee.name }),
      description: t('fees.deleteText'),
      confirmLabel: t('fees.delete'),
      onConfirm: async () => {
        try {
          await api.deleteFee(fee.id);
        } catch (err) {
          throw new Error(errorText(err, tr('fees.deleteFailed')));
        }
      },
    });
    if (!done) return;
    toast.success(tr('fees.deleted'), fee.name);
    await load();
  }

  const rowActions = (fee: FeeDto) =>
    canEdit ? (
      <>
        <IconButton aria-label={t('fees.edit', { name: fee.name })} onClick={() => setEditing(fee)}>
          <Pencil size={20} aria-hidden="true" />
        </IconButton>
        <IconButton aria-label={t('fees.delete2', { name: fee.name })} onClick={() => void remove(fee)}>
          <Trash2 size={20} aria-hidden="true" />
        </IconButton>
      </>
    ) : null;

  const options = [
    { value: 'all' as const, label: t('common.alle'), count: fees?.length ?? 0 },
    ...CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => ({ value: c, label: t(`fees.categories.${c}`), count: counts.get(c) })),
  ];

  return (
    <div className="flex max-w-[980px] flex-col gap-6">
      {!canEdit && <Alert tone="info">{t('fees.readOnly')}</Alert>}
      <section className="panel overflow-hidden" aria-labelledby="fees-h">
        <div className="panel-h">
          <div className="min-w-0 max-w-[640px]">
            <h2 className="h2" id="fees-h">
              {t('fees.title')}
            </h2>
            <p className="sm mut mt-0.5">{t('fees.subtitle')}</p>
          </div>
          {canEdit && (
            <Button size="sm" iconLeft={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
              {t('fees.add')}
            </Button>
          )}
        </div>

        {loadError && (
          <div className="p-4">
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
          </div>
        )}

        {fees === null && !loadError ? (
          <div className="p-4">
            <SkeletonRows rows={4} avatar={false} />
          </div>
        ) : fees && fees.length === 0 ? (
          <EmptyState
            compact
            tone="neutral"
            icon={<Coins size={32} />}
            title={t('fees.emptyTitle')}
            text={t('fees.emptyText')}
            actions={canEdit ? <Button onClick={() => setEditing('new')}>{t('fees.add')}</Button> : undefined}
          />
        ) : fees ? (
          <>
            {options.length > 2 && (
              <div className="border-b border-line-soft px-5 py-3 max-md:px-4">
                <ChipGroup aria-label={t('fees.filterCategory')} scrollable options={options} value={category} onChange={setCategory} />
              </div>
            )}
            <ResponsiveList
              className="max-md:p-4"
              table={
                <Table aria-label={t('fees.title')}>
                  <THead>
                    <Tr>
                      <Th>{t('fees.colName')}</Th>
                      <Th>{t('fees.colCategory')}</Th>
                      <Th align="right">{t('fees.colAmount')}</Th>
                      <Th>{t('fees.colVat')}</Th>
                      <Th>{t('fees.colActive')}</Th>
                      <Th align="right">
                        <span className="sr-only">{t('common.aktionen')}</span>
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {visible.map((fee) => (
                      <Tr key={fee.id} className={fee.active ? undefined : 'text-graphite'}>
                        <Td>
                          <Cell2 primary={fee.name} />
                        </Td>
                        <Td>{t(`fees.categories.${fee.category}`)}</Td>
                        <Td align="right" className="num whitespace-nowrap">
                          <b>{fmtMoney(fee.defaultAmount, { currency })}</b>
                        </Td>
                        <Td className="whitespace-nowrap">{vatText(fee)}</Td>
                        <Td>
                          <Switch
                            checked={fee.active}
                            disabled={!canEdit || busyId === fee.id}
                            aria-label={t('fees.activeToggle', { name: fee.name })}
                            onChange={(value) => void toggleActive(fee, value)}
                          />
                        </Td>
                        <Td>
                          <div className="acts">{rowActions(fee)}</div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              }
              cards={visible.map((fee) => (
                <MobileCard
                  key={fee.id}
                  title={fee.name}
                  subtitle={t(`fees.categories.${fee.category}`)}
                  status={<StatusPill tone={fee.active ? 'green' : 'gray'} label={fee.active ? t('fees.active') : t('fees.inactive')} />}
                  actions={
                    <>
                      {canEdit && (
                        <Button variant="outline" className="min-w-0 flex-1" onClick={() => setEditing(fee)}>
                          {t('fees.editShort')}
                        </Button>
                      )}
                      {rowActions(fee) && (
                        <IconButton variant="outline" aria-label={t('fees.delete2', { name: fee.name })} onClick={() => void remove(fee)}>
                          <Trash2 size={20} aria-hidden="true" />
                        </IconButton>
                      )}
                    </>
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="sm mut">{vatText(fee)}</span>
                    <b className="num text-lg">{fmtMoney(fee.defaultAmount, { currency })}</b>
                  </div>
                  {canEdit && (
                    <Switch
                      checked={fee.active}
                      disabled={busyId === fee.id}
                      label={fee.active ? t('fees.active') : t('fees.inactive')}
                      onChange={(value) => void toggleActive(fee, value)}
                    />
                  )}
                </MobileCard>
              ))}
            />
            {visible.length === 0 && <p className="sm mut p-5">{t('fees.noneInCategory')}</p>}
          </>
        ) : null}
      </section>

      {editing && (
        <FeeModal
          fee={editing === 'new' ? null : editing}
          currency={currency}
          defaultVat={defaultVat}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            toast.success(created ? tr('fees.created') : tr('fees.saved'), saved.name);
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ─── Create / edit ──────────────────────────────────────────────

function FeeModal({
  fee,
  currency,
  defaultVat,
  onClose,
  onSaved,
}: {
  fee: FeeDto | null;
  currency: string;
  defaultVat: number | null;
  onClose: () => void;
  onSaved: (fee: FeeDto, created: boolean) => void;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<FeeForm>(() => (fee ? feeToForm(fee) : EMPTY_FEE_FORM));
  const [errors, setErrors] = useState<FeeFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FeeForm>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateFeeForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const body: CreateFeeRequest = feeFormToRequest(form);
      const saved = fee ? await api.updateFee(fee.id, body) : await api.createFee(body);
      onSaved(saved, !fee);
    } catch (err) {
      setError(errorText(err, tr('fees.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fee ? t('fees.editTitle') : t('fees.addTitle')}
      size="md"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form="fee-form" loading={saving}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id="fee-form" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        <Field label={t('fees.colName')} required error={errors.name ? t(errors.name) : undefined}>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} data-autofocus autoComplete="off" placeholder={t('fees.namePlaceholder')} />
        </Field>
        <Field label={t('fees.colCategory')}>
          <Select value={form.category} onChange={(e) => set({ category: e.target.value as FeeCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`fees.categories.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fees.amountLabel', { currency })} required error={errors.amount ? t(errors.amount) : undefined}>
            <Input type="number" inputMode="decimal" min="0" step="0.05" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" className="num" />
          </Field>
          <Field
            label={t('fees.vatLabel')}
            hint={t('fees.vatHint', { rate: defaultVat === null ? '…' : `${defaultVat}` })}
            error={errors.vat ? t(errors.vat) : undefined}
          >
            <Input type="number" inputMode="decimal" min="0" max="100" step="0.1" value={form.vat} onChange={(e) => set({ vat: e.target.value })} placeholder={t('fees.vatPlaceholder')} className="num" />
          </Field>
        </div>
        <Switch checked={form.active} onChange={(active) => set({ active })} label={t('fees.activeLabel')} description={t('fees.activeHint')} />
      </form>
    </Modal>
  );
}
