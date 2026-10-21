'use client';

/**
 * Field building blocks of the homepage section editors, built on the design-system form primitives.
 *
 *  - TextField         one input / textarea with label, hint and an optional soft character counter
 *  - ArrayStringEditor a list of single-line texts (add / remove)
 *  - ArrayObjectEditor a list of small cards with several fields (add / remove)
 *
 * The counter is a recommendation ("28 von 60 Zeichen"), not a hard limit: existing content that is
 * already longer stays editable and is never cut off.
 */
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Field, IconButton, Input, Textarea, cn } from '@/components/ui';
import { countText } from '@/lib/content-homepage';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

export function CountHint({ length, max, extra }: { length: number; max: number; extra?: ReactNode }) {
  const t = useTranslations();
  const over = length > max;
  return (
    <span className={cn(over && 'font-semibold text-warn')}>
      {countText(length, max)}
      {over && t('content.laengerAlsEmpfohlen')}
      {extra}
    </span>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  /** Recommended maximum length: shows the live counter. */
  max?: number;
  hint?: ReactNode;
  placeholder?: string;
  className?: string;
}

export function TextField({ label, value, onChange, multiline, rows = 3, max, hint, placeholder, className }: TextFieldProps) {
  const counter = max !== undefined ? <CountHint length={value.length} max={max} extra={hint ? <> · {hint}</> : undefined} /> : hint;
  return (
    <Field label={label} hint={counter} className={className}>
      {multiline ? (
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </Field>
  );
}

export function ArrayStringEditor({
  label,
  items,
  onChange,
  itemName = tr('content.eintrag'),
  addLabel = tr('content.eintragHinzufuegen'),
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** Singular used in aria-labels: "Vertrauenssignal 2 entfernen". */
  itemName?: string;
  addLabel?: string;
}) {
  const t = useTranslations();
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2.5">
      <span className="lbl">{label}</span>
      {items.length === 0 && <p className="sm mut">{t('content.nochKeineEintraege')}</p>}
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            aria-label={`${itemName} ${idx + 1}`}
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[idx] = e.target.value;
              onChange(next);
            }}
          />
          <IconButton
            aria-label={t('content.removeItem', { name: itemName, number: idx + 1 })}
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="flex-none text-err"
          >
            <Trash2 size={20} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
      <div>
        <Button variant="ghost" size="sm" onClick={() => onChange([...items, ''])} iconLeft={<Plus size={16} aria-hidden="true" />}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

export interface ObjectField {
  key: string;
  label: string;
  multiline?: boolean;
  hint?: string;
}

export function ArrayObjectEditor({
  label,
  items,
  fields,
  onChange,
  itemName = tr('content.eintrag'),
  addLabel = tr('content.eintragHinzufuegen'),
}: {
  label: string;
  items: Record<string, string>[];
  fields: ObjectField[];
  onChange: (items: Record<string, string>[]) => void;
  itemName?: string;
  addLabel?: string;
}) {
  const t = useTranslations();
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <span className="lbl">{label}</span>
      {items.length === 0 && <p className="sm mut">{t('content.nochKeineEintraege')}</p>}
      {items.map((item, idx) => (
        <div key={idx} className="rounded-xl border border-line bg-row p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <b className="text-sm font-semibold">
              {itemName} {idx + 1}
            </b>
            <IconButton
              aria-label={t('content.removeItem', { name: itemName, number: idx + 1 })}
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="-my-1 text-err"
            >
              <Trash2 size={20} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="flex flex-col gap-3">
            {fields.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                hint={f.hint}
                multiline={f.multiline}
                rows={2}
                value={item[f.key] || ''}
                onChange={(v) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], [f.key]: v };
                  onChange(next);
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const empty: Record<string, string> = {};
            fields.forEach((f) => (empty[f.key] = ''));
            onChange([...items, empty]);
          }}
          iconLeft={<Plus size={16} aria-hidden="true" />}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
