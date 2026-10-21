'use client';

/**
 * Editor of ONE homepage section in a non-German language. It edits the translations blob (same shape
 * as the German content) field by field; the German text is the placeholder and an empty field falls back
 * to German on the website. Lists follow the German order, so items cannot be added or removed here.
 */
import type { AppLocale } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { TranslatedField } from '@/components/content/TranslatedField';
import { SECTION_TRANSLATABLE } from '@/lib/content-translations';
import { getAt, setAt, type Json } from '@/lib/translations';

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface TranslationEditorProps {
  sectionKey: string;
  locale: AppLocale;
  /** German content of the section. */
  base: Json;
  /** translations[locale] of the section (may be empty). */
  blob: Json;
  onChange: (blob: Json) => void;
  disabled?: boolean;
}

export function TranslationEditor({ sectionKey, locale, base, blob, onChange, disabled }: TranslationEditorProps) {
  const t = useTranslations();
  const schema = SECTION_TRANSLATABLE[sectionKey];
  if (!schema) return <p className="mut">{t('localeTabs.nothingToTranslate')}</p>;

  const set = (path: (string | number)[], value: string) => onChange(setAt(blob, path, value));

  return (
    <div className="flex flex-col gap-[18px]">
      {schema.fields.map((f) => (
        <TranslatedField
          key={f.key}
          locale={locale}
          label={t(f.labelKey)}
          base={text(base[f.key])}
          value={text(blob[f.key])}
          multiline={f.multiline}
          disabled={disabled}
          onChange={(v) => set([f.key], v)}
        />
      ))}

      {(schema.stringLists ?? []).map((def) => {
        const items = list(base[def.key]);
        if (items.length === 0) return null;
        return (
          <div key={def.key} role="group" aria-label={t(def.labelKey)} className="flex flex-col gap-2.5">
            <span className="lbl">{t(def.labelKey)}</span>
            {items.map((item, idx) => (
              <TranslatedField
                key={idx}
                locale={locale}
                label={`${t(def.itemNameKey)} ${idx + 1}`}
                base={text(item)}
                value={text(getAt(blob, [def.key, idx]))}
                disabled={disabled}
                onChange={(v) => set([def.key, idx], v)}
              />
            ))}
          </div>
        );
      })}

      {(schema.objectLists ?? []).map((def) => {
        const items = list(base[def.key]);
        if (items.length === 0) return null;
        return (
          <div key={def.key} role="group" aria-label={t(def.labelKey)} className="flex flex-col gap-3">
            <span className="lbl">{t(def.labelKey)}</span>
            {items.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-line bg-row p-3.5">
                <b className="mb-2.5 block text-sm font-semibold">
                  {t(def.itemNameKey)} {idx + 1}
                </b>
                <div className="flex flex-col gap-3">
                  {def.fields.map((f) => (
                    <TranslatedField
                      key={f.key}
                      locale={locale}
                      label={t(f.labelKey)}
                      base={text(getAt(item, [f.key]))}
                      value={text(getAt(blob, [def.key, idx, f.key]))}
                      multiline={f.multiline}
                      rows={2}
                      disabled={disabled}
                      onChange={(v) => set([def.key, idx, f.key], v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
