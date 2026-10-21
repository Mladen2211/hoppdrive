'use client';

/**
 * Marketing > Verlauf: sent campaigns (date, subject, recipients, sent / failed counts) and a detail drawer
 * with the per-recipient status and errors. While mails are still queued the open campaign refreshes itself.
 */
import { Megaphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { CampaignDto, RecipientStatus } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  ChipGroup,
  Drawer,
  EmptyState,
  MobileCard,
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
  type StatusTone,
} from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import { tr } from '@/i18n/active';

const PAGE_SIZE = 20;
const RECIPIENT_TONE: Record<RecipientStatus, StatusTone> = { QUEUED: 'amber', SENT: 'green', FAILED: 'red' };

function campaignState(c: CampaignDto): 'queued' | 'failed' | 'done' {
  if (c.counts.queued > 0) return 'queued';
  if (c.counts.failed > 0) return 'failed';
  return 'done';
}

function CampaignStatus({ campaign }: { campaign: CampaignDto }) {
  const t = useTranslations();
  const state = campaignState(campaign);
  return <StatusPill tone={state === 'queued' ? 'amber' : state === 'failed' ? 'red' : 'green'} label={t(`marketing.history.state.${state}`)} />;
}

function Counts({ campaign }: { campaign: CampaignDto }) {
  const t = useTranslations();
  const { sent, failed, queued, total } = campaign.counts;
  return (
    <span className="num">
      {t('marketing.history.countsLine', { sent: fmtNumber(sent), total: fmtNumber(total) })}
      {failed > 0 && <span className="text-err"> · {t('marketing.history.failedCount', { count: failed })}</span>}
      {queued > 0 && <span className="text-warn"> · {t('marketing.history.queuedCount', { count: queued })}</span>}
    </span>
  );
}

