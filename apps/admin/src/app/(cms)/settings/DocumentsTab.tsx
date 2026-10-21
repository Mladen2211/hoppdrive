'use client';

/**
 * Einstellungen > Dokumente (?tab=documents, permission area websiteSettings):
 *  - Vertragsvorlage: fillable PDF with field report, starter template, history, preview
 *  - Feldnamen der Vorlage: copyable reference
 *  - Unterzeichner: which administrator signs for the company
 *  - AGB: bundled or uploaded terms
 */
import { Alert } from '@/components/ui';
import { useCan } from '@/hooks/usePermission';
import { useTranslations } from 'next-intl';
import { AgbPanel } from '@/components/settings/AgbPanel';
import { ContractSignerPanel } from '@/components/settings/ContractSignerPanel';
import { ContractTemplatePanel } from '@/components/settings/ContractTemplatePanel';
import { TemplateFieldReference } from '@/components/settings/TemplateFieldReference';

export function DocumentsTab() {
  const t = useTranslations();
  const canEdit = useCan('websiteSettings', 'edit');
  return (
    <div className="flex max-w-[980px] flex-col gap-6">
      {!canEdit && <Alert tone="info">{t('documents.readOnly')}</Alert>}
      <ContractTemplatePanel />
      <TemplateFieldReference />
      <ContractSignerPanel />
      <AgbPanel />
    </div>
  );
}
