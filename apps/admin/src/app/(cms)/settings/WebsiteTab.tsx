'use client';

/**
 * Einstellungen > Website. One panel per setting key:
 *  - "Website-Einstellungen" (new, Settings-Users board): company, search engine texts, e-mail on new
 *    inquiry and maintenance mode: keys company, seo, notifications, maintenance_mode
 *  - Preisgestaltung (marketing text), Preisregeln (real discounts), Vertrauens-Features,
 *    Standort und Karte, Rechnungsinfos: all kept from the previous page, restyled.
 * Every panel saves on its own; success and failures are toasts.
 */
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppLocale, TranslatableLocale } from '@hoppdrive/shared';
import {
  Alert,
  Button,
  Field,
  IconButton,
  Input,
  Select,
  Skeleton,
  Switch,
  Textarea,
  useConfirm,
  useToast,
} from '@/components/ui';
import { CountHint } from '@/components/content/homepage/fields';
import { LanguageNote, LanguageTabs } from '@/components/content/LanguageTabs';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { fieldMessages } from '@/lib/auth-errors';
import { errorText } from '@/lib/errors';
import {
  DEFAULT_COMPANY,
  DEFAULT_FEATURES,
  DEFAULT_INVOICE,
  DEFAULT_LOCATION,
  DEFAULT_MAINTENANCE,
  DEFAULT_PRICING,
  DEFAULT_SEO,
  ICON_LABELS,
  ICON_OPTIONS,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  type CompanyForm,
  type FeaturesSetting,
  type InvoiceSettings,
  type LocationSetting,
  type MaintenanceForm,
  type PricingCopy,
  type SeoSetting,
} from '@/lib/settings-defaults';
import { TRANSLATABLE_LOCALES, cleanTranslations, stateOf, type TranslationState } from '@/lib/translations';
import { CurrencyPanel } from './CurrencyPanel';
import { LocationEditor } from './LocationEditor';
import { PricingRulesPanel } from './PricingRulesPanel';
import {
  FeaturesTranslationFields,
  GeneralTranslationFields,
  PricingTranslationFields,
  type GeneralI18n,
  featuresStates,
  pricingStates,
} from './SettingTranslations';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Saves one setting key and reports through toasts. Resolves true on success. */
function useSettingSaver() {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const save = useCallback(
    async (key: string, value: unknown, label: string): Promise<boolean> => {
      setSaving(key);
      try {
        await api.updateSetting(key, value);
        toast.success(tr('settings.gespeichert'), label);
        return true;
      } catch (err) {
        toast.error(tr('settings.nichtGespeichert', { label }), errorText(err));
        return false;
      } finally {
        setSaving(null);
      }
    },
    [toast],
  );
  return { saving, save };
}

