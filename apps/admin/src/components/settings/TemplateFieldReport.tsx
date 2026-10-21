'use client';

/**
 * Field report of an uploaded contract template (what the fill engine found in the PDF form):
 * recognised fields, unknown fields (they stay empty, usually a typo), the two signature fields and
 * recommended fields that are missing. Every state has an icon and a word, never colour alone.
 */
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { CONTRACT_SIGNATURE_FIELDS, type ContractTemplateFieldReport } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, StatusPill } from '@/components/ui';

const SIGNATURE_KEYS = CONTRACT_SIGNATURE_FIELDS.map((f) => f.key);

export function FieldChip({ fieldKey, tone }: { fieldKey: string; tone: 'ok' | 'warn' }) {
  const t = useTranslations();
  const known = tone === 'ok';
  return (
    <li
      className={
        known
          ? 'inline-flex max-w-full items-center gap-1.5 rounded-lg bg-ok-tint px-2.5 py-1 text-sm text-ok-ink'
          : 'inline-flex max-w-full items-center gap-1.5 rounded-lg bg-warn-tint px-2.5 py-1 text-sm text-warn-ink'
      }
    >
      {known ? <CircleCheck size={14} aria-hidden="true" className="flex-none" /> : <TriangleAlert size={14} aria-hidden="true" className="flex-none" />}
      <span className="min-w-0 break-words">
        {known ? t(`documents.fields.${fieldKey}`) : null}
        {known && ' '}
        <code className={known ? 'text-xs opacity-80' : 'text-sm font-semibold'}>{fieldKey}</code>
      </span>
    </li>
  );
}

export function TemplateFieldReport({ report }: { report: ContractTemplateFieldReport }) {
  const t = useTranslations();
  const knownFields = report.known.filter((k) => !SIGNATURE_KEYS.includes(k));
  const missing = report.missingRecommended.filter((k) => !SIGNATURE_KEYS.includes(k));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="gray" plain label={t('documents.report.total', { count: report.fields.length })} />
        <StatusPill tone="green" label={t('documents.report.known', { count: report.known.length })} />
        {report.unknown.length > 0 && <StatusPill tone="amber" label={t('documents.report.unknown', { count: report.unknown.length })} />}
        {missing.length > 0 && <StatusPill tone="amber" label={t('documents.report.missing', { count: missing.length })} />}
      </div>

      <section aria-label={t('documents.report.signatureTitle')} className="flex flex-col gap-2">
        <h4 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('documents.report.signatureTitle')}</h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SIGNATURE_KEYS.map((key) => {
            const found = report.signatureFields.includes(key);
            return (
              <li key={key} className="flex items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                {found ? (
                  <CircleCheck size={18} aria-hidden="true" className="mt-0.5 flex-none text-ok" />
                ) : (
                  <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 flex-none text-warn" />
                )}
                <span className="min-w-0">
                  <b className="font-semibold">{t(`documents.fields.${key}`)}</b> <code className="text-xs text-graphite">{key}</code>
                  <br />
                  <span className="mut">{found ? t('documents.report.signatureFound') : t('documents.report.signatureMissing')}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {report.unknown.length > 0 && (
        <Alert tone="warn" title={t('documents.report.unknownTitle')}>
          <p>{t('documents.report.unknownText')}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {report.unknown.map((key) => (
              <FieldChip key={key} fieldKey={key} tone="warn" />
            ))}
          </ul>
        </Alert>
      )}

      {missing.length > 0 && (
        <Alert tone="info" title={t('documents.report.missingTitle')}>
          <p>{t('documents.report.missingText')}</p>
          <ul className="mt-2 list-disc pl-5">
            {missing.map((key) => (
              <li key={key}>
                {t(`documents.fields.${key}`)} <code className="text-xs text-graphite">{key}</code>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {knownFields.length > 0 && (
        <section aria-label={t('documents.report.knownTitle')} className="flex flex-col gap-2">
          <h4 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('documents.report.knownTitle')}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {knownFields.map((key) => (
              <FieldChip key={key} fieldKey={key} tone="ok" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
