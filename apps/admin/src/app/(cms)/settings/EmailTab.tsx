'use client';

/**
 * Einstellungen > E-Mail (?tab=email, permission area websiteSettings).
 *  - Status of the mail provider (Brevo / SMTP / Listmonk / log), sender and the outbox counts
 *  - "Test-E-Mail senden" (default: the signed-in admin's own address)
 *  - The message log (every mail the system queued): filters, pagination, detail drawer with the
 *    rendered HTML in a sandboxed iframe, and "Erneut senden". Invite / password-reset mails hold
 *    one-time links that are wiped after sending, so they cannot be sent again.
 */
import type { EmailMessageDetailDto, EmailMessageDto, EmailStatus, EmailStatusDto } from '@hoppdrive/shared';
import { ExternalLink, Mail, Paperclip, RefreshCw, Search, Send } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  ChipGroup,
  Drawer,
  EmptyState,
  Field,
  Input,
  MobileCard,
  Select,
  Skeleton,
  SkeletonRows,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  useConfirm,
  useToast,
  type StatusTone,
} from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtDateTime, fmtNumber, fmtRelative } from '@/lib/format';
import { tr } from '@/i18n/active';

const PAGE_SIZE = 20;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

type StatusFilter = 'all' | EmailStatus;

const STATUS_TONE: Record<EmailStatus, StatusTone> = { QUEUED: 'amber', SENT: 'green', FAILED: 'red' };

function MessageStatus({ status }: { status: EmailStatus }) {
  const t = useTranslations();
  return <StatusPill tone={STATUS_TONE[status]} label={t(`emailLog.status.${status}`)} />;
}

/** Where a mail belongs: the object it was sent for (null = no link). */
export function relatedLink(related: EmailMessageDto['related']): { href: string; label: string } | null {
  if (!related?.type) return null;
  const id = related.id;
  switch (related.type) {
    case 'booking':
      return id ? { href: `/contracts?id=${id}`, label: tr('emailLog.related.booking') } : null;
    case 'invoice':
      return id ? { href: `/contracts?tab=rechnungen&invoice=${id}`, label: tr('emailLog.related.invoice') } : null;
    case 'contact_request':
      return id ? { href: `/inquiries?id=${id}`, label: tr('emailLog.related.inquiry') } : null;
    case 'fine':
      return id ? { href: `/fines?id=${id}`, label: tr('emailLog.related.fine') } : null;
    case 'marketing_recipient':
      return { href: '/marketing?tab=history', label: tr('emailLog.related.campaign') };
    default:
      return null;
  }
}