export function HistoryTab({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CampaignDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await api.getCampaigns({ page, pageSize: PAGE_SIZE });
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setError(null);
      } catch (err) {
        if (!silent) setError(errorText(err, tr('marketing.history.loadFailed')));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  return (
    <section className="panel overflow-hidden" aria-labelledby="history-h">
      <div className="panel-h">
        <div className="min-w-0">
          <h2 className="h2" id="history-h">
            {t('marketing.history.title')}
          </h2>
          <p className="sm mut mt-0.5">{t('marketing.history.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="p-4">
          <Alert tone="err" action={<Button variant="outline" size="sm" onClick={() => void load()}>{t('common.erneutVersuchen')}</Button>}>
            {error}
          </Alert>
        </div>
      )}

      {loading && !error ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('marketing.history.title')}>
              <TBody>
                <SkeletonTableRows rows={4} columns={5} />
              </TBody>
            </Table>
          </div>
          <div className="p-4 md:hidden">
            <SkeletonRows rows={3} avatar={false} />
          </div>
        </>
      ) : !error && items.length === 0 ? (
        <EmptyState icon={<Megaphone size={32} />} title={t('marketing.history.emptyTitle')} text={t('marketing.history.emptyText')} />
      ) : !error ? (
        <>
          <div className="max-md:hidden">
            <Table aria-label={t('marketing.history.title')}>
              <THead>
                <Tr>
                  <Th>{t('marketing.history.colDate')}</Th>
                  <Th>{t('marketing.history.colSubject')}</Th>
                  <Th align="right">{t('marketing.history.colRecipients')}</Th>
                  <Th>{t('marketing.history.colSent')}</Th>
                  <Th>{t('common.status')}</Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((c) => (
                  <Tr key={c.id} selected={c.id === openId} onClick={() => onOpen(c.id)}>
                    <Td className="num whitespace-nowrap">{fmtDateTime(c.createdAt)}</Td>
                    <Td className="max-w-[360px]">
                      <button type="button" className="block max-w-full truncate text-left font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}>
                        {c.subject}
                      </button>
                      <span className="sm mut block">
                        {c.code?.code ? `${t('marketing.history.code')} ${c.code.code}` : t(`marketing.campaign.mode.${c.codeMode}`)}
                        {c.createdBy ? ` · ${c.createdBy.name}` : ''}
                      </span>
                    </Td>
                    <Td align="right" className="num">{fmtNumber(c.counts.total)}</Td>
                    <Td><Counts campaign={c} /></Td>
                    <Td><CampaignStatus campaign={c} /></Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 p-4 md:hidden">
            {items.map((c) => (
              <MobileCard key={c.id} title={c.subject} subtitle={fmtDateTime(c.createdAt)} status={<CampaignStatus campaign={c} />} onOpen={() => onOpen(c.id)}>
                <p className="sm">
                  {t('marketing.history.recipientsLine', { count: c.counts.total })} · <Counts campaign={c} />
                </p>
              </MobileCard>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
            <span className="sm mut" aria-live="polite">{t('marketing.history.count', { count: total })}</span>
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

      {openId && <CampaignDrawer id={openId} onClose={() => { onOpen(null); void load(true); }} />}
    </section>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────

type RecipientFilter = 'all' | RecipientStatus;

function CampaignDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations();
  const [campaign, setCampaign] = useState<CampaignDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RecipientFilter>('all');

  const load = useCallback(
    async (silent = false) => {
      try {
        setCampaign(await api.getCampaign(id));
        setError(null);
      } catch (err) {
        if (!silent) setError(errorText(err, tr('marketing.history.detailFailed')));
      }
    },
    [id],
  );

  useEffect(() => {
    setCampaign(null);
    setFilter('all');
    void load();
  }, [load]);

  // Mails still in the outbox: look again every few seconds.
  const queued = campaign?.counts.queued ?? 0;
  useEffect(() => {
    if (queued <= 0) return;
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [queued, load]);

  const recipients = (campaign?.recipients ?? []).filter((r) => filter === 'all' || r.status === filter);
  const counts = campaign?.counts;

  return (
    <Drawer
      open
      onClose={onClose}
      title={campaign?.subject ?? t('marketing.history.detailTitle')}
      subtitle={campaign ? <CampaignStatus campaign={campaign} /> : undefined}
      className="md:!w-[560px]"
    >
      {error && (
        <Alert tone="err" action={<Button variant="outline" size="sm" onClick={() => void load()}>{t('common.erneutVersuchen')}</Button>}>
          {error}
        </Alert>
      )}
      {!campaign && !error && <Skeleton className="h-[320px]" rounded={12} />}
      {campaign && counts && (
        <>
          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
            <dt className="mut">{t('marketing.history.colDate')}</dt>
            <dd className="num">{fmtDateTime(campaign.createdAt)}</dd>
            {campaign.createdBy && (
              <>
                <dt className="mut">{t('marketing.history.createdBy')}</dt>
                <dd>{campaign.createdBy.name}</dd>
              </>
            )}
            <dt className="mut">{t('marketing.campaign.codeTitle')}</dt>
            <dd>
              {campaign.code?.code ? <span className="num font-semibold">{campaign.code.code}</span> : t(`marketing.campaign.mode.${campaign.codeMode}`)}
              {campaign.codeMode === 'PERSONAL' && <span className="sm mut"> · {t('marketing.history.personalCodes')}</span>}
            </dd>
            <dt className="mut">{t('marketing.history.redemptions')}</dt>
            <dd className="num">{fmtNumber(campaign.redemptions)}</dd>
          </dl>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-row px-3.5 py-3">
              <div className="sm mut">{t('marketing.history.sent')}</div>
              <b className="num text-2xl">{fmtNumber(counts.sent)}</b>
            </div>
            <div className="rounded-xl border border-line bg-row px-3.5 py-3">
              <div className="sm mut">{t('marketing.history.failed')}</div>
              <b className={`num text-2xl ${counts.failed > 0 ? 'text-err' : ''}`}>{fmtNumber(counts.failed)}</b>
            </div>
            <div className="rounded-xl border border-line bg-row px-3.5 py-3">
              <div className="sm mut">{t('marketing.history.queued')}</div>
              <b className={`num text-2xl ${counts.queued > 0 ? 'text-warn' : ''}`}>{fmtNumber(counts.queued)}</b>
            </div>
          </div>

          <section aria-label={t('marketing.history.message')} className="flex flex-col gap-1.5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('marketing.history.message')}</h3>
            <p className="whitespace-pre-wrap rounded-xl bg-paper px-3.5 py-3 text-sm" lang="de">{campaign.message}</p>
          </section>

          <section aria-label={t('marketing.history.recipients')} className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-graphite">{t('marketing.history.recipients')}</h3>
            <ChipGroup
              aria-label={t('marketing.history.filterRecipients')}
              value={filter}
              onChange={setFilter}
              scrollable
              options={[
                { value: 'all', label: t('common.alle'), count: counts.total },
                { value: 'SENT', label: t('marketing.history.recipientStatus.SENT'), count: counts.sent },
                { value: 'FAILED', label: t('marketing.history.recipientStatus.FAILED'), count: counts.failed },
                { value: 'QUEUED', label: t('marketing.history.recipientStatus.QUEUED'), count: counts.queued },
              ]}
            />
            {recipients.length === 0 ? (
              <p className="mut">{t('marketing.history.noRecipients')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recipients.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 rounded-xl border border-line px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b className="block font-semibold">{r.name || r.email}</b>
                        {r.name && <span className="sm mut block break-all">{r.email}</span>}
                      </div>
                      <StatusPill tone={RECIPIENT_TONE[r.status]} label={t(`marketing.history.recipientStatus.${r.status}`)} />
                    </div>
                    <div className="sm mut flex flex-wrap gap-x-3">
                      {r.code && <span className="num">{r.code}</span>}
                      {r.sentAt && <span className="num">{fmtDateTime(r.sentAt)}</span>}
                    </div>
                    {r.error && <p className="sm break-words text-err-strong">{r.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Drawer>
  );
}
