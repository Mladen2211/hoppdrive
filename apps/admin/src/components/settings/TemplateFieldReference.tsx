'use client';

/**
 * Reference of every field name the contract fill engine knows (text fields + the two signature
 * fields) with a description in the active language. The name can be copied to the clipboard, so it
 * can be pasted into the field properties of the PDF editor.
 */
import { Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CONTRACT_SIGNATURE_FIELDS, CONTRACT_TEMPLATE_FIELDS } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Button, IconButton, StatusPill, useToast } from '@/components/ui';
import { SettingsPanel } from './SettingsPanel';

export function TemplateFieldReference() {
  const t = useTranslations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      toast.success(t('documents.reference.copied'), key);
    } catch {
      toast.error(t('documents.reference.copyFailed'), key);
    }
  }

  const row = (key: string, extra?: ReactNode) => (
    <li key={key} className="flex items-center gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <code className="w-[170px] flex-none break-all text-[13px] font-semibold max-sm:w-[130px]">{key}</code>
      <span className="min-w-0 flex-1 text-sm">
        {t(`documents.fields.${key}`)} {extra}
      </span>
      <IconButton aria-label={t('documents.reference.copy', { key })} onClick={() => void copy(key)}>
        <Copy size={18} aria-hidden="true" />
      </IconButton>
    </li>
  );

  return (
    <SettingsPanel
      id="doc-reference-h"
      title={t('documents.reference.title')}
      subtitle={t('documents.reference.subtitle')}
      actions={
        <Button variant="ghost" size="sm" aria-expanded={open} aria-controls="doc-reference-body" onClick={() => setOpen((v) => !v)}>
          {open ? t('documents.reference.hide') : t('documents.reference.show')}
        </Button>
      }
    >
      {open && (
        <div id="doc-reference-body" className="flex flex-col gap-4">
          <section aria-labelledby="doc-ref-text-h">
            <h3 id="doc-ref-text-h" className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">
              {t('documents.reference.textFields')}
            </h3>
            <ul className="m-0 list-none p-0">
              {CONTRACT_TEMPLATE_FIELDS.map((f) =>
                row(f.key, f.multiline ? <StatusPill tone="gray" plain label={t('documents.reference.multiline')} className="ml-1 align-middle" /> : undefined),
              )}
            </ul>
          </section>
          <section aria-labelledby="doc-ref-sig-h">
            <h3 id="doc-ref-sig-h" className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-graphite">
              {t('documents.reference.signatureFields')}
            </h3>
            <p className="sm mut mb-1">{t('documents.reference.signatureNote')}</p>
            <ul className="m-0 list-none p-0">{CONTRACT_SIGNATURE_FIELDS.map((f) => row(f.key))}</ul>
          </section>
        </div>
      )}
    </SettingsPanel>
  );
}
