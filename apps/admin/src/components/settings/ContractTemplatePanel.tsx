'use client';

/**
 * Einstellungen > Dokumente > Vertragsvorlage.
 *  - the active template (or "Eingebauter Vertrag aktiv") with its field report
 *  - upload (drag and drop or file picker, fillable PDF <= 10 MB) -> field report -> activate
 *  - starter template download with a short how-to
 *  - history of all uploads: activate, preview with a booking, download, rename, delete
 * A template that was used for a contract cannot be deleted (409 template_in_use).
 */
import { Download, Eye, FileText, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContractTemplateDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Input, Modal, Skeleton, StatusPill, useConfirm, useToast } from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api, type ApiError } from '@/lib/api';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtDateTime } from '@/lib/format';
import { tr } from '@/i18n/active';
import { FileDropzone } from './FileDropzone';
import { SettingsPanel } from './SettingsPanel';
import { TemplateFieldReport } from './TemplateFieldReport';
import { TemplateHistory } from './TemplateHistory';
import { TemplatePreviewModal } from './TemplatePreviewModal';

const MAX_PDF_MB = 10;

function uploadErrorText(err: unknown): string {
  const e = err as Partial<ApiError> | null;
  switch (e?.code) {
    case 'invalid_pdf':
      return tr('documents.template.errInvalidPdf');
    case 'no_form_fields':
      return tr('documents.template.errNoFields');
    case 'unsupported_file':
      return tr('documents.template.errUnsupported');
    case 'file_too_large':
      return tr('documents.dropzone.tooLarge', { max: MAX_PDF_MB });
    default:
      return e?.status === 413 ? tr('documents.dropzone.tooLarge', { max: MAX_PDF_MB }) : errorText(err, tr('documents.template.errUpload'));
  }
}

