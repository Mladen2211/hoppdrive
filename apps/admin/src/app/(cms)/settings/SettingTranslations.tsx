'use client';

/**
 * Translation fields of the translatable website settings (pricing marketing copy, trust features,
 * search-engine texts, maintenance message, map title). They edit the setting's `i18n[locale]` blob;
 * German stays in the normal fields. The German text is the placeholder, empty = German is shown.
 */
import type { AppLocale, TranslatableLocale } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { TranslatedField } from '@/components/content/TranslatedField';
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, type FeaturesSetting, type LocationSetting, type PricingCopy } from '@/lib/settings-defaults';
import { i18nStates, i18nText, setI18nText } from '@/lib/settings-i18n';
import type { TranslationState } from '@/lib/translations';
import { CountHint } from '@/components/content/homepage/fields';

type States = Partial<Record<AppLocale, TranslationState>>;

// ─── Pricing marketing copy ─────────────────────────────────────

export function pricingStates(pricing: PricingCopy): States {
  return i18nStates(pricing, [
    { base: pricing.title, path: ['title'] },
    ...pricing.tiers.flatMap((tier, i) => [
      { base: tier.title, path: ['tiers', i, 'title'] as (string | number)[] },
      { base: tier.description, path: ['tiers', i, 'description'] as (string | number)[] },
      { base: tier.badge, path: ['tiers', i, 'badge'] as (string | number)[] },
    ]),
  ]);
}

export function PricingTranslationFields({
  locale,
  pricing,
  onChange,
}: {
  locale: TranslatableLocale;
  pricing: PricingCopy;
  onChange: (next: PricingCopy) => void;
}) {
  const t = useTranslations();
  const set = (path: (string | number)[], value: string) => onChange(setI18nText(pricing, locale, path, value));
  return (
    <div className="flex flex-col gap-4">
      <TranslatedField locale={locale} label={t('common.titel')} base={pricing.title} value={i18nText(pricing, locale, ['title'])} onChange={(v) => set(['title'], v)} />
      <div className="flex flex-col gap-3" role="group" aria-label={t('settings.stufen')}>
        <span className="lbl">{t('settings.stufen')}</span>
        {pricing.tiers.map((tier, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-row p-3.5 max-sm:grid-cols-1">
            <TranslatedField
              locale={locale}
              label={`${t('common.titel')} ${tier.number || idx + 1}`}
              base={tier.title}
              value={i18nText(pricing, locale, ['tiers', idx, 'title'])}
              onChange={(v) => set(['tiers', idx, 'title'], v)}
            />
            <TranslatedField
              locale={locale}
              label={t('settings.badge')}
              base={tier.badge}
              value={i18nText(pricing, locale, ['tiers', idx, 'badge'])}
              onChange={(v) => set(['tiers', idx, 'badge'], v)}
            />
            <TranslatedField
              locale={locale}
              label={t('common.beschreibung')}
              base={tier.description}
              value={i18nText(pricing, locale, ['tiers', idx, 'description'])}
              multiline
              rows={2}
              className="col-span-2 max-sm:col-span-1"
              onChange={(v) => set(['tiers', idx, 'description'], v)}
            />
          </div>
        ))}
        {pricing.tiers.length === 0 && <p className="sm mut">{t('content.nochKeineEintraege')}</p>}
      </div>
    </div>
  );
}

// ─── Trust features ─────────────────────────────────────────────

export function featuresStates(features: FeaturesSetting): States {
  return i18nStates(
    features,
    features.items.flatMap((item, i) => [
      { base: item.title, path: ['items', i, 'title'] as (string | number)[] },
      { base: item.description, path: ['items', i, 'description'] as (string | number)[] },
    ]),
  );
}

export function FeaturesTranslationFields({
  locale,
  features,
  onChange,
}: {
  locale: TranslatableLocale;
  features: FeaturesSetting;
  onChange: (next: FeaturesSetting) => void;
}) {
  const t = useTranslations();
  const set = (path: (string | number)[], value: string) => onChange(setI18nText(features, locale, path, value));
  return (
    <div className="flex flex-col gap-3">
      {features.items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-row p-3.5 max-sm:grid-cols-1">
          <TranslatedField
            locale={locale}
            label={`${t('common.titel')} ${idx + 1}`}
            base={item.title}
            value={i18nText(features, locale, ['items', idx, 'title'])}
            onChange={(v) => set(['items', idx, 'title'], v)}
          />
          <TranslatedField
            locale={locale}
            label={t('common.beschreibung')}
            base={item.description}
            value={i18nText(features, locale, ['items', idx, 'description'])}
            onChange={(v) => set(['items', idx, 'description'], v)}
          />
        </div>
      ))}
      {features.items.length === 0 && <p className="sm mut">{t('content.nochKeineEintraege')}</p>}
    </div>
  );
}

// ─── Map title ──────────────────────────────────────────────────

export function locationStates(location: LocationSetting): States {
  return i18nStates(location, [{ base: location.title, path: ['title'] }]);
}

export function LocationTranslationFields({
  locale,
  location,
  onChange,
}: {
  locale: TranslatableLocale;
  location: LocationSetting;
  onChange: (next: LocationSetting) => void;
}) {
  const t = useTranslations();
  return (
    <TranslatedField
      locale={locale}
      label={t('common.titel')}
      base={location.title}
      value={i18nText(location, locale, ['title'])}
      onChange={(v) => onChange(setI18nText(location, locale, ['title'], v))}
    />
  );
}

// ─── Search engines + maintenance message (part of the "Website-Einstellungen" form) ───

export interface GeneralI18n {
  seo: Record<TranslatableLocale, { metaTitle: string; metaDescription: string }>;
  maintenance: Record<TranslatableLocale, { message: string }>;
}

export function GeneralTranslationFields({
  locale,
  seo,
  maintenance,
  base,
  onSeo,
  onMaintenance,
}: {
  locale: TranslatableLocale;
  seo: { metaTitle: string; metaDescription: string };
  maintenance: { message: string };
  base: { metaTitle: string; metaDescription: string; message: string };
  onSeo: (patch: Partial<{ metaTitle: string; metaDescription: string }>) => void;
  onMaintenance: (message: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <TranslatedField
          locale={locale}
          label={t('settings.titelInSuchmaschinen')}
          base={base.metaTitle}
          value={seo.metaTitle}
          hint={<CountHint length={seo.metaTitle.length} max={SEO_TITLE_MAX} />}
          onChange={(v) => onSeo({ metaTitle: v })}
        />
        <TranslatedField
          locale={locale}
          label={t('settings.beschreibungInSuchmaschinen')}
          base={base.metaDescription}
          value={seo.metaDescription}
          multiline
          rows={3}
          hint={<CountHint length={seo.metaDescription.length} max={SEO_DESCRIPTION_MAX} />}
          onChange={(v) => onSeo({ metaDescription: v })}
        />
      </div>
      <TranslatedField
        locale={locale}
        label={t('settings.hinweisImWartungsmodus')}
        base={base.message}
        value={maintenance.message}
        multiline
        rows={2}
        maxLength={1000}
        onChange={onMaintenance}
      />
    </div>
  );
}
