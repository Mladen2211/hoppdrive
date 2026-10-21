'use client';

/**
 * History of the uploaded contract templates: table from 768 px, cards below. The active one is
 * marked; every other one can be activated. Preview / download / rename / delete sit in the menu.
 */
import { Download, Eye, Pencil, Trash2 } from 'lucide-react';
import type { ContractTemplateDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Button, Cell2, Menu, MobileCard, ResponsiveList, StatusPill, Table, TBody, Td, Th, THead, Tr, type MenuItem } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';

export interface TemplateHistoryProps {
  templates: ContractTemplateDto[];
  canEdit: boolean;
  busyId: string | null;
  onActivate: (template: ContractTemplateDto) => void;
  onPreview: (template: ContractTemplateDto) => void;
  onDownload: (template: ContractTemplateDto) => void;
  onRename: (template: ContractTemplateDto) => void;
  onDelete: (template: ContractTemplateDto) => void;
  onShowReport: (template: ContractTemplateDto) => void;
}

export function TemplateHistory({ templates, canEdit, busyId, onActivate, onPreview, onDownload, onRename, onDelete, onShowReport }: TemplateHistoryProps) {
  const t = useTranslations();

  const menuFor = (template: ContractTemplateDto): MenuItem[] => {
    const items: MenuItem[] = [
      { key: 'preview', label: t('documents.template.preview'), icon: <Eye size={18} />, onSelect: () => onPreview(template) },
      { key: 'download', label: t('documents.template.download'), icon: <Download size={18} />, onSelect: () => onDownload(template) },
    ];
    if (canEdit) {
      items.push({ key: 'rename', label: t('documents.template.rename'), icon: <Pencil size={18} />, onSelect: () => onRename(template) });
      items.push({ key: 'delete', label: t('documents.template.delete'), icon: <Trash2 size={18} />, danger: true, separatorBefore: true, onSelect: () => onDelete(template) });
    }
    return items;
  };

  const fieldsText = (template: ContractTemplateDto) => t('documents.template.fieldsOf', { known: template.fields.known.length, total: template.fields.fields.length });
  const usedText = (template: ContractTemplateDto) => t('documents.template.usedBy', { count: template.bookingCount });

  const activateButton = (template: ContractTemplateDto, fullWidth = false) =>
    canEdit && !template.isActive ? (
      <Button variant="outline" size="sm" className={fullWidth ? 'min-w-0 flex-1' : undefined} loading={busyId === template.id} onClick={() => onActivate(template)}>
        {t('documents.template.activate')}
      </Button>
    ) : null;

  return (
    <ResponsiveList
      table={
        <Table aria-label={t('documents.template.historyTitle')}>
          <THead>
            <Tr>
              <Th>{t('documents.template.colName')}</Th>
              <Th>{t('documents.template.colUploaded')}</Th>
              <Th>{t('documents.template.colFields')}</Th>
              <Th>{t('documents.template.colUsed')}</Th>
              <Th align="right">
                <span className="sr-only">{t('common.aktionen')}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {templates.map((template) => (
              <Tr key={template.id}>
                <Td>
                  <Cell2
                    primary={
                      <span className="flex flex-wrap items-center gap-2">
                        <button type="button" className="text-left font-semibold hover:underline" onClick={() => onShowReport(template)}>
                          {template.name}
                        </button>
                        {template.isActive && <StatusPill tone="green" label={t('documents.template.active')} />}
                      </span>
                    }
                    secondary={template.originalFileName}
                  />
                </Td>
                <Td>
                  <Cell2 primary={<span className="num">{fmtDateTime(template.createdAt)}</span>} secondary={template.uploadedByName ?? '–'} />
                </Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="num">{fieldsText(template)}</span>
                    {template.fields.unknown.length > 0 && <StatusPill tone="amber" label={t('documents.report.unknown', { count: template.fields.unknown.length })} />}
                  </span>
                </Td>
                <Td className="num">{usedText(template)}</Td>
                <Td>
                  <div className="acts items-center">
                    {activateButton(template)}
                    <Menu items={menuFor(template)} label={t('documents.template.moreActions', { name: template.name })} />
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      }
      cards={templates.map((template) => (
        <MobileCard
          key={template.id}
          title={template.name}
          subtitle={template.originalFileName ?? undefined}
          status={template.isActive ? <StatusPill tone="green" label={t('documents.template.active')} /> : undefined}
          onOpen={() => onShowReport(template)}
          actions={
            <>
              {activateButton(template, true)}
              <Menu items={menuFor(template)} label={t('documents.template.moreActions', { name: template.name })} />
            </>
          }
        >
          <p className="sm mut">
            <span className="num">{fmtDateTime(template.createdAt)}</span> · {template.uploadedByName ?? '–'}
          </p>
          <p className="sm">
            {fieldsText(template)}
            {template.fields.unknown.length > 0 && ` · ${t('documents.report.unknown', { count: template.fields.unknown.length })}`} · {usedText(template)}
          </p>
        </MobileCard>
      ))}
    />
  );
}
