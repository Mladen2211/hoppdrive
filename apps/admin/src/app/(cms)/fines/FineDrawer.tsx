'use client';

/**
 * Detail drawer of a fine (?id=): data, document (preview / download / replace / remove), the assigned
 * booking and the invoices, the status progression and the workflow actions:
 *   zuordnen -> Fahrerdaten exportieren (PDF) -> Mieter benachrichtigen -> Rechnung erstellen -> abschliessen
 * Without the "fines" edit level only the viewing parts are offered.
 */
import {
  CircleCheck,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Mail,
  Pencil,
  Receipt,
  RefreshCw,
  Trash2,
  UserRoundCheck,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FineDto, FineInvoiceResultDto, FineStatus } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Drawer, ProgressSteps, Skeleton, StatusPill, useConfirm, useToast, type StepState } from '@/components/ui';
import { FileDropzone } from '@/components/settings/FileDropzone';
import { FineStatusPill } from '@/components/fines/FineStatusPill';
import { api, type ApiError } from '@/lib/api';
import { openBlobInTab } from '@/lib/doc-pdf';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtDate, fmtMoney } from '@/lib/format';
import { FINE_STATUSES, fineStatusIndex, fmtFineTime } from '@/lib/fine-model';
import { formatPlate } from '@/lib/plate';
import { fmtZurichPeriod } from '@/lib/zurich';
import { tr } from '@/i18n/active';
import { AssignModal, NotifyModal } from './FineDialogs';
import { FineInvoiceModal } from './FineInvoiceModal';

const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

type DocKind = 'pdf' | 'image' | 'other';
const docKind = (name: string | null): DocKind => (!name ? 'other' : /\.pdf$/i.test(name) ? 'pdf' : /\.(jpe?g|png)$/i.test(name) ? 'image' : 'other');
const docMime = (name: string): string => (/\.png$/i.test(name) ? 'image/png' : /\.pdf$/i.test(name) ? 'application/pdf' : 'image/jpeg');