export function ContractTemplatePanel() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canEdit = useCan('websiteSettings', 'edit');

  const [templates, setTemplates] = useState<ContractTemplateDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // upload flow
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  // dialogs
  const [previewing, setPreviewing] = useState<ContractTemplateDto | null>(null);
  const [renaming, setRenaming] = useState<ContractTemplateDto | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [showReportId, setShowReportId] = useState<string | null>(null);
  const [starterLoading, setStarterLoading] = useState(false);
  const reviewRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    try {
      const rows = await api.getContractTemplates();
      setTemplates(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, tr('documents.template.loadFailed')));
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const active = templates?.find((tpl) => tpl.isActive) ?? null;
  const review = templates?.find((tpl) => tpl.id === reviewId) ?? null;

  // A template picked in the history (or just uploaded) shows its report: bring it into view.
  useEffect(() => {
    if (reviewId) reviewRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [reviewId, templates]);

  // ── Actions ───────────────────────────────────────────────────

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const created = await api.uploadContractTemplate(file, { name: name.trim() || undefined, activate: false });
      setName('');
      setReviewId(created.id);
      setShowReportId(null);
      toast.success(tr('documents.template.uploaded'), tr('documents.template.uploadedText', { name: created.name }));
      await load();
    } catch (err) {
      setUploadError(uploadErrorText(err));
    } finally {
      setUploading(false);
    }
  }

  async function activate(template: ContractTemplateDto) {
    setBusyId(template.id);
    try {
      await api.activateContractTemplate(template.id);
      if (reviewId === template.id) setReviewId(null);
      toast.success(tr('documents.template.activated'), tr('documents.template.activatedText', { name: template.name }));
      await load();
    } catch (err) {
      toast.error(tr('documents.template.activateFailed'), errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function switchToBuiltIn() {
    const done = await confirm({
      title: t('documents.template.builtInConfirmTitle'),
      description: t('documents.template.builtInConfirmText'),
      confirmLabel: t('documents.template.builtInConfirmAction'),
      tone: 'primary',
      icon: <RotateCcw size={20} />,
      onConfirm: async () => {
        try {
          await api.deactivateContractTemplates();
        } catch (err) {
          throw new Error(errorText(err, tr('documents.template.deactivateFailed')));
        }
      },
    });
    if (!done) return;
    toast.success(tr('documents.template.builtInActive'), tr('documents.template.builtInActiveText'));
    await load();
  }

  async function download(template: ContractTemplateDto) {
    setBusyId(template.id);
    try {
      triggerBlobDownload(await api.downloadContractTemplate(template.id), template.originalFileName || `${template.name}.pdf`);
    } catch (err) {
      toast.error(tr('documents.template.downloadFailed'), errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function downloadStarter() {
    setStarterLoading(true);
    try {
      triggerBlobDownload(await api.downloadContractStarter(), 'HoppDrive-Vertragsvorlage-Starter.pdf');
    } catch (err) {
      toast.error(tr('documents.template.starterFailed'), errorText(err));
    } finally {
      setStarterLoading(false);
    }
  }

  async function remove(template: ContractTemplateDto) {
    await confirm({
      title: t('documents.template.deleteConfirmTitle', { name: template.name }),
      description: t('documents.template.deleteConfirmText'),
      warning: template.bookingCount > 0 ? t('documents.template.inUse', { count: template.bookingCount }) : undefined,
      confirmLabel: t('documents.template.delete'),
      onConfirm: async () => {
        try {
          await api.deleteContractTemplate(template.id);
        } catch (err) {
          const e = err as Partial<ApiError>;
          if (e.code === 'template_in_use') throw new Error(t('documents.template.inUse', { count: template.bookingCount || 1 }));
          throw new Error(errorText(err, tr('documents.template.deleteFailed')));
        }
        if (reviewId === template.id) setReviewId(null);
        if (showReportId === template.id) setShowReportId(null);
        toast.success(tr('documents.template.deleted'), template.name);
        await load();
      },
    });
  }

  function openRename(template: ContractTemplateDto) {
    setRenameError(null);
    setRenameValue(template.name);
    setRenaming(template);
  }

  async function saveRename() {
    if (!renaming) return;
    const value = renameValue.trim();
    if (!value) {
      setRenameError(tr('documents.template.nameRequired'));
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      await api.renameContractTemplate(renaming.id, value);
      toast.success(tr('documents.template.renamed'), value);
      setRenaming(null);
      await load();
    } catch (err) {
      setRenameError(errorText(err, tr('documents.template.renameFailed')));
    } finally {
      setRenameSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  const templateMeta = (template: ContractTemplateDto) => (
    <span className="sm mut">
      {template.originalFileName ? `${template.originalFileName} · ` : ''}
      {t('documents.template.uploadedMeta', { date: fmtDateTime(template.createdAt), by: template.uploadedByName ?? '–' })}
    </span>
  );

  return (
    <SettingsPanel id="doc-template-h" title={t('documents.template.title')} subtitle={t('documents.template.subtitle')}>
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

      {/* ─── Active template ─── */}
      {templates === null && !loadError ? (
        <Skeleton className="h-[110px] w-full" rounded={12} />
      ) : templates ? (
        active ? (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-ok-tint text-ok" aria-hidden="true">
                  <FileText size={20} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-semibold">{active.name}</b>
                    <StatusPill tone="green" label={t('documents.template.active')} />
                  </span>
                  {templateMeta(active)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" iconLeft={<Eye size={16} aria-hidden="true" />} onClick={() => setPreviewing(active)}>
                  {t('documents.template.preview')}
                </Button>
                <Button variant="outline" size="sm" loading={busyId === active.id} iconLeft={<Download size={16} aria-hidden="true" />} onClick={() => void download(active)}>
                  {t('documents.template.download')}
                </Button>
                {canEdit && (
                  <Button variant="ghost" size="sm" iconLeft={<RotateCcw size={16} aria-hidden="true" />} onClick={() => void switchToBuiltIn()}>
                    {t('documents.template.useBuiltIn')}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="green" label={t('documents.report.known', { count: active.fields.known.length })} />
              <StatusPill
                tone={active.fields.signatureFields.length >= 2 ? 'green' : 'amber'}
                label={t('documents.report.signatures', { count: active.fields.signatureFields.length })}
              />
              {active.fields.unknown.length > 0 && <StatusPill tone="amber" label={t('documents.report.unknown', { count: active.fields.unknown.length })} />}
              <Button variant="ghost" size="sm" onClick={() => setShowReportId(showReportId === active.id ? null : active.id)} aria-expanded={showReportId === active.id}>
                {showReportId === active.id ? t('documents.template.hideReport') : t('documents.template.showReport')}
              </Button>
            </div>
            {showReportId === active.id && <TemplateFieldReport report={active.fields} />}
          </div>
        ) : (
          <Alert tone="info" title={t('documents.template.builtInTitle')} icon={<FileText size={20} />}>
            {t('documents.template.builtInText')}
          </Alert>
        )
      ) : null}

      {/* ─── Upload + review ─── */}
      {canEdit && (
        <section aria-labelledby="doc-upload-h" className="flex flex-col gap-3">
          <h3 id="doc-upload-h" className="text-[15px] font-semibold">
            {t('documents.template.uploadTitle')}
          </h3>
          <Field label={t('documents.template.nameLabel')} hint={t('documents.template.nameHint')} className="max-w-[420px]">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t('documents.template.namePlaceholder')} autoComplete="off" />
          </Field>
          <FileDropzone
            accept="application/pdf,.pdf"
            maxMb={MAX_PDF_MB}
            title={t('documents.template.dropTitle')}
            hint={t('documents.template.dropHint', { max: MAX_PDF_MB })}
            wrongTypeText={t('documents.template.errUnsupported')}
            loading={uploading}
            error={uploadError}
            onFile={(file) => void upload(file)}
          />
        </section>
      )}

      {review && (
        <section ref={reviewRef} aria-labelledby="doc-review-h" className="flex flex-col gap-3 rounded-xl border-[1.5px] border-ruby p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="doc-review-h" className="text-[15px] font-semibold">
                {t('documents.template.reviewTitle', { name: review.name })}
              </h3>
              <p className="sm mut">{review.isActive ? t('documents.template.reviewActive') : t('documents.template.reviewText')}</p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                {!review.isActive && (
                  <Button size="sm" loading={busyId === review.id} onClick={() => void activate(review)}>
                    {t('documents.template.activate')}
                  </Button>
                )}
                <Button variant="outline" size="sm" iconLeft={<Eye size={16} aria-hidden="true" />} onClick={() => setPreviewing(review)}>
                  {t('documents.template.preview')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReviewId(null)}>
                  {review.isActive ? t('documents.close') : t('documents.template.later')}
                </Button>
              </div>
            )}
            {!canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setReviewId(null)}>
                {t('documents.close')}
              </Button>
            )}
          </div>
          {!review.isActive && review.fields.unknown.length === 0 && review.fields.missingRecommended.length === 0 && (
            <Alert tone="ok">{t('documents.template.reviewPerfect')}</Alert>
          )}
          <TemplateFieldReport report={review.fields} />
        </section>
      )}

      {/* ─── Starter + how-to ─── */}
      <section aria-labelledby="doc-starter-h" className="flex flex-col gap-3 rounded-xl bg-row p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="doc-starter-h" className="text-[15px] font-semibold">
              {t('documents.template.starterTitle')}
            </h3>
            <p className="sm mut">{t('documents.template.starterText')}</p>
          </div>
          <Button variant="outline" size="sm" loading={starterLoading} iconLeft={<Download size={16} aria-hidden="true" />} onClick={() => void downloadStarter()}>
            {t('documents.template.starterButton')}
          </Button>
        </div>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>{t('documents.template.step1')}</li>
          <li>{t('documents.template.step2')}</li>
          <li>{t('documents.template.step3')}</li>
          <li>{t('documents.template.step4')}</li>
        </ol>
      </section>

      {/* ─── History ─── */}
      {templates && templates.length > 0 && (
        <section aria-labelledby="doc-history-h" className="flex flex-col gap-2">
          <h3 id="doc-history-h" className="text-[15px] font-semibold">
            {t('documents.template.historyTitle')}
          </h3>
          <div className="-mx-5 max-md:mx-0">
            <TemplateHistory
              templates={templates}
              canEdit={canEdit}
              busyId={busyId}
              onActivate={(tpl) => void activate(tpl)}
              onPreview={setPreviewing}
              onDownload={(tpl) => void download(tpl)}
              onRename={openRename}
              onDelete={(tpl) => void remove(tpl)}
              onShowReport={(tpl) => {
                setReviewId(tpl.id);
              }}
            />
          </div>
        </section>
      )}

      <TemplatePreviewModal template={previewing} onClose={() => setPreviewing(null)} />

      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title={t('documents.template.renameTitle')}
        size="sm"
        dismissible={!renameSaving}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)} disabled={renameSaving}>
              {t('common.abbrechen')}
            </Button>
            <Button type="submit" form="doc-rename-form" loading={renameSaving}>
              {t('common.speichern')}
            </Button>
          </>
        }
      >
        <form
          id="doc-rename-form"
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void saveRename();
          }}
        >
          {renameError && <Alert tone="err">{renameError}</Alert>}
          <Field label={t('documents.template.nameLabel')} required>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={120} data-autofocus autoComplete="off" />
          </Field>
        </form>
      </Modal>
    </SettingsPanel>
  );
}
