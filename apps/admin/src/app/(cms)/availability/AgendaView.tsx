'use client';

/**
 * Mobile agenda (docs/design Mobile-Screens, panel 5): the month as day groups with one card per
 * pickup, return, Wartung or open inquiry. Left border: blau = Abholung, grün = Rückgabe,
 * grau = Wartung, amber = Anfrage.
 */
import { CalendarDays } from 'lucide-react';
import { Button, EmptyState, cn } from '@/components/ui';
import { MAINTENANCE_REASON_LABELS, type AgendaGroup, type CalEvent } from '@/lib/calendar-model';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';
import { monthName } from '@/lib/format';

const BORDER: Record<CalEvent['type'], string> = {
  pickup: 'border-l-info',
  return: 'border-l-ok',
  maintenance: 'border-l-field',
  inquiryStart: 'border-l-edge-warn',
  inquiryEnd: 'border-l-edge-warn',
};

function eventLabel(e: CalEvent): string {
  switch (e.type) {
    case 'pickup':
      return tr('availability.abholung');
    case 'return':
      return tr('availability.rueckgabe');
    case 'maintenance':
      return tr('common.wartung');
    case 'inquiryStart':
      return tr('availability.offeneAnfrage');
    default:
      return tr('availability.rueckgabeLautAnfrage');
  }
}

function eventLines(e: CalEvent): { who: string; sub: string } {
  const { item } = e;
  if (item.kind === 'maintenance') {
    const reason = MAINTENANCE_REASON_LABELS[item.maintenance.reason] ?? item.maintenance.reason;
    return { who: item.vehicleName, sub: item.maintenance.notes?.trim() || reason };
  }
  return { who: item.title, sub: item.vehicleName };
}

export interface AgendaViewProps {
  groups: AgendaGroup[];
  month: number;
  year: number;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (dayKey: string, itemKey: string) => void;
}

export function AgendaView({ groups, month, year, canCreate, onCreate, onOpen }: AgendaViewProps) {
  const t = useTranslations();
  if (groups.length === 0) {
    return (
      <EmptyState
        compact
        tone="neutral"
        icon={<CalendarDays size={32} />}
        title={t('availability.keineTermineIm', { item: monthName(month), year })}
        text={t('availability.abholungenRueckgabenWartungUnd')}
        actions={canCreate ? <Button onClick={onCreate}>{t('common.neueBuchung')}</Button> : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((group) => (
        <section key={group.dayKey} aria-label={group.heading} className="flex flex-col gap-2">
          <h3 className="lbl pt-1.5">{group.heading}</h3>
          {group.events.map((event) => {
            const { who, sub } = eventLines(event);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onOpen(group.dayKey, event.item.key)}
                className={cn(
                  'm-card min-h-[48px] gap-0.5 border-l-4 px-3.5 py-2.5 text-left',
                  BORDER[event.type],
                  event.item.kind === 'booking' && event.item.tone === 'mute' && 'opacity-80',
                )}
              >
                <span className="sm font-semibold text-graphite">{eventLabel(event)}</span>
                <b className="font-semibold">{who}</b>
                <span className="sm mut">{sub}</span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