function SettingsPanel({
  id,
  title,
  subtitle,
  actions,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id={id}>
            {title}
          </h2>
          {subtitle && <p className="sm mut mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

function VisibleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const tt = useTranslations();
  return <Switch checked={checked} onChange={onChange} label={checked ? tt('common.sichtbar') : tt('common.ausgeblendet')} />;
}

export function WebsiteTab() {
  const tt = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const { saving, save } = useSettingSaver();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const raw = useRef<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any

  const [pricing, setPricing] = useState<PricingCopy>(DEFAULT_PRICING);
  const [features, setFeatures] = useState<FeaturesSetting>(DEFAULT_FEATURES);
  const [location, setLocation] = useState<LocationSetting>(DEFAULT_LOCATION);
  const [invoice, setInvoice] = useState<InvoiceSettings>(DEFAULT_INVOICE);
  const [invoiceErrors, setInvoiceErrors] = useState<Partial<Record<'iban' | 'qrIban' | 'dueDays' | 'vatRate', string>>>({});
  const [pricingLang, setPricingLang] = useState<AppLocale>('de');
  const [featuresLang, setFeaturesLang] = useState<AppLocale>('de');

  // "Website-Einstellungen": the form plus the last saved snapshot (for Verwerfen and the dirty check)
  const [form, setForm] = useState<GeneralForm>(emptyGeneral());
  const [baseline, setBaseline] = useState<GeneralForm>(emptyGeneral());

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const all = await api.getSettings();
      raw.current = all;
      if (all.pricing) setPricing(all.pricing);
      if (all.features) setFeatures(all.features);
      if (all.location) setLocation(all.location);
      if (all.invoice_settings) setInvoice((s) => ({ ...s, ...all.invoice_settings }));
      const general = generalFrom(all);
      setForm(general);
      setBaseline(general);
    } catch (err) {
      // Defaults are fine (fresh install); tell the user that nothing was read
      setLoadError(errorText(err, tr('settings.dieEinstellungenKonntenNicht')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function saveInvoice() {
    setInvoiceErrors({});
    const value = { ...invoice, dueDays: invoice.dueDays > 0 ? invoice.dueDays : undefined };
    try {
      await api.updateSetting('invoice_settings', value);
      toast.success(tr('settings.gespeichert'), tr('settings.rechnungsinfos'));
    } catch (err) {
      const errors: typeof invoiceErrors = {};
      if (fieldMessages(err, 'value.iban').length > 0) errors.iban = tt('settings.ibanInvalid');
      if (fieldMessages(err, 'value.qrIban').length > 0) errors.qrIban = tt('settings.qrIbanInvalid');
      if (fieldMessages(err, 'value.dueDays').length > 0) errors.dueDays = tt('settings.dueDaysInvalid');
      if (fieldMessages(err, 'value.vatRate').length > 0) errors.vatRate = tt('settings.vatInvalid');
      setInvoiceErrors(errors);
      toast.error(
        tr('settings.nichtGespeichert', { label: tr('settings.rechnungsinfos') }),
        Object.keys(errors).length > 0 ? tt('settings.pleaseCheckFields') : errorText(err),
      );
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <span className="sr-only" role="status">
          {tt('settings.einstellungenWerdenGeladen')}
        </span>
        <Skeleton className="h-[420px]" rounded={16} />
        <Skeleton className="h-[320px]" rounded={16} />
      </div>
    );
  }

  return (
    <div className="flex max-w-[1200px] flex-col gap-6">
      {loadError && (
        <Alert
          tone="warn"
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {tt('settings.erneutLaden')}
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      <GeneralPanel
        form={form}
        setForm={setForm}
        baseline={baseline}
        saving={saving !== null}
        onSaved={setBaseline}
        raw={raw}
      />

      {/* ─── Preisgestaltung: Marketing-Text ─── */}
      <SettingsPanel
        id="pricing-copy-h"
        title={tt('settings.preisgestaltungMarketingText')}
        actions={
          <>
            <VisibleSwitch checked={pricing.visible} onChange={(visible) => setPricing((p) => ({ ...p, visible }))} />
            <Button size="sm" loading={saving === 'pricing'} onClick={() => void save('pricing', pricing, tr('settings.preisgestaltung'))}>
              {tt('common.speichern')}
            </Button>
          </>
        }
      >
        <Alert tone="warn">
          {tt.rich('settings.pricingNotice', { b: (chunks) => <b>{chunks}</b> })}
        </Alert>

        <div className="flex flex-col gap-2">
          <LanguageTabs value={pricingLang} onChange={setPricingLang} states={pricingStates(pricing)} idPrefix="pricing-lang" />
          <LanguageNote locale={pricingLang} />
        </div>

        {pricingLang !== 'de' ? (
          <PricingTranslationFields locale={pricingLang as TranslatableLocale} pricing={pricing} onChange={setPricing} />
        ) : (
        <>
        <Field label={tt('common.titel')}>
          <Input value={pricing.title} onChange={(e) => setPricing((p) => ({ ...p, title: e.target.value }))} />
        </Field>

        <div className="flex flex-col gap-3" role="group" aria-label={tt('settings.stufen')}>
          <span className="lbl">{tt('settings.stufen')}</span>
          {pricing.tiers.map((tier, idx) => {
            const update = (patch: Partial<typeof tier>) =>
              setPricing((p) => ({ ...p, tiers: p.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)) }));
            return (
              <div key={idx} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-line bg-row p-3.5 lg:grid-cols-12">
                <Field label={tt('settings.nr')} className="lg:col-span-1">
                  <Input value={tier.number} onChange={(e) => update({ number: e.target.value })} />
                </Field>
                <Field label={tt('common.titel')} className="lg:col-span-3">
                  <Input value={tier.title} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label={tt('common.beschreibung')} className="col-span-2 lg:col-span-5">
                  <Input value={tier.description} onChange={(e) => update({ description: e.target.value })} />
                </Field>
                <Field label={tt('settings.badge')} className="lg:col-span-2">
                  <Input value={tier.badge} onChange={(e) => update({ badge: e.target.value })} placeholder={tt('settings.zB20RABATT')} />
                </Field>
                <div className="flex justify-end lg:col-span-1">
                  <IconButton
                    aria-label={tt('settings.stufeEntfernen', { value: idx + 1 })}
                    onClick={() => setPricing((p) => ({ ...p, tiers: p.tiers.filter((_, i) => i !== idx) }))}
                    className="text-err"
                  >
                    <Trash2 size={20} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            );
          })}
          <div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Plus size={16} aria-hidden="true" />}
              onClick={() =>
                setPricing((p) => ({
                  ...p,
                  tiers: [...p.tiers, { number: String(p.tiers.length + 1).padStart(2, '0'), title: '', description: '', badge: '' }],
                }))
              }
            >
              {tt('settings.stufeHinzufuegen')}
            </Button>
          </div>
        </div>
        </>
        )}
      </SettingsPanel>

      {/* ─── Preisregeln ─── */}
      <PricingRulesPanel />

      {/* ─── Vertrauens-Features ─── */}
      <SettingsPanel
        id="features-h"
        title={tt('settings.vertrauensFeatures')}
        actions={
          <>
            <VisibleSwitch checked={features.visible} onChange={(visible) => setFeatures((f) => ({ ...f, visible }))} />
            <Button size="sm" loading={saving === 'features'} onClick={() => void save('features', features, tr('settings.vertrauensFeatures'))}>
              {tt('common.speichern')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <LanguageTabs value={featuresLang} onChange={setFeaturesLang} states={featuresStates(features)} idPrefix="features-lang" />
          <LanguageNote locale={featuresLang} />
        </div>
        {featuresLang !== 'de' ? (
          <FeaturesTranslationFields locale={featuresLang as TranslatableLocale} features={features} onChange={setFeatures} />
        ) : (
        <div className="flex flex-col gap-3">
          {features.items.map((item, idx) => {
            const update = (patch: Partial<typeof item>) =>
              setFeatures((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
            return (
              <div key={idx} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-line bg-row p-3.5 lg:grid-cols-12">
                <Field label={tt('settings.icon')} className="lg:col-span-2">
                  <Select value={item.icon} onChange={(e) => update({ icon: e.target.value })}>
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {ICON_LABELS[icon] ?? icon}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={tt('common.titel')} className="lg:col-span-3">
                  <Input value={item.title} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label={tt('common.beschreibung')} className="col-span-2 lg:col-span-6">
                  <Input value={item.description} onChange={(e) => update({ description: e.target.value })} />
                </Field>
                <div className="col-span-2 flex justify-end lg:col-span-1">
                  <IconButton
                    aria-label={tt('settings.featureEntfernen', { value: idx + 1 })}
                    onClick={() => setFeatures((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="text-err"
                  >
                    <Trash2 size={20} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            );
          })}
          <div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Plus size={16} aria-hidden="true" />}
              onClick={() => setFeatures((f) => ({ ...f, items: [...f.items, { icon: 'shield', title: '', description: '' }] }))}
            >
              {tt('settings.featureHinzufuegen')}
            </Button>
          </div>
        </div>
        )}
      </SettingsPanel>

      {/* ─── Standort / Karte ─── */}
      <LocationEditor
        location={location}
        setLocation={setLocation}
        saving={saving === 'location'}
        onSave={() => void save('location', location, tr('settings.standortUndKarte'))}
      />

      {/* ─── Rechnungsinfos ─── */}
      <SettingsPanel
        id="invoice-h"
        title={tt('settings.rechnungsinfos')}
        subtitle={tt('settings.erscheinenAufJederGenerierten')}
        actions={
          <Button
            size="sm"
            loading={saving === 'invoice_settings'}
            onClick={() => void saveInvoice()}
            iconLeft={<Receipt size={16} aria-hidden="true" />}
          >
            {tt('common.speichern')}
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Field label={tt('settings.mwStNrUID')}>
            <Input
              value={invoice.uid}
              onChange={(e) => setInvoice((s) => ({ ...s, uid: e.target.value }))}
              placeholder={tt('settings.cHEXXXXXXXXX')}
              className="num"
            />
          </Field>
          <Field label={tt('settings.mwStSatz')} error={invoiceErrors.vatRate}>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={invoice.vatRate}
              onChange={(e) => setInvoice((s) => ({ ...s, vatRate: Number(e.target.value) || 0 }))}
              placeholder="8.1"
              className="num"
            />
          </Field>
          <Field label={tt('settings.dueDays')} hint={tt('settings.dueDaysHint')} error={invoiceErrors.dueDays}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              step={1}
              value={invoice.dueDays || ''}
              onChange={(e) => {
                setInvoice((s) => ({ ...s, dueDays: Math.trunc(Number(e.target.value)) || 0 }));
                setInvoiceErrors((x) => ({ ...x, dueDays: undefined }));
              }}
              placeholder="30"
              className="num"
            />
          </Field>
          <Field label="IBAN" error={invoiceErrors.iban}>
            <Input
              value={invoice.iban}
              onChange={(e) => {
                setInvoice((s) => ({ ...s, iban: e.target.value }));
                setInvoiceErrors((x) => ({ ...x, iban: undefined }));
              }}
              placeholder={tt('settings.cH56048350123456')}
              className="num"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label={tt('settings.qrIban')} hint={tt('settings.qrIbanHint')} error={invoiceErrors.qrIban}>
            <Input
              value={invoice.qrIban}
              onChange={(e) => {
                setInvoice((s) => ({ ...s, qrIban: e.target.value }));
                setInvoiceErrors((x) => ({ ...x, qrIban: undefined }));
              }}
              placeholder="CH44 3199 9123 0008 8901 2"
              className="num"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label={tt('settings.bankname')}>
            <Input value={invoice.bankName} onChange={(e) => setInvoice((s) => ({ ...s, bankName: e.target.value }))} placeholder={tt('settings.raiffeisenbankZuerich')} />
          </Field>
        </div>
        <div className="rounded-xl border border-line px-4 py-2">
          <Switch
            checked={invoice.defaultWithQrBill}
            onChange={(defaultWithQrBill) => setInvoice((s) => ({ ...s, defaultWithQrBill }))}
            label={tt('settings.defaultQrBill')}
            description={tt('settings.defaultQrBillHint')}
            labelPosition="left"
          />
        </div>
      </SettingsPanel>

      {/* ─── Währung ─── */}
      <CurrencyPanel />
    </div>
  );
}

// ─── "Website-Einstellungen" (company, search engines, notifications, maintenance) ───

interface GeneralForm {
  company: CompanyForm;
  seo: SeoSetting;
  emailOnInquiry: boolean;
  maintenance: MaintenanceForm;
  /** Translations of the search-engine texts and the maintenance message (i18n sub-key of the settings). */
  i18n: GeneralI18n;
}

const emptyLocaleMap = <T,>(make: () => T): Record<TranslatableLocale, T> => ({ en: make(), fr: make(), it: make(), hr: make() });

function emptyI18n(): GeneralI18n {
  return {
    seo: emptyLocaleMap(() => ({ metaTitle: '', metaDescription: '' })),
    maintenance: emptyLocaleMap(() => ({ message: '' })),
  };
}

function emptyGeneral(): GeneralForm {
  return { company: DEFAULT_COMPANY, seo: DEFAULT_SEO, emailOnInquiry: true, maintenance: DEFAULT_MAINTENANCE, i18n: emptyI18n() };
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Writes the edited translations over the stored `i18n` of a setting (unknown languages / keys are kept). */
function mergeI18n(storedI18n: unknown, edited: Record<TranslatableLocale, Record<string, string>>): Record<string, unknown> | null {
  const stored = (storedI18n && typeof storedI18n === 'object' ? storedI18n : {}) as Record<string, Record<string, unknown> | undefined>;
  const merged: Partial<Record<TranslatableLocale, unknown>> = {};
  for (const locale of TRANSLATABLE_LOCALES) merged[locale] = { ...(stored[locale] ?? {}), ...edited[locale] };
  return cleanTranslations(merged);
}

/** `{ ...stored, ...fields, i18n }`; the i18n key disappears when no language has a text. */
function withTranslations(stored: Record<string, any> | undefined, fields: Record<string, unknown>, edited: Record<TranslatableLocale, Record<string, string>>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { i18n: storedI18n, ...rest } = stored ?? {};
  const i18n = mergeI18n(storedI18n, edited);
  return { ...rest, ...fields, ...(i18n ? { i18n } : {}) };
}

function generalFrom(all: Record<string, any>): GeneralForm { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    company: {
      name: all.company?.name ?? '',
      phone: all.company?.phone ?? '',
      inquiryEmail: all.company?.inquiryEmail ?? '',
      street: all.company?.street ?? '',
      zip: all.company?.zip ?? '',
      city: all.company?.city ?? '',
      country: all.company?.country ?? '',
      uid: all.company?.uid ?? '',
    },
    seo: {
      metaTitle: all.seo?.metaTitle ?? '',
      metaDescription: all.seo?.metaDescription ?? '',
      ogImageUrl: all.seo?.ogImageUrl ?? '',
    },
    emailOnInquiry: all.notifications?.emailOnInquiry !== false,
    maintenance: { enabled: all.maintenance_mode?.enabled === true, message: all.maintenance_mode?.message ?? '' },
    i18n: {
      seo: {
        en: { metaTitle: asText(all.seo?.i18n?.en?.metaTitle), metaDescription: asText(all.seo?.i18n?.en?.metaDescription) },
        fr: { metaTitle: asText(all.seo?.i18n?.fr?.metaTitle), metaDescription: asText(all.seo?.i18n?.fr?.metaDescription) },
        it: { metaTitle: asText(all.seo?.i18n?.it?.metaTitle), metaDescription: asText(all.seo?.i18n?.it?.metaDescription) },
        hr: { metaTitle: asText(all.seo?.i18n?.hr?.metaTitle), metaDescription: asText(all.seo?.i18n?.hr?.metaDescription) },
      },
      maintenance: {
        en: { message: asText(all.maintenance_mode?.i18n?.en?.message) },
        fr: { message: asText(all.maintenance_mode?.i18n?.fr?.message) },
        it: { message: asText(all.maintenance_mode?.i18n?.it?.message) },
        hr: { message: asText(all.maintenance_mode?.i18n?.hr?.message) },
      },
    },
  };
}

function GeneralPanel({
  form,
  setForm,
  baseline,
  saving,
  onSaved,
  raw,
}: {
  form: GeneralForm;
  setForm: (next: GeneralForm | ((current: GeneralForm) => GeneralForm)) => void;
  baseline: GeneralForm;
  saving: boolean;
  onSaved: (next: GeneralForm) => void;
  raw: { current: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  const tt = useTranslations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [lang, setLang] = useState<AppLocale>('de');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  const generalStates = useMemo(() => {
    const states: Partial<Record<AppLocale, TranslationState>> = {};
    for (const locale of TRANSLATABLE_LOCALES) {
      states[locale] = stateOf([
        { base: form.seo.metaTitle, value: form.i18n.seo[locale].metaTitle },
        { base: form.seo.metaDescription, value: form.i18n.seo[locale].metaDescription },
        { base: form.maintenance.message, value: form.i18n.maintenance[locale].message },
      ]);
    }
    return states;
  }, [form.seo.metaTitle, form.seo.metaDescription, form.maintenance.message, form.i18n]);

  const setCompany = (patch: Partial<CompanyForm>) => setForm((f) => ({ ...f, company: { ...f.company, ...patch } }));
  const setSeo = (patch: Partial<SeoSetting>) => setForm((f) => ({ ...f, seo: { ...f.seo, ...patch } }));

  async function toggleMaintenance(next: boolean) {
    if (next) {
      const ok = await confirm({
        title: tr('settings.wartungsmodusAktivieren'),
        description:
          tr('settings.sobaldSieSpeichernSehen'),
        confirmLabel: tr('settings.wartungsmodusAktivieren2'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    setForm((f) => ({ ...f, maintenance: { ...f.maintenance, enabled: next } }));
  }

  async function handleSave() {
    const mail = form.company.inquiryEmail.trim();
    if (mail && !EMAIL_RE.test(mail)) {
      setEmailError(tr('common.gebenSieEineGueltige'));
      return;
    }
    setEmailError(null);
    setBusy(true);

    const trimmed = Object.fromEntries(Object.entries(form.company).map(([key, value]) => [key, String(value).trim()])) as unknown as CompanyForm;
    const next: GeneralForm = { ...form, company: { ...trimmed, inquiryEmail: mail } };
    const jobs: { key: string; label: string; changed: boolean; value: unknown; apply: (b: GeneralForm) => GeneralForm }[] = [
      {
        key: 'company',
        label: tr('settings.firmendaten'),
        changed: JSON.stringify(next.company) !== JSON.stringify(baseline.company),
        value: { ...(raw.current.company ?? {}), ...next.company },
        apply: (b) => ({ ...b, company: next.company }),
      },
      {
        key: 'seo',
        label: tr('settings.suchmaschinen'),
        changed: JSON.stringify([next.seo, next.i18n.seo]) !== JSON.stringify([baseline.seo, baseline.i18n.seo]),
        value: withTranslations(raw.current.seo, next.seo as unknown as Record<string, unknown>, next.i18n.seo),
        apply: (b) => ({ ...b, seo: next.seo, i18n: { ...b.i18n, seo: next.i18n.seo } }),
      },
      {
        key: 'notifications',
        label: tr('settings.benachrichtigungen'),
        changed: next.emailOnInquiry !== baseline.emailOnInquiry,
        value: { ...(raw.current.notifications ?? {}), emailOnInquiry: next.emailOnInquiry },
        apply: (b) => ({ ...b, emailOnInquiry: next.emailOnInquiry }),
      },
      {
        key: 'maintenance_mode',
        label: tr('settings.wartungsmodus'),
        changed: JSON.stringify([next.maintenance, next.i18n.maintenance]) !== JSON.stringify([baseline.maintenance, baseline.i18n.maintenance]),
        value: withTranslations(raw.current.maintenance_mode, { enabled: next.maintenance.enabled, message: next.maintenance.message }, next.i18n.maintenance),
        apply: (b) => ({ ...b, maintenance: next.maintenance, i18n: { ...b.i18n, maintenance: next.i18n.maintenance } }),
      },
    ];

    let snapshot = baseline;
    const failed: string[] = [];
    for (const job of jobs.filter((j) => j.changed)) {
      try {
        await api.updateSetting(job.key, job.value);
        raw.current[job.key] = job.value;
        snapshot = job.apply(snapshot);
      } catch (err) {
        if (job.key === 'company' && fieldMessages(err, 'value.inquiryEmail').length > 0) {
          setEmailError(tr('common.gebenSieEineGueltige'));
          failed.push(tr('settings.ungueltigeEMailAdresse', { label: job.label }));
        } else {
          failed.push(`${job.label}: ${errorText(err)}`);
        }
      }
    }
    onSaved(snapshot);
    setBusy(false);
    if (failed.length === 0) toast.success(tr('settings.gespeichert'), tr('settings.websiteEinstellungen'));
    else toast.error(tr('settings.nichtAllesGespeichert'), failed.join(' · '), { duration: 10000 });
  }

  return (
    <SettingsPanel
      id="general-h"
      title={tt('settings.websiteEinstellungen')}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || busy}
            onClick={() => {
              setForm(baseline);
              setEmailError(null);
            }}
          >
            {tt('common.verwerfen')}
          </Button>
          <Button size="sm" loading={busy || saving} disabled={!dirty} onClick={() => void handleSave()}>
            {tt('common.speichern')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <Field label={tt('settings.firmenname')}>
          <Input value={form.company.name} onChange={(e) => setCompany({ name: e.target.value })} autoComplete="organization" />
        </Field>
        <Field label={tt('settings.eMailFuerNeue')} error={emailError}>
          <Input
            type="email"
            value={form.company.inquiryEmail}
            onChange={(e) => {
              setCompany({ inquiryEmail: e.target.value });
              setEmailError(null);
            }}
            placeholder="anfragen@ihre-domain.ch"
            autoComplete="off"
          />
        </Field>
        <Field label={tt('common.telefon')}>
          <Input type="tel" value={form.company.phone} onChange={(e) => setCompany({ phone: e.target.value })} placeholder="+41 44 123 45 67" autoComplete="tel" />
        </Field>
      </div>

      {/* Firmenadresse: Verträge, Rechnungen (QR-Rechnung) und E-Mail-Fuss */}
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">{tt('settings.companyAddress')}</legend>
        <p className="sm mut -mt-1">{tt('settings.companyAddressHint')}</p>
        <div className="grid grid-cols-6 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Field label={tt('settings.companyStreet')} className="col-span-3 max-lg:col-span-2 max-sm:col-span-1">
            <Input value={form.company.street} onChange={(e) => setCompany({ street: e.target.value })} autoComplete="address-line1" maxLength={120} />
          </Field>
          <Field label={tt('settings.companyZip')} className="col-span-1 max-lg:col-span-1">
            <Input value={form.company.zip} onChange={(e) => setCompany({ zip: e.target.value })} autoComplete="postal-code" maxLength={20} className="num" />
          </Field>
          <Field label={tt('settings.companyCity')} className="col-span-2 max-lg:col-span-1">
            <Input value={form.company.city} onChange={(e) => setCompany({ city: e.target.value })} autoComplete="address-level2" maxLength={80} />
          </Field>
          <Field label={tt('settings.companyCountry')} className="col-span-2 max-lg:col-span-1">
            <Input value={form.company.country} onChange={(e) => setCompany({ country: e.target.value })} autoComplete="country-name" maxLength={60} placeholder={tt('settings.companyCountryPlaceholder')} />
          </Field>
          <Field label={tt('settings.companyUid')} className="col-span-4 max-lg:col-span-1" hint={tt('settings.companyUidHint')}>
            <Input value={form.company.uid} onChange={(e) => setCompany({ uid: e.target.value })} maxLength={40} placeholder={tt('settings.cHEXXXXXXXXX')} className="num" />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <LanguageTabs value={lang} onChange={setLang} states={generalStates} idPrefix="general-lang" />
        <LanguageNote locale={lang} />
      </div>

      {lang !== 'de' ? (
        <GeneralTranslationFields
          locale={lang as TranslatableLocale}
          seo={form.i18n.seo[lang as TranslatableLocale]}
          maintenance={form.i18n.maintenance[lang as TranslatableLocale]}
          base={{ metaTitle: form.seo.metaTitle, metaDescription: form.seo.metaDescription, message: form.maintenance.message }}
          onSeo={(patch) =>
            setForm((f) => ({
              ...f,
              i18n: { ...f.i18n, seo: { ...f.i18n.seo, [lang]: { ...f.i18n.seo[lang as TranslatableLocale], ...patch } } },
            }))
          }
          onMaintenance={(message) =>
            setForm((f) => ({ ...f, i18n: { ...f.i18n, maintenance: { ...f.i18n.maintenance, [lang]: { message } } } }))
          }
        />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <Field label={tt('settings.titelInSuchmaschinen')} hint={<CountHint length={form.seo.metaTitle.length} max={SEO_TITLE_MAX} extra={<> {tt('settings.leerLassenFuerDen')}</>} />}>
          <Input
            value={form.seo.metaTitle}
            onChange={(e) => setSeo({ metaTitle: e.target.value })}
            placeholder={tt('settings.hoppDriveAutovermietungInDer')}
          />
        </Field>
        <Field
          label={tt('settings.beschreibungInSuchmaschinen')}
          hint={<CountHint length={form.seo.metaDescription.length} max={SEO_DESCRIPTION_MAX} extra={<> {tt('settings.leerLassenFuerDie')}</>} />}
        >
          <Textarea
            rows={3}
            value={form.seo.metaDescription}
            onChange={(e) => setSeo({ metaDescription: e.target.value })}
            placeholder={tt('settings.fahrzeugeFuerTageWochen')}
          />
        </Field>
      </div>

      <Field label={tt('settings.socialPreviewBildURL')} hint={tt('settings.n1200630PxEmpfohlen')}>
        <Input
          value={form.seo.ogImageUrl}
          onChange={(e) => setSeo({ ogImageUrl: e.target.value })}
          placeholder={tt('settings.httpsHoppdriveChOg')}
          inputMode="url"
          className="num"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <div className="rounded-xl border border-line px-4 py-2">
          <Switch
            checked={form.emailOnInquiry}
            onChange={(emailOnInquiry) => setForm((f) => ({ ...f, emailOnInquiry }))}
            label={tt('settings.eMailBeiNeuer')}
            description={tt('settings.benachrichtigungAnDieAdresse')}
            labelPosition="left"
          />
        </div>
        <div className="rounded-xl border border-line px-4 py-2">
          <Switch
            checked={form.maintenance.enabled}
            onChange={(next) => void toggleMaintenance(next)}
            label={tt('settings.wartungsmodus')}
            description={tt('settings.websiteZeigtEinenHinweis')}
            labelPosition="left"
          />
        </div>
      </div>

      {form.maintenance.enabled && (
        <Field label={tt('settings.hinweisImWartungsmodus')} hint={tt('settings.optionalLeerLassenFuer')}>
          <Textarea
            rows={2}
            value={form.maintenance.message}
            maxLength={1000}
            onChange={(e) => setForm((f) => ({ ...f, maintenance: { ...f.maintenance, message: e.target.value } }))}
            placeholder={tt('settings.wirSindGleichWieder')}
          />
        </Field>
      )}
      </>
      )}
    </SettingsPanel>
  );
}