export function FineDrawer({
  id,
  cached,
  refreshKey,
  canEdit,
  onClose,
  onUpdated,
  onDeleted,
  onEdit,
}: {
  id: string;
  cached: FineDto | null;
  /** Bumped by the page when the fine was changed elsewhere (edit dialog): reload. */
  refreshKey: number;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: (fine: FineDto) => void;
  onDeleted: (id: string) => void;
  onEdit: (fine: FineDto) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [fine, setFine] = useState<FineDto | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'assign' | 'notify' | 'invoice' | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getFine(id);
      setFine(data);
      setError(null);
      onUpdated(data);
    } catch (err) {
      setError(errorText(err, tr('fines.loadOneFailed')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The drawer is keyed by id: it starts from the list's copy (if any) and then loads the fresh one.
  const cachedRef = useRef(cached);
  cachedRef.current = cached;
  useEffect(() => {
    setFine((current) => (current?.id === id ? current : cachedRef.current?.id === id ? cachedRef.current : null));
    setError(null);
    void load();
  }, [id, load]);

  useEffect(() => {
    if (refreshKey > 0) void load();
  }, [refreshKey, load]);

  // Inline preview of an uploaded image.
  const hasDoc = fine?.hasDocument ?? false;
  const docName = fine?.documentName ?? null;
  const kind = docKind(docName);
  const docVersion = fine?.updatedAt;
  useEffect(() => {
    if (!hasDoc || kind !== 'image') {
      setDocUrl(null);
      return;
    }
    let alive = true;
    let url: string | null = null;
    api
      .downloadFineDocument(id)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(new Blob([blob], { type: docMime(docName ?? '') }));
        setDocUrl(url);
      })
      .catch(() => {
        if (alive) setDocUrl(null);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, hasDoc, kind, docName, docVersion]);

  function apply(updated: FineDto) {
    setFine(updated);
    onUpdated(updated);
  }

  // ── Actions ───────────────────────────────────────────────────

  async function viewDocument() {
    if (!fine?.documentName) return;
    try {
      await openBlobInTab(() => api.downloadFineDocument(fine.id), fine.documentName!, docMime(fine.documentName!));
    } catch (err) {
      toast.error(tr('fines.doc.openFailed'), errorText(err));
    }
  }

  async function downloadDocument() {
    if (!fine?.documentName) return;
    setBusy('doc');
    try {
      triggerBlobDownload(await api.downloadFineDocument(fine.id), fine.documentName);
    } catch (err) {
      toast.error(tr('fines.doc.openFailed'), errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function uploadDocument(file: File) {
    if (!fine) return;
    setDocUploading(true);
    setDocError(null);
    try {
      apply(await api.uploadFineDocument(fine.id, file));
      toast.success(tr('fines.doc.uploaded'), file.name);
    } catch (err) {
      setDocError((err as Partial<ApiError>).status === 415 ? tr('fines.documentUnsupported') : errorText(err, tr('fines.doc.uploadFailed')));
    } finally {
      setDocUploading(false);
    }
  }

  async function removeDocument() {
    if (!fine) return;
    const done = await confirm({
      title: t('fines.doc.removeTitle'),
      description: t('fines.doc.removeText'),
      confirmLabel: t('fines.doc.remove'),
      onConfirm: async () => {
        try {
          apply(await api.deleteFineDocument(fine.id));
        } catch (err) {
          throw new Error(errorText(err, tr('fines.doc.removeFailed')));
        }
      },
    });
    if (done) toast.success(tr('fines.doc.removed'));
  }

  async function exportDriver() {
    if (!fine) return;
    setBusy('export');
    try {
      const name = (fine.reference || fine.licensePlate).replace(/[^\w.-]+/g, '_');
      triggerBlobDownload(await api.downloadFineDriverExport(fine.id), `HoppDrive-Fahrerangaben-${name}.pdf`);
      toast.success(tr('fines.export.done'), tr('fines.export.doneText'));
    } catch (err) {
      const code = (err as Partial<ApiError>).code;
      toast.error(tr('fines.export.failed'), code === 'fine_not_assigned' ? tr('fines.notAssignedHint') : errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function assign(bookingId: string) {
    if (!fine) return;
    try {
      const updated = await api.assignFine(fine.id, bookingId);
      apply(updated);
      setDialog(null);
      toast.success(tr('fines.assign.done'), updated.booking?.customerName ?? '');
    } catch (err) {
      const code = (err as Partial<ApiError>).code;
      throw new Error(code === 'booking_vehicle_mismatch' ? tr('fines.assign.mismatch') : errorText(err, tr('fines.assignFailed')));
    }
  }

  async function notify(note: string) {
    if (!fine) return;
    try {
      const result = await api.notifyFine(fine.id, note || undefined);
      apply(result.fine);
      setDialog(null);
      const to = result.fine.booking?.customerEmail ?? '';
      if (result.status === 'SENT') toast.success(tr('fines.notify.sent'), to);
      else if (result.status === 'QUEUED') toast.info(tr('fines.notify.queued'), result.error || tr('fines.notify.queuedText'));
      else toast.error(tr('fines.notify.failed'), result.error || to);
    } catch (err) {
      const code = (err as Partial<ApiError>).code;
      throw new Error(code === 'no_recipient' ? tr('fines.notify.noEmailHint') : code === 'fine_not_assigned' ? tr('fines.notAssignedHint') : errorText(err, tr('fines.notify.failed')));
    }
  }

  function invoiceCreated(result: FineInvoiceResultDto, options: { sendEmail: boolean }) {
    apply(result.fine);
    setDialog(null);
    const invoice = result.invoice;
    toast({
      tone: 'success',
      title: tr('fines.invoice.created'),
      description: tr('fines.invoice.createdText', { invoiceNumber: invoice.invoiceNumber }),
      action: { label: tr('fines.invoice.view'), onClick: () => router.push(`/contracts?tab=rechnungen&invoice=${invoice.id}`) },
    });
    if (options.sendEmail) {
      if (invoice.emailSent) toast.success(tr('invoiceEditor.mailSent'), tr('invoiceEditor.mailSentText', { invoiceNumber: invoice.invoiceNumber, email: invoice.customerEmail ?? '' }));
      else if (invoice.emailError === 'no_recipient') toast.error(tr('invoiceEditor.mailNoRecipient'), tr('invoiceEditor.mailNoRecipientText', { invoiceNumber: invoice.invoiceNumber }));
      else if (invoice.emailError === 'send_failed') toast.error(tr('invoiceEditor.mailFailed'), tr('invoiceEditor.mailFailedText', { invoiceNumber: invoice.invoiceNumber }));
    }
  }

  async function setStatus(status: FineStatus) {
    if (!fine) return;
    setBusy('status');
    try {
      apply(await api.updateFine(fine.id, { status }));
      toast.success(status === 'CLOSED' ? tr('fines.closed') : tr('fines.reopened'), fine.reference || formatPlate(fine.licensePlate));
    } catch (err) {
      toast.error(tr('fines.statusFailed'), errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!fine) return;
    const done = await confirm({
      title: t('fines.deleteTitle'),
      description: t('fines.deleteText', { name: fine.reference || formatPlate(fine.licensePlate) }),
      confirmLabel: t('fines.delete'),
      icon: <Trash2 size={20} />,
      onConfirm: async () => {
        try {
          await api.deleteFine(fine.id);
        } catch (err) {
          const code = (err as Partial<ApiError>).code;
          throw new Error(code === 'fine_has_invoice' ? tr('fines.deleteHasInvoice') : errorText(err, tr('fines.deleteFailed')));
        }
      },
    });
    if (!done) return;
    toast.success(tr('fines.deleted'));
    onDeleted(fine.id);
  }

  // ── Render ────────────────────────────────────────────────────

  const current = fine ? fineStatusIndex(fine.status) : 0;
  const steps = FINE_STATUSES.map((status, index) => ({
    label: t(`fines.status.${status}`),
    state: (fine?.status === 'CLOSED' || index < current ? 'done' : index === current ? 'now' : 'todo') as StepState,
  }));
  const booking = fine?.booking ?? null;
  const assigned = Boolean(fine?.bookingId);
  const invoiced = (fine?.invoices.length ?? 0) > 0;
  const closed = fine?.status === 'CLOSED';
  const noEmail = assigned && !booking?.customerEmail?.trim();

  const dd = (value: string | null | undefined) => (value && value.trim() ? value : <span className="mut">–</span>);

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={fine ? fine.reference || formatPlate(fine.licensePlate) : t('fines.drawerTitle')}
        subtitle={fine ? <FineStatusPill status={fine.status} /> : undefined}
        footer={
          fine && canEdit ? (
            <>
              <Button variant="outline" className="flex-1" iconLeft={<Pencil size={18} aria-hidden="true" />} onClick={() => onEdit(fine)}>
                {t('fines.edit')}
              </Button>
              {closed ? (
                <Button variant="ghost" loading={busy === 'status'} iconLeft={<Undo2 size={18} aria-hidden="true" />} onClick={() => void setStatus(invoiced ? 'INVOICED' : assigned ? 'ASSIGNED' : 'NEW')}>
                  {t('fines.reopen')}
                </Button>
              ) : (
                <Button variant="ghost" loading={busy === 'status'} iconLeft={<CircleCheck size={18} aria-hidden="true" />} onClick={() => void setStatus('CLOSED')}>
                  {t('fines.close')}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {error && (
          <Alert
            tone="err"
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {t('common.erneutVersuchen')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!fine && !error && <Skeleton className="h-[320px] w-full" rounded={12} />}
        {fine && (
          <>
            <ProgressSteps steps={steps} aria-label={t('fines.progress')} />

            {/* ─── Next steps ─── */}
            {canEdit && (
              <section aria-labelledby="fine-actions-h" className="flex flex-col gap-2.5">
                <h3 id="fine-actions-h" className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
                  {t('fines.actions')}
                </h3>
                {!assigned && <Alert tone="warn">{t('fines.notAssignedHint')}</Alert>}
                <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                  <Button
                    variant={assigned ? 'outline' : 'primary'}
                    size="sm"
                    iconLeft={<UserRoundCheck size={16} aria-hidden="true" />}
                    onClick={() => setDialog('assign')}
                  >
                    {assigned ? t('fines.reassign') : t('fines.assignBtn')}
                  </Button>
                  <Button variant="outline" size="sm" disabled={!assigned} loading={busy === 'export'} iconLeft={<FileDown size={16} aria-hidden="true" />} onClick={() => void exportDriver()}>
                    {t('fines.export.button')}
                  </Button>
                  <Button variant="outline" size="sm" disabled={!assigned || noEmail} iconLeft={<Mail size={16} aria-hidden="true" />} onClick={() => setDialog('notify')}>
                    {t('fines.notify.button')}
                  </Button>
                  {invoiced ? (
                    <Button href={`/contracts?tab=rechnungen&invoice=${fine.invoices[0].id}`} variant="outline" size="sm" iconLeft={<Receipt size={16} aria-hidden="true" />}>
                      {t('fines.invoice.view')}
                    </Button>
                  ) : (
                    <Button variant={assigned && fine.status !== 'NEW' ? 'primary' : 'outline'} size="sm" disabled={!assigned} iconLeft={<Receipt size={16} aria-hidden="true" />} onClick={() => setDialog('invoice')}>
                      {t('fines.invoice.button')}
                    </Button>
                  )}
                </div>
                {noEmail && <p className="sm mut">{t('fines.notify.noEmailHint')}</p>}
              </section>
            )}

            {/* ─── Data ─── */}
            <section aria-labelledby="fine-data-h" className="flex flex-col gap-2">
              <h3 id="fine-data-h" className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
                {t('fines.data')}
              </h3>
              <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm max-sm:grid-cols-[100px_minmax(0,1fr)]">
                <dt className="mut">{t('fines.plate')}</dt>
                <dd className="num font-semibold">{formatPlate(fine.licensePlate)}</dd>
                <dt className="mut">{t('fines.vehicle')}</dt>
                <dd>{fine.vehicle ? `${fine.vehicle.brand} ${fine.vehicle.model}` : <span className="mut">{t('fines.vehicleUnknown')}</span>}</dd>
                <dt className="mut">{t('fines.when')}</dt>
                <dd className="num">{fmtFineTime(fine.occurredAt)}</dd>
                <dt className="mut">{t('fines.place')}</dt>
                <dd className="break-words">{dd(fine.place)}</dd>
                <dt className="mut">{t('fines.authority')}</dt>
                <dd className="break-words">{dd(fine.authority)}</dd>
                <dt className="mut">{t('fines.reference')}</dt>
                <dd className="num break-all">{dd(fine.reference)}</dd>
                <dt className="mut">{t('fines.amount')}</dt>
                <dd className="num text-base font-bold">{fmtMoney(fine.amount, { currency: fine.currency })}</dd>
                <dt className="mut">{t('fines.description')}</dt>
                <dd className="whitespace-pre-wrap break-words">{dd(fine.description)}</dd>
                <dt className="mut">{t('fines.notes')}</dt>
                <dd className="whitespace-pre-wrap break-words">{dd(fine.notes)}</dd>
                <dt className="mut">{t('fines.recorded')}</dt>
                <dd className="num">{fmtDate(fine.createdAt)}</dd>
              </dl>
            </section>

            {/* ─── Document ─── */}
            <section aria-labelledby="fine-doc-h" className="flex flex-col gap-2">
              <h3 id="fine-doc-h" className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
                {t('fines.document')}
              </h3>
              {fine.hasDocument ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                    <FileText size={20} aria-hidden="true" className="flex-none text-graphite" />
                    <span className="min-w-0 flex-1 break-all text-sm font-semibold">{fine.documentName}</span>
                  </div>
                  {kind === 'image' && docUrl && (
                    <div data-theme="light" className="overflow-hidden rounded-xl border border-line bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not optimisable by next/image */}
                      <img src={docUrl} alt={t('fines.doc.imageAlt', { name: fine.documentName ?? '' })} className="block max-h-[320px] w-full object-contain" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" iconLeft={<ExternalLink size={16} aria-hidden="true" />} onClick={() => void viewDocument()}>
                      {t('fines.doc.view')}
                    </Button>
                    <Button variant="outline" size="sm" loading={busy === 'doc'} iconLeft={<Download size={16} aria-hidden="true" />} onClick={() => void downloadDocument()}>
                      {t('fines.doc.download')}
                    </Button>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="sm" loading={docUploading} iconLeft={<RefreshCw size={16} aria-hidden="true" />} onClick={() => replaceRef.current?.click()}>
                          {t('fines.doc.replace')}
                        </Button>
                        <Button variant="ghost" size="sm" iconLeft={<Trash2 size={16} aria-hidden="true" />} onClick={() => void removeDocument()}>
                          {t('fines.doc.remove')}
                        </Button>
                        <input
                          ref={replaceRef}
                          type="file"
                          accept={DOCUMENT_ACCEPT}
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden="true"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) {
                              if (file.size > 10 * 1024 * 1024) setDocError(t('documents.dropzone.tooLarge', { max: 10 }));
                              else void uploadDocument(file);
                            }
                          }}
                        />
                      </>
                    )}
                  </div>
                  {docError && (
                    <p className="errm" role="alert">
                      {docError}
                    </p>
                  )}
                </>
              ) : canEdit ? (
                <FileDropzone
                  compact
                  accept={DOCUMENT_ACCEPT}
                  maxMb={10}
                  title={t('fines.dropTitle')}
                  hint={t('fines.dropHint')}
                  wrongTypeText={t('fines.documentUnsupported')}
                  buttonLabel={t('fines.doc.add')}
                  loading={docUploading}
                  error={docError}
                  onFile={(file) => void uploadDocument(file)}
                />
              ) : (
                <p className="sm mut">{t('fines.doc.none')}</p>
              )}
            </section>

            {/* ─── Booking ─── */}
            <section aria-labelledby="fine-booking-h" className="flex flex-col gap-2">
              <h3 id="fine-booking-h" className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
                {t('fines.booking')}
              </h3>
              {booking ? (
                <div className="flex flex-col gap-1 rounded-xl border border-line p-3.5 text-sm">
                  <b className="font-semibold">{booking.customerName}</b>
                  <span className="break-all mut">{booking.customerEmail || t('fines.noEmail')}</span>
                  <span className="num">{fmtZurichPeriod({ startDate: booking.startDate, endDate: booking.endDate, hasTimes: true })}</span>
                  <Link href={`/contracts?id=${booking.id}`} className="inline-flex items-center gap-1 self-start font-semibold text-ruby-fg underline">
                    {t('fines.openBooking')}
                    <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <p className="sm mut">{t('fines.notAssigned')}</p>
              )}
            </section>

            {/* ─── Invoices ─── */}
            {fine.invoices.length > 0 && (
              <section aria-labelledby="fine-inv-h" className="flex flex-col gap-2">
                <h3 id="fine-inv-h" className="text-[13px] font-semibold uppercase tracking-wide text-graphite">
                  {t('fines.invoices')}
                </h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {fine.invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <Link href={`/contracts?tab=rechnungen&invoice=${inv.id}`} className="num font-semibold text-ruby-fg underline">
                        {inv.invoiceNumber}
                      </Link>
                      <span className="flex items-center gap-2">
                        <b className="num">{fmtMoney(inv.total, { currency: inv.currency })}</b>
                        <StatusPill kind="invoice" status={inv.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {canEdit && (
              <div className="pt-1">
                <Button variant="ghost" size="sm" iconLeft={<Trash2 size={16} aria-hidden="true" />} onClick={() => void remove()} className="text-err">
                  {t('fines.delete')}
                </Button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {fine && dialog === 'assign' && <AssignModal fine={fine} onClose={() => setDialog(null)} onAssign={assign} />}
      {fine && dialog === 'notify' && <NotifyModal fine={fine} onClose={() => setDialog(null)} onSend={notify} />}
      {fine && dialog === 'invoice' && <FineInvoiceModal fine={fine} onClose={() => setDialog(null)} onCreated={invoiceCreated} />}
    </>
  );
}
