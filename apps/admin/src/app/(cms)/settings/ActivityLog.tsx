'use client';

/**
 * "Aktivitätsprotokoll": who changed what, newest first. Filter chips (Alle / Buchungen / Inhalte /
 * Benutzer), one German sentence per entry (lib/audit describeAudit), relative time, "Mehr laden"
 * pagination and the CSV export. Used as its own tab and as the right-hand panel of the users tab.
 */
import {
  CalendarDays,
  CarFront,
  CircleHelp,
  ClipboardCheck,
  Coins,
  FileText,
  Gavel,
  History,
  Home,
  KeyRound,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Percent,
  Scale,
  Settings,
  Star,
  Tag,
  TriangleAlert,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditLogEntryDto } from '@hoppdrive/shared';
import { Alert, Button, ChipGroup, EmptyState, SkeletonRows, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { describeAudit } from '@/lib/audit';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { fmtRelative, toInputDate } from '@/lib/format';
import { AUDIT_FILTERS, auditFilterParams, type AuditFilterId } from '@/lib/settings-users';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

const PAGE_SIZE = 20;

const RESOURCE_ICON: Record<string, LucideIcon> = {
  booking: CalendarDays,
  'contact-request': MessageSquare,
  invoice: FileText,
  vehicle: CarFront,
  maintenance: Wrench,
  'pricing-rule': Percent,
  location: MapPin,
  faq: CircleHelp,
  testimonial: Star,
  'homepage-section': Home,
  setting: Settings,
  admin: UserRound,
  auth: KeyRound,
  email: Mail,
  'discount-code': Tag,
  'marketing-campaign': Megaphone,
  'vehicle-damage': TriangleAlert,
  inspection: ClipboardCheck,
  fee: Coins,
  'contract-template': FileText,
  'legal-document': Scale,
  fine: Gavel,
};

export function ActivityLog({ className }: { className?: string }) {
  const t = useTranslations();
  const { toast } = useToast();
  const [filter, setFilter] = useState<AuditFilterId>('all');
  const [entries, setEntries] = useState<AuditLogEntryDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const fetchPage = useCallback(async (nextFilter: AuditFilterId, nextPage: number, append: boolean) => {
    const id = ++requestId.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs({ ...auditFilterParams(nextFilter), page: nextPage, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return; // a newer filter / page won the race
      setEntries((current) => (append ? [...current, ...data.items] : data.items));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorText(err, tr('settings.dasProtokollKonnteNicht')));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchPage(filter, 1, false);
  }, [filter, fetchPage]);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.downloadAuditLogsCsv(auditFilterParams(filter));
      triggerBlobDownload(blob, `hoppdrive-aktivitaet-${toInputDate(new Date())}.csv`);
      toast.success(tr('common.cSVExportiert'));
    } catch (err) {
      toast.error(tr('common.exportFehlgeschlagen'), errorText(err));
    } finally {
      setExporting(false);
    }
  }

  const rows = entries
    .map((entry) => ({ entry, sentence: describeAudit(entry) }))
    .filter((row): row is { entry: AuditLogEntryDto; sentence: NonNullable<ReturnType<typeof describeAudit>> } => row.sentence !== null);

  return (
    <section className={`panel ${className ?? ''}`} aria-labelledby="activity-h">
      <div className="panel-h">
        <h2 className="h2" id="activity-h">
          {t('settings.aktivitaetsprotokoll')}
        </h2>
        <Button variant="ghost" size="sm" loading={exporting} onClick={() => void handleExport()} aria-label={t('settings.aktivitaetsprotokollAlsCSVExpo')}>
          CSV
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <ChipGroup
          aria-label={t('settings.aktivitaetFiltern')}
          scrollable
          options={AUDIT_FILTERS.map((f) => ({ value: f.id, label: f.label }))}
          value={filter}
          onChange={(value) => setFilter(value as AuditFilterId)}
        />

        {error && (
          <Alert
            tone="err"
            title={t('settings.protokollKonnteNichtGeladen')}
            action={
              <Button variant="outline" size="sm" onClick={() => void fetchPage(filter, 1, false)}>
                {t('common.erneutVersuchen')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <SkeletonRows rows={5} label={t('settings.aktivitaetWirdGeladen')} />
        ) : rows.length === 0 && !error ? (
          <EmptyState
            compact
            tone="neutral"
            icon={<History size={32} />}
            title={t('settings.nochKeineAktivitaet')}
            text={filter === 'all' ? t('settings.aenderungenImVerwaltungsbereic') : t('settings.inDieserKategorieGibt')}
          />
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {rows.map(({ entry, sentence }) => {
              const Icon = RESOURCE_ICON[entry.resource] ?? History;
              return (
                <li key={entry.id} className="flex gap-3 border-b border-line-soft py-3 first:pt-0 last:border-b-0">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-paper text-graphite"
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="leading-snug">
                      <b className="font-semibold">{sentence.actor}</b> {sentence.text}
                    </p>
                    <time className="sm mut" dateTime={entry.createdAt}>
                      {fmtRelative(entry.createdAt, { capitalize: true })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!loading && page < totalPages && (
          <Button variant="ghost" fullWidth loading={loadingMore} onClick={() => void fetchPage(filter, page + 1, true)}>
            {t('settings.mehrLaden')}
          </Button>
        )}
      </div>
    </section>
  );
}
