'use client';

/**
 * Marketing > Rabattcodes: list (code, label, type / value, validity, uses / max, active switch), create and
 * edit dialog (auto-generated code, PERCENT / FIXED, validity, limits), delete (409 has_redemptions) and a
 * detail drawer with the redemptions of a code.
 */
import { ExternalLink, Pencil, Plus, Search, Sparkles, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import type { DiscountCodeDetailDto, DiscountCodeDto, DiscountStatus, DiscountType } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  ChipGroup,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  MobileCard,
  Modal,
  Select,
  Skeleton,
  SkeletonRows,
  SkeletonTableRows,
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
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';
import { zurichParts } from '@/lib/zurich';
import { tr } from '@/i18n/active';
import { CODE_STATUSES, CODE_STATUS_TONE, discountText, generateCode, validityText } from './shared';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | DiscountStatus;

function CodeStatus({ status }: { status: DiscountStatus }) {
  const t = useTranslations();
  return <StatusPill tone={CODE_STATUS_TONE[status]} label={t(`marketing.codes.status.${status}`)} />;
}

function usesText(code: Pick<DiscountCodeDto, 'redemptionCount' | 'maxRedemptions'>): string {
  return code.maxRedemptions === null ? `${fmtNumber(code.redemptionCount)}` : `${fmtNumber(code.redemptionCount)} / ${fmtNumber(code.maxRedemptions)}`;
}

export function DiscountCodesTab({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [personal, setPersonal] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DiscountCodeDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ editing: DiscountCodeDto | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await api.getDiscountCodes({
          q: query || undefined,
          status: filter === 'all' ? undefined : filter,
          personal: personal ? 'true' : undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setLoadError(null);
      } catch (err) {
        if (!silent) setLoadError(errorText(err, tr('marketing.codes.loadFailed')));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [query, filter, personal, page],
  );

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  async function toggleActive(code: DiscountCodeDto, active: boolean) {
    setBusy(code.id, true);
    setItems((rows) => rows.map((c) => (c.id === code.id ? { ...c, active } : c)));
    try {
      await api.updateDiscountCode(code.id, { active });
      void load(true); // the derived status (active / inactive) comes from the server
    } catch (err) {
      setItems((rows) => rows.map((c) => (c.id === code.id ? { ...c, active: code.active } : c)));
      toast.error(t('marketing.codes.toggleFailed'), errorText(err));
    } finally {
      setBusy(code.id, false);
    }
  }

  async function remove(code: DiscountCodeDto) {
    const done = await confirm({
      title: t('marketing.codes.deleteTitle', { code: code.code }),
      description: t('marketing.codes.deleteText'),
      confirmLabel: t('marketing.codes.deleteConfirm'),
      icon: <Trash2 size={20} />,
      onConfirm: async () => {
        try {
          await api.deleteDiscountCode(code.id);
        } catch (err) {
          const e = err as { code?: string };
          throw new Error(e.code === 'has_redemptions' ? tr('marketing.codes.hasRedemptions') : errorText(err, tr('marketing.codes.deleteFailed')));
        }
      },
    });
    if (!done) return;
    toast.success(t('marketing.codes.deleted'), code.code);
    void load(true);
  }

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('common.alle') },
    ...CODE_STATUSES.map((s) => ({ value: s as StatusFilter, label: t(`marketing.codes.status.${s}`) })),
  ];

  const addButton = canEdit ? (
    <Button size="sm" onClick={() => setModal({ editing: null })} iconLeft={<Plus size={18} aria-hidden="true" />}>
      {t('marketing.codes.new')}
    </Button>
  ) : null;

  const rowActions = (code: DiscountCodeDto) =>
    canEdit ? (
      <>
        <IconButton className="pr" aria-label={t('marketing.codes.edit', { code: code.code })} onClick={() => setModal({ editing: code })}>
          <Pencil size={20} aria-hidden="true" />
        </IconButton>
        <IconButton aria-label={t('marketing.codes.delete', { code: code.code })} onClick={() => void remove(code)}>
          <Trash2 size={20} aria-hidden="true" />
        </IconButton>
      </>
    ) : null;

  return (
    <section className="panel overflow-hidden" aria-labelledby="codes-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="codes-h">
            {t('marketing.codes.title')}
          </h2>
          <p className="sm mut mt-0.5">{t('marketing.codes.subtitle')}</p>
        </div>
        {addButton}
      </div>

      <div className="flex flex-col gap-3 border-b border-line-soft p-4">
        <ChipGroup aria-label={t('marketing.codes.filterStatus')} options={filterOptions} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} scrollable />
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <Input type="search" aria-label={t('marketing.codes.search')} placeholder={t('marketing.codes.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Switch checked={personal} onChange={(v) => { setPersonal(v); setPage(1); }} label={t('marketing.codes.showPersonal')} />
        </div>
      </div>

      {loadError && (
        <div className="p-4">
          <Alert tone="err" action={<Button variant="outline" size="sm" onClick={() => void load()}>{t('common.erneutVersuchen')}</Button>}>
            {loadError}
          </Alert>
        </div>
      )}

      {loading && !loadError ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('marketing.codes.title')}>
              <TBody>
                <SkeletonTableRows rows={5} columns={6} />
              </TBody>
            </Table>
          </div>
          <div className="p-4 md:hidden">
            <SkeletonRows rows={4} avatar={false} />
          </div>
        </>
      ) : !loadError && items.length === 0 ? (
        <EmptyState
          icon={<Tag size={32} />}
          title={filter !== 'all' || query ? t('marketing.codes.emptyFilteredTitle') : t('marketing.codes.emptyTitle')}
          text={filter !== 'all' || query ? t('marketing.codes.emptyFilteredText') : t('marketing.codes.emptyText')}
          actions={filter === 'all' && !query ? addButton : undefined}
        />
      ) : !loadError ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('marketing.codes.title')}>
              <THead>
                <Tr>
                  <Th>{t('marketing.codes.colCode')}</Th>
                  <Th>{t('marketing.codes.colDiscount')}</Th>
                  <Th>{t('marketing.codes.colValidity')}</Th>
                  <Th align="right">{t('marketing.codes.colUses')}</Th>
                  <Th>{t('marketing.codes.colActive')}</Th>
                  <Th align="right">
                    <span className="sr-only">{t('common.aktionen')}</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((code) => (
                  <Tr key={code.id} onClick={() => setDetailId(code.id)}>
                    <Td>
                      <div className="cell-2">
                        <button type="button" className="num w-fit text-left text-[15px] font-bold tracking-wide hover:underline" onClick={(e) => { e.stopPropagation(); setDetailId(code.id); }}>
                          {code.code}
                        </button>
                        <span>
                          {code.label || (code.isPersonal ? t('marketing.codes.personal', { email: code.recipientEmail ?? '' }) : '–')}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <b className="num">{discountText(code)}</b>
                      {code.minDays ? <span className="sm mut block">{t('marketing.codes.minDays', { count: code.minDays })}</span> : null}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <span className="num">{validityText(code)}</span>
                        <CodeStatus status={code.status} />
                      </div>
                    </Td>
                    <Td align="right" className="num whitespace-nowrap">
                      {usesText(code)}
                      <span className="sm mut block">{t('marketing.codes.perEmail', { count: code.perEmailLimit })}</span>
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={code.active}
                        disabled={!canEdit || busyIds.has(code.id)}
                        onChange={(v) => void toggleActive(code, v)}
                        aria-label={t('marketing.codes.activeSwitch', { code: code.code })}
                      />
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <div className="acts items-center">{rowActions(code)}</div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 p-4 md:hidden">
            {items.map((code) => (
              <MobileCard
                key={code.id}
                title={<span className="num tracking-wide">{code.code}</span>}
                subtitle={code.label || undefined}
                status={<CodeStatus status={code.status} />}
                onOpen={() => setDetailId(code.id)}
                actions={
                  <>
                    <div className="mr-auto flex items-center gap-2">
                      <Switch
                        checked={code.active}
                        disabled={!canEdit || busyIds.has(code.id)}
                        onChange={(v) => void toggleActive(code, v)}
                        aria-label={t('marketing.codes.activeSwitch', { code: code.code })}
                      />
                      <span className="sm mut">{t('marketing.codes.colActive')}</span>
                    </div>
                    {rowActions(code)}
                  </>
                }
              >
                <p>
                  <b className="num">{discountText(code)}</b> · <span className="num">{validityText(code)}</span>
                </p>
                <p className="sm mut">
                  {t('marketing.codes.usesLine', { uses: usesText(code) })}
                </p>
              </MobileCard>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
            <span className="sm mut" aria-live="polite">
              {t('marketing.codes.count', { count: total })}
            </span>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('common.zurueck')}
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t('fleet.weiter')}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {modal && (
        <CodeModal
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={(saved, created) => {
            setModal(null);
            toast.success(created ? t('marketing.codes.created') : t('marketing.codes.saved'), saved.code);
            void load(true);
          }}
        />
      )}
      {detailId && <CodeDetail id={detailId} canEdit={canEdit} onClose={() => setDetailId(null)} onEdit={(code) => { setDetailId(null); setModal({ editing: code }); }} />}
    </section>
  );
}

// ─── Create / edit dialog ───────────────────────────────────────

interface CodeForm {
  code: string;
  label: string;
  type: DiscountType;
  value: string;
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  perEmailLimit: string;
  minDays: string;
  active: boolean;
  recipientEmail: string;
}

type CodeErrors = Partial<Record<keyof CodeForm, string>>;

const dateInput = (iso: string | null): string => (iso ? zurichParts(iso)?.date ?? '' : '');

function toForm(code: DiscountCodeDto | null): CodeForm {
  if (!code) {
    return { code: '', label: '', type: 'PERCENT', value: '', validFrom: '', validUntil: '', maxRedemptions: '', perEmailLimit: '1', minDays: '', active: true, recipientEmail: '' };
  }
  return {
    code: code.code,
    label: code.label ?? '',
    type: code.type,
    value: String(code.value),
    validFrom: dateInput(code.validFrom),
    validUntil: dateInput(code.validUntil),
    maxRedemptions: code.maxRedemptions === null ? '' : String(code.maxRedemptions),
    perEmailLimit: String(code.perEmailLimit),
    minDays: code.minDays === null ? '' : String(code.minDays),
    active: code.active,
    recipientEmail: code.recipientEmail ?? '',
  };
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function CodeModal({ editing, onClose, onSaved }: { editing: DiscountCodeDto | null; onClose: () => void; onSaved: (saved: DiscountCodeDto, created: boolean) => void }) {
  const t = useTranslations();
  const formId = useId();
  const currency = useCurrency();
  const [form, setForm] = useState<CodeForm>(() => toForm(editing));
  const [errors, setErrors] = useState<CodeErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = Boolean(editing && editing.redemptionCount > 0);

  const set = <K extends keyof CodeForm>(key: K, value: CodeForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setFormError('');
  };

  function validate(): CodeErrors {
    const next: CodeErrors = {};
    const value = Number(form.value);
    if (form.value.trim() === '' || Number.isNaN(value) || value <= 0) next.value = tr('marketing.codes.errValue');
    else if (form.type === 'PERCENT' && value > 100) next.value = tr('marketing.codes.errPercent');
    if (form.code.trim() && !/^[A-Za-z0-9][A-Za-z0-9-]{2,38}$/.test(form.code.trim())) next.code = tr('marketing.codes.errCode');
    if (form.validFrom && form.validUntil && form.validUntil < form.validFrom) next.validUntil = tr('marketing.codes.errDates');
    const int = (v: string) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) >= 1);
    if (!int(form.maxRedemptions)) next.maxRedemptions = tr('marketing.codes.errWhole');
    if (!int(form.perEmailLimit) || form.perEmailLimit.trim() === '') next.perEmailLimit = tr('marketing.codes.errWhole');
    if (!int(form.minDays)) next.minDays = tr('marketing.codes.errWhole');
    if (form.recipientEmail.trim() && !EMAIL_RE.test(form.recipientEmail.trim())) next.recipientEmail = tr('common.gebenSieEineGueltige');
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(tr('marketing.codes.checkFields'));
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      ...(form.code.trim() && !locked ? { code: form.code.trim().toUpperCase() } : {}),
      label: form.label.trim() || null,
      type: form.type,
      value: Number(form.value),
      ...(form.type === 'FIXED' ? { currency: editing?.currency === 'EUR' || editing?.currency === 'CHF' ? editing.currency : currency } : {}),
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
      maxRedemptions: form.maxRedemptions.trim() ? Number(form.maxRedemptions) : null,
      perEmailLimit: Number(form.perEmailLimit),
      minDays: form.minDays.trim() ? Number(form.minDays) : null,
      active: form.active,
      recipientEmail: form.recipientEmail.trim() ? form.recipientEmail.trim() : null,
    };
    try {
      const saved = editing ? await api.updateDiscountCode(editing.id, payload) : await api.createDiscountCode(payload);
      onSaved(saved, !editing);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === 'code_taken') setErrors({ code: tr('marketing.codes.errTaken') });
      else if (e.code === 'code_locked') setErrors({ code: tr('marketing.codes.errLocked') });
      setFormError(errorText(err, tr('marketing.codes.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={editing ? t('marketing.codes.editTitle') : t('marketing.codes.newTitle')}
      description={t('marketing.codes.modalHint')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="err">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field
            label={t('marketing.codes.fieldCode')}
            error={errors.code}
            hint={locked ? t('marketing.codes.codeLockedHint') : t('marketing.codes.codeHint')}
          >
            <div className="flex items-center gap-2">
              <Input
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                disabled={locked}
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                placeholder="HD-XXXX-XXXX"
                className="num uppercase"
                data-autofocus
              />
              {!locked && (
                <IconButton variant="outline" aria-label={t('marketing.codes.generate')} onClick={() => set('code', generateCode())}>
                  <Sparkles size={20} aria-hidden="true" />
                </IconButton>
              )}
            </div>
          </Field>
          <Field label={t('marketing.codes.fieldLabel')} hint={t('marketing.codes.labelHint')}>
            <Input value={form.label} onChange={(e) => set('label', e.target.value)} maxLength={120} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label={t('marketing.codes.fieldType')}>
            <Select value={form.type} onChange={(e) => set('type', e.target.value as DiscountType)}>
              <option value="PERCENT">{t('marketing.codes.typePercent')}</option>
              <option value="FIXED">{t('marketing.codes.typeFixed', { currency: editing?.currency ?? currency })}</option>
            </Select>
          </Field>
          <Field label={form.type === 'PERCENT' ? t('marketing.codes.valuePercent') : t('marketing.codes.valueFixed', { currency: editing?.currency ?? currency })} error={errors.value} required>
            <Input type="number" inputMode="decimal" min={0} max={form.type === 'PERCENT' ? 100 : undefined} step={form.type === 'PERCENT' ? 1 : 0.05} value={form.value} onChange={(e) => set('value', e.target.value)} className="num" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label={t('marketing.codes.validFrom')} hint={t('marketing.codes.validHint')}>
            <Input type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
          </Field>
          <Field label={t('marketing.codes.validUntil')} error={errors.validUntil}>
            <Input type="date" value={form.validUntil} min={form.validFrom || undefined} onChange={(e) => set('validUntil', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <Field label={t('marketing.codes.maxRedemptions')} hint={t('marketing.codes.maxHint')} error={errors.maxRedemptions}>
            <Input type="number" inputMode="numeric" min={1} step={1} value={form.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value)} className="num" />
          </Field>
          <Field label={t('marketing.codes.perEmailLimit')} hint={t('marketing.codes.perEmailHint')} error={errors.perEmailLimit}>
            <Input type="number" inputMode="numeric" min={1} step={1} value={form.perEmailLimit} onChange={(e) => set('perEmailLimit', e.target.value)} className="num" />
          </Field>
          <Field label={t('marketing.codes.minDaysLabel')} hint={t('marketing.codes.minDaysHint')} error={errors.minDays}>
            <Input type="number" inputMode="numeric" min={1} step={1} value={form.minDays} onChange={(e) => set('minDays', e.target.value)} className="num" />
          </Field>
        </div>

        <Field label={t('marketing.codes.recipientEmail')} hint={t('marketing.codes.recipientHint')} error={errors.recipientEmail}>
          <Input type="email" inputMode="email" autoComplete="off" value={form.recipientEmail} onChange={(e) => set('recipientEmail', e.target.value)} />
        </Field>

        <Switch checked={form.active} onChange={(v) => set('active', v)} label={t('marketing.codes.activeLabel')} description={t('marketing.codes.activeHint')} />
      </form>
    </Modal>
  );
}

// ─── Usage drawer ───────────────────────────────────────────────

function CodeDetail({ id, canEdit, onClose, onEdit }: { id: string; canEdit: boolean; onClose: () => void; onEdit: (code: DiscountCodeDto) => void }) {
  const t = useTranslations();
  const currency = useCurrency();
  const [code, setCode] = useState<DiscountCodeDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCode(await api.getDiscountCode(id));
      setError(null);
    } catch (err) {
      setError(errorText(err, tr('marketing.codes.detailFailed')));
    }
  }, [id]);

  useEffect(() => {
    setCode(null);
    void load();
  }, [load]);

  const unit = code?.currency ?? currency;
  const totalDiscount = code ? code.redemptions.reduce((sum, r) => sum + r.amount, 0) : 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={code ? <span className="num tracking-wide">{code.code}</span> : t('marketing.codes.detailTitle')}
      subtitle={code ? <CodeStatus status={code.status} /> : undefined}
      footer={
        code && canEdit ? (
          <Button variant="outline" className="flex-1" onClick={() => onEdit(code)} iconLeft={<Pencil size={18} aria-hidden="true" />}>
            {t('marketing.codes.editTitle')}
          </Button>
        ) : undefined
      }
    >
      {error && (
        <Alert tone="err" action={<Button variant="outline" size="sm" onClick={() => void load()}>{t('common.erneutVersuchen')}</Button>}>
          {error}
        </Alert>
      )}
      {!code && !error && <Skeleton className="h-[260px]" rounded={12} />}
      {code && (
        <>
          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
            <dt className="mut">{t('marketing.codes.colDiscount')}</dt>
            <dd><b className="num">{discountText(code)}</b></dd>
            <dt className="mut">{t('marketing.codes.colValidity')}</dt>
            <dd className="num">{validityText(code)}</dd>
            <dt className="mut">{t('marketing.codes.colUses')}</dt>
            <dd className="num">{usesText(code)}</dd>
            <dt className="mut">{t('marketing.codes.perEmailLimit')}</dt>
            <dd className="num">{code.perEmailLimit}</dd>
            {code.minDays ? (
              <>
                <dt className="mut">{t('marketing.codes.minDaysLabel')}</dt>
                <dd className="num">{code.minDays}</dd>
              </>
            ) : null}
            {code.recipientEmail && (
              <>
                <dt className="mut">{t('marketing.codes.recipientEmail')}</dt>
                <dd className="break-all">{code.recipientEmail}</dd>
              </>
            )}
            {code.label && (
              <>
                <dt className="mut">{t('marketing.codes.fieldLabel')}</dt>
                <dd>{code.label}</dd>
              </>
            )}
          </dl>

          <section aria-label={t('marketing.codes.redemptions')} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('marketing.codes.redemptions')}</h3>
              {code.redemptions.length > 0 && <span className="sm mut num">{t('marketing.codes.discountedTotal', { amount: fmtMoney(totalDiscount, { currency: unit }) })}</span>}
            </div>
            {code.redemptions.length === 0 ? (
              <p className="mut">{t('marketing.codes.noRedemptions')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {code.redemptions.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
                    <div className="min-w-0">
                      <b className="block font-semibold">{r.customerName || r.email}</b>
                      {r.customerName && <span className="sm mut block break-all">{r.email}</span>}
                      <span className="sm mut num">{fmtDate(r.createdAt)}</span>
                      {r.bookingId && (
                        <Link href={`/contracts?id=${r.bookingId}`} className="sm ml-2 inline-flex items-center gap-1 font-semibold text-ruby-fg underline">
                          {t('emailLog.related.booking')}
                          <ExternalLink size={12} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                    <b className="num flex-none text-ok">−{fmtMoney(r.amount, { currency: unit })}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Drawer>
  );
}