export function EmailTab() {
  const t = useTranslations();
  const { token, admin } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

  // Provider status
  const [status, setStatus] = useState<EmailStatusDto | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Test mail
  const [testTo, setTestTo] = useState('');
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Log
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [template, setTemplate] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EmailMessageDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // The address field starts with the signed-in admin's own address.
  useEffect(() => {
    if (admin?.email) setTestTo((current) => current || admin.email);
  }, [admin?.email]);

  // Debounced search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api.getEmailStatus());
      setStatusError(null);
    } catch (err) {
      setStatusError(errorText(err, tr('emailLog.statusFailed')));
    }
  }, []);

  const loadList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await api.getEmailMessages({
          status: filter === 'all' ? undefined : filter,
          template: template || undefined,
          q: query || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setListError(null);
      } catch (err) {
        if (!silent) setListError(errorText(err, tr('emailLog.listFailed')));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, template, query, page],
  );

  useEffect(() => {
    if (token) void loadStatus();
  }, [token, loadStatus]);

  useEffect(() => {
    if (token) void loadList();
  }, [token, loadList]);

  async function sendTest() {
    const to = testTo.trim();
    if (!EMAIL_RE.test(to)) {
      setTestError(t('common.gebenSieEineGueltige'));
      return;
    }
    setTestError(null);
    setTesting(true);
    try {
      const result = await api.sendTestEmail(to);
      if (result.status === 'SENT') toast.success(t('emailLog.testSent'), to);
      else if (result.status === 'QUEUED') toast.info(t('emailLog.testQueued'), result.error || t('emailLog.testQueuedText'));
      else toast.error(t('emailLog.testFailed'), result.error || to);
      void loadStatus();
      void loadList(true);
    } catch (err) {
      toast.error(t('emailLog.testFailed'), errorText(err));
    } finally {
      setTesting(false);
    }
  }

  const select = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?tab=email&id=${id}` : `${pathname}?tab=email`, { scroll: false });
    },
    [router, pathname],
  );

  async function resend(message: EmailMessageDto): Promise<EmailStatus | null> {
    if (message.status === 'SENT') {
      const ok = await confirm({
        title: t('emailLog.resendConfirmTitle'),
        description: t('emailLog.resendConfirmText', { to: message.to }),
        confirmLabel: t('emailLog.resend'),
        tone: 'primary',
        icon: <Send size={20} />,
      });
      if (!ok) return null;
    }
    try {
      const result = await api.resendEmail(message.id);
      if (result.status === 'SENT') toast.success(t('emailLog.resentOk'), message.to);
      else if (result.status === 'QUEUED') toast.info(t('emailLog.resentQueued'), result.error || t('emailLog.testQueuedText'));
      else toast.error(t('emailLog.resentFailed'), result.error || message.to);
      void loadStatus();
      void loadList(true);
      return result.status;
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error(t('emailLog.resentFailed'), code === 'not_resendable' ? t('emailLog.notResendable') : errorText(err));
      return null;
    }
  }

  const q = status?.queue;
  const statusOptions: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: t('common.alle') },
    { value: 'QUEUED', label: t('emailLog.status.QUEUED'), count: q?.queued },
    { value: 'SENT', label: t('emailLog.status.SENT'), count: q?.sent },
    { value: 'FAILED', label: t('emailLog.status.FAILED'), count: q?.failed },
  ];

  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex max-w-[1200px] flex-col gap-6">
      {/* ─── Provider ─── */}
      <section className="panel" aria-labelledby="mail-provider-h">
        <div className="panel-h">
          <div className="min-w-0">
            <h2 className="h2" id="mail-provider-h">
              {t('emailLog.providerTitle')}
            </h2>
            <p className="sm mut mt-0.5">{t('emailLog.providerSubtitle')}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadStatus()} iconLeft={<RefreshCw size={16} aria-hidden="true" />}>
            {t('emailLog.refresh')}
          </Button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {statusError && (
            <Alert
              tone="err"
              action={
                <Button variant="outline" size="sm" onClick={() => void loadStatus()}>
                  {t('common.erneutVersuchen')}
                </Button>
              }
            >
              {statusError}
            </Alert>
          )}
          {!status && !statusError && <Skeleton className="h-[120px]" rounded={12} />}
          {status && (
            <>
              {!status.deliversExternally && <Alert tone="warn">{t('emailLog.logProviderNote')}</Alert>}
              {status.deliversExternally && !status.configured && <Alert tone="err">{t('emailLog.notConfiguredNote')}</Alert>}
              <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
                  <dt className="mut">{t('emailLog.provider')}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <b className="font-semibold">{t(`emailLog.providers.${status.provider}`)}</b>
                    <StatusPill
                      tone={status.configured ? 'green' : 'red'}
                      label={status.configured ? t('emailLog.configured') : t('emailLog.notConfigured')}
                    />
                  </dd>
                  <dt className="mut">{t('emailLog.sender')}</dt>
                  <dd className="break-all">
                    {status.from.name ? `${status.from.name} ` : ''}
                    <span className="mut">&lt;{status.from.email || '–'}&gt;</span>
                  </dd>
                  <dt className="mut">{t('emailLog.worker')}</dt>
                  <dd>
                    <StatusPill
                      tone={status.workerRunning ? 'green' : 'amber'}
                      label={status.workerRunning ? t('emailLog.workerRunning') : t('emailLog.workerStopped')}
                    />
                    <span className="sm mut ml-2">{t('emailLog.maxAttempts', { count: status.maxAttempts })}</span>
                  </dd>
                  {Object.entries(status.details).map(([key, value]) => (
                    <DetailRow key={key} label={key} value={String(value)} />
                  ))}
                </dl>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  <Count label={t('emailLog.queued')} value={status.queue.queued} tone={status.queue.queued > 0 ? 'warn' : undefined} />
                  <Count label={t('emailLog.failed')} value={status.queue.failed} tone={status.queue.failed > 0 ? 'err' : undefined} />
                  <Count label={t('emailLog.sent24')} value={status.queue.sentLast24h} />
                  <Count label={t('emailLog.failed24')} value={status.queue.failedLast24h} tone={status.queue.failedLast24h > 0 ? 'err' : undefined} />
                  <p className="sm mut col-span-2 sm:col-span-4 lg:col-span-2 xl:col-span-4">
                    {status.queue.lastSentAt
                      ? t('emailLog.lastSent', { relative: fmtRelative(status.queue.lastSentAt) })
                      : t('emailLog.nothingSentYet')}
                    {status.queue.oldestQueuedAt && ` · ${t('emailLog.oldestQueued', { relative: fmtRelative(status.queue.oldestQueuedAt) })}`}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── Test mail ─── */}
      <section className="panel" aria-labelledby="mail-test-h">
        <div className="panel-h">
          <div className="min-w-0">
            <h2 className="h2" id="mail-test-h">
              {t('emailLog.testTitle')}
            </h2>
            <p className="sm mut mt-0.5">{t('emailLog.testSubtitle')}</p>
          </div>
        </div>
        <form
          className="flex flex-wrap items-start gap-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void sendTest();
          }}
          noValidate
        >
          <Field label={t('emailLog.testTo')} error={testError} className="min-w-[260px] flex-1">
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={testTo}
              onChange={(e) => {
                setTestTo(e.target.value);
                setTestError(null);
              }}
              placeholder="name@beispiel.ch"
            />
          </Field>
          <Button type="submit" loading={testing} iconLeft={<Send size={18} aria-hidden="true" />} className="mt-[26px] max-md:mt-0 max-md:w-full">
            {t('emailLog.testSend')}
          </Button>
        </form>
      </section>

      {/* ─── Log ─── */}
      <section className="panel overflow-hidden" aria-labelledby="mail-log-h">
        <div className="panel-h">
          <div className="min-w-0">
            <h2 className="h2" id="mail-log-h">
              {t('emailLog.logTitle')}
            </h2>
            <p className="sm mut mt-0.5">{t('emailLog.logSubtitle')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4">
          <ChipGroup
            aria-label={t('emailLog.filterStatus')}
            options={statusOptions}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
            scrollable
          />
          <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-3 max-md:grid-cols-1">
            <div className="relative">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
              <Input
                type="search"
                aria-label={t('emailLog.search')}
                placeholder={t('emailLog.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              aria-label={t('emailLog.filterTemplate')}
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('emailLog.allTemplates')}</option>
              {(status?.templates ?? []).map((tpl) => (
                <option key={tpl.key} value={tpl.key}>
                  {tpl.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {listError && (
          <div className="p-4">
            <Alert
              tone="err"
              action={
                <Button variant="outline" size="sm" onClick={() => void loadList()}>
                  {t('common.erneutVersuchen')}
                </Button>
              }
            >
              {listError}
            </Alert>
          </div>
        )}

        {loading && !listError ? (
          <>
            <div className="max-md:hidden">
              <Table aria-label={t('emailLog.logTitle')}>
                <TBody>
                  <SkeletonTableRows rows={5} columns={5} />
                </TBody>
              </Table>
            </div>
            <div className="p-4 md:hidden">
              <SkeletonRows rows={4} avatar={false} />
            </div>
          </>
        ) : !listError && items.length === 0 ? (
          <EmptyState
            compact
            tone="neutral"
            icon={<Mail size={32} />}
            title={t('emailLog.emptyTitle')}
            text={filter !== 'all' || template || query ? t('emailLog.emptyFiltered') : t('emailLog.emptyText')}
          />
        ) : !listError ? (
          <>
            <div className="max-md:hidden">
              <Table aria-label={t('emailLog.logTitle')}>
                <THead>
                  <Tr>
                    <Th>{t('emailLog.colDate')}</Th>
                    <Th>{t('emailLog.colRecipient')}</Th>
                    <Th>{t('emailLog.colSubject')}</Th>
                    <Th>{t('common.status')}</Th>
                    <Th>{t('emailLog.colRelated')}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {items.map((m) => {
                    const link = relatedLink(m.related);
                    return (
                      <Tr key={m.id} selected={m.id === selectedId} onClick={() => select(m.id)}>
                        <Td className="whitespace-nowrap">
                          <span className="num">{fmtDateTime(m.createdAt)}</span>
                        </Td>
                        <Td>
                          <div className="cell-2">
                            <b className="break-all font-semibold">{m.to}</b>
                            {m.toName && <span>{m.toName}</span>}
                          </div>
                        </Td>
                        <Td className="max-w-[360px]">
                          <button
                            type="button"
                            className="block max-w-full truncate text-left font-semibold hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              select(m.id);
                            }}
                          >
                            {m.subject}
                          </button>
                          <span className="sm mut flex items-center gap-1.5">
                            {m.templateLabel}
                            {m.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <Paperclip size={12} aria-hidden="true" />
                                <span className="sr-only">{t('emailLog.attachments')}:</span>
                                {m.attachments.length}
                              </span>
                            )}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1">
                            <MessageStatus status={m.status} />
                            {m.attempts > 1 && <span className="sm mut">{t('emailLog.attempts', { count: m.attempts })}</span>}
                          </div>
                        </Td>
                        <Td onClick={(e) => e.stopPropagation()}>
                          {link ? (
                            <Link href={link.href} className="inline-flex items-center gap-1 font-semibold text-ruby-fg underline">
                              {link.label}
                              <ExternalLink size={14} aria-hidden="true" />
                            </Link>
                          ) : (
                            <span className="mut">–</span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 p-4 md:hidden">
              {items.map((m) => {
                const link = relatedLink(m.related);
                return (
                  <MobileCard
                    key={m.id}
                    title={m.subject}
                    subtitle={m.to}
                    status={<MessageStatus status={m.status} />}
                    onOpen={() => select(m.id)}
                    actions={
                      link ? (
                        <Button href={link.href} variant="ghost" size="sm" iconLeft={<ExternalLink size={16} aria-hidden="true" />}>
                          {link.label}
                        </Button>
                      ) : undefined
                    }
                  >
                    <p className="sm mut">
                      {m.templateLabel} · <span className="num">{fmtDateTime(m.createdAt)}</span>
                    </p>
                    {m.error && <p className="sm text-err-strong line-clamp-2">{m.error}</p>}
                  </MobileCard>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
              <span className="sm mut" aria-live="polite">
                {t('emailLog.range', { from: rangeFrom, to: rangeTo, total: fmtNumber(total) })}
              </span>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t('common.zurueck')}
                </Button>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  {t('fleet.weiter')}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {selectedId && <MessageDrawer id={selectedId} onClose={() => select(null)} onResend={resend} />}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'err' }) {
  return (
    <div className="rounded-xl border border-line bg-row px-3.5 py-3">
      <div className="sm mut">{label}</div>
      <b className={cn('num text-2xl font-bold leading-tight', tone === 'warn' && 'text-warn', tone === 'err' && 'text-err')}>{fmtNumber(value)}</b>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="mut first-letter:uppercase">{label}</dt>
      <dd className="break-all">{value}</dd>
    </>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────

function MessageDrawer({
  id,
  onClose,
  onResend,
}: {
  id: string;
  onClose: () => void;
  onResend: (message: EmailMessageDto) => Promise<EmailStatus | null>;
}) {
  const t = useTranslations();
  const [message, setMessage] = useState<EmailMessageDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getEmailMessage(id);
      if (alive.current) {
        setMessage(data);
        setError(null);
      }
    } catch (err) {
      if (alive.current) setError(errorText(err, tr('emailLog.detailFailed')));
    }
  }, [id]);

  useEffect(() => {
    alive.current = true;
    setMessage(null);
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  async function handleResend() {
    if (!message) return;
    setResending(true);
    const result = await onResend(message);
    if (result && alive.current) await load();
    if (alive.current) setResending(false);
  }

  const link = message ? relatedLink(message.related) : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={message?.subject ?? t('emailLog.detailTitle')}
      subtitle={message ? <MessageStatus status={message.status} /> : undefined}
      className="md:!w-[600px]"
      footer={
        message ? (
          <>
            <Button
              className="flex-1"
              loading={resending}
              disabled={!message.resendable}
              onClick={() => void handleResend()}
              iconLeft={<Send size={18} aria-hidden="true" />}
            >
              {message.status === 'SENT' ? t('emailLog.resend') : t('emailLog.retry')}
            </Button>
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
      {!message && !error && <Skeleton className="h-[320px]" rounded={12} />}
      {message && (
        <>
          {!message.resendable && <Alert tone="info">{t('emailLog.notResendable')}</Alert>}
          {message.error && (
            <Alert tone="err" title={t('emailLog.errorTitle')}>
              <span className="break-words">{message.error}</span>
            </Alert>
          )}

          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
            <DetailRow label={t('emailLog.colRecipient')} value={message.toName ? `${message.toName} <${message.to}>` : message.to} />
            <DetailRow label={t('emailLog.colSubject')} value={message.subject} />
            <DetailRow label={t('emailLog.template')} value={message.templateLabel} />
            <DetailRow label={t('emailLog.created')} value={<span className="num">{fmtDateTime(message.createdAt)}</span>} />
            <DetailRow label={t('emailLog.sentAt')} value={message.sentAt ? <span className="num">{fmtDateTime(message.sentAt)}</span> : '–'} />
            <DetailRow label={t('emailLog.attemptsLabel')} value={String(message.attempts)} />
            {message.status === 'QUEUED' && message.nextAttemptAt && (
              <DetailRow label={t('emailLog.nextAttempt')} value={<span className="num">{fmtDateTime(message.nextAttemptAt)}</span>} />
            )}
            <DetailRow label={t('emailLog.provider')} value={message.provider ? t(`emailLog.providers.${message.provider}`) : '–'} />
            {message.providerMessageId && <DetailRow label={t('emailLog.providerId')} value={<span className="num">{message.providerMessageId}</span>} />}
            {link && (
              <DetailRow
                label={t('emailLog.colRelated')}
                value={
                  <Link href={link.href} className="inline-flex items-center gap-1 font-semibold text-ruby-fg underline">
                    {link.label}
                    <ExternalLink size={14} aria-hidden="true" />
                  </Link>
                }
              />
            )}
          </dl>

          <section aria-label={t('emailLog.attachments')} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('emailLog.attachments')}</h3>
            {message.attachments.length === 0 ? (
              <p className="sm mut">{t('emailLog.noAttachments')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {message.attachments.map((a, i) => (
                  <li key={`${a.filename}-${i}`} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
                    <Paperclip size={16} aria-hidden="true" className="flex-none text-graphite" />
                    <span className="min-w-0 break-all">{a.filename}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={t('emailLog.preview')} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('emailLog.preview')}</h3>
            {message.html ? (
              // Sandboxed without any permission: no scripts, no forms, no navigation, unique origin.
              <div data-theme="light" className="overflow-hidden rounded-xl border border-line bg-card">
                <iframe
                  title={t('emailLog.previewTitle', { subject: message.subject })}
                  sandbox=""
                  srcDoc={message.html}
                  referrerPolicy="no-referrer"
                  className="block h-[460px] w-full border-0"
                />
              </div>
            ) : (
              <p className="sm mut rounded-xl bg-paper px-3.5 py-3">{t('emailLog.noHtml')}</p>
            )}
          </section>
        </>
      )}
    </Drawer>
  );
}
