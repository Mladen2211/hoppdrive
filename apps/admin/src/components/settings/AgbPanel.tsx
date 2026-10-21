'use client';

/**
 * Einstellungen > Dokumente > AGB. The terms (AGB) are appended to every contract and offered on the
 * website. The bundled file is used until a PDF is uploaded; "Zurücksetzen" goes back to it.
 */
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Skeleton, StatusPill, useConfirm, useToast } from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api, type ApiError } from '@/lib/api';
import { agbUrl, fmtFileSize } from '@/lib/doc-pdf';
import { errorText } from '@/lib/errors';
import { fmtDateTime } from '@/lib/format';
import { tr } from '@/i18n/active';
import { FileDropzone } from './FileDropzone';
import { SettingsPanel } from './SettingsPanel';

const MAX_PDF_MB = 10;

interface AgbInfo {
  custom: boolean;
  size: number;
  pages: number | null;
  updatedAt: string;
}

export function AgbPanel() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canEdit = useCan('websiteSettings', 'edit');

  const [info, setInfo] = useState<AgbInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await api.getAgbInfo());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, tr('documents.agb.loadFailed')));
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function upload(file: File) {
    if (info?.custom) {
      const ok = await confirm({
        title: t('documents.agb.replaceTitle'),
        description: t('documents.agb.replaceText'),
        confirmLabel: t('documents.agb.replaceAction'),
        tone: 'primary',
      });
      if (!ok) return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadAgb(file);
      toast.success(tr('documents.agb.uploaded'), tr('documents.agb.uploadedText'));
      await load();
    } catch (err) {
      const e = err as Partial<ApiError>;
      setUploadError(
        e.code === 'invalid_pdf'
          ? tr('documents.agb.errInvalid')
          : e.code === 'unsupported_file'
            ? tr('documents.agb.errUnsupported')
            : e.status === 413
              ? tr('documents.dropzone.tooLarge', { max: MAX_PDF_MB })
              : errorText(err, tr('documents.agb.errUpload')),
      );
    } finally {
      setUploading(false);
    }
  }

  async function reset() {
    const done = await confirm({
      title: t('documents.agb.resetTitle'),
      description: t('documents.agb.resetText'),
      confirmLabel: t('documents.agb.resetAction'),
      tone: 'primary',
      icon: <RotateCcw size={20} />,
      onConfirm: async () => {
        try {
          await api.resetAgb();
        } catch (err) {
          throw new Error(errorText(err, tr('documents.agb.resetFailed')));
        }
      },
    });
    if (!done) return;
    toast.success(tr('documents.agb.resetDone'), tr('documents.agb.resetDoneText'));
    await load();
  }

  return (
    <SettingsPanel
      id="doc-agb-h"
      title={t('documents.agb.title')}
      subtitle={t('documents.agb.subtitle')}
      actions={
        <Button href={agbUrl()} target="_blank" variant="outline" size="sm" iconLeft={<ExternalLink size={16} aria-hidden="true" />}>
          {t('documents.agb.view')}
        </Button>
      }
    >
      {loadError && (
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
      )}
      {!info && !loadError ? (
        <Skeleton className="h-[64px] w-full" rounded={12} />
      ) : info ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <b className="font-semibold">{info.custom ? t('documents.agb.customTitle') : t('documents.agb.bundledTitle')}</b>
              <StatusPill tone={info.custom ? 'green' : 'gray'} label={info.custom ? t('documents.agb.custom') : t('documents.agb.bundled')} />
            </span>
            <span className="sm mut">
              {fmtFileSize(info.size)}
              {info.pages ? ` · ${t('documents.agb.pages', { count: info.pages })}` : ''}
              {info.custom ? ` · ${t('documents.agb.updated', { date: fmtDateTime(info.updatedAt) })}` : ''}
            </span>
          </div>
          {canEdit && info.custom && (
            <Button variant="ghost" size="sm" iconLeft={<RotateCcw size={16} aria-hidden="true" />} onClick={() => void reset()}>
              {t('documents.agb.reset')}
            </Button>
          )}
        </div>
      ) : null}
      {canEdit && (
        <FileDropzone
          compact
          accept="application/pdf,.pdf"
          maxMb={MAX_PDF_MB}
          title={t('documents.agb.dropTitle')}
          hint={t('documents.agb.dropHint', { max: MAX_PDF_MB })}
          wrongTypeText={t('documents.agb.errUnsupported')}
          loading={uploading}
          error={uploadError}
          onFile={(file) => void upload(file)}
        />
      )}
    </SettingsPanel>
  );
}
