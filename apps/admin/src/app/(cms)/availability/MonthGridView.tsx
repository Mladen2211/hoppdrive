'use client';

/**
 * "Abholungen und Rückgaben": Mon-first month grid. Every day shows chips for pickups, returns,
 * Wartung and open inquiries; more than `maxChips` become "+N weitere". Days outside the month are
 * muted. A day is one button that opens the day details.
 */
import { Panel, cn } from '@/components/ui';
import {
  eventsByDay,
  longDateLabel,
  monthGrid,
  type CalItem,
} from '@/lib/calendar-model';
import { useMemo } from 'react';
import { CHIP_TONE } from './tone';
import { useTranslations } from 'next-intl';
import { monthName, weekdayShort } from '@/lib/format';

export interface MonthGridViewProps {
  year: number;
  month: number;
  items: CalItem[];
  todayKey: string;
  /** Chips shown per day before "+N weitere" (2 in the combined view, 4 in the month view). */
  maxChips?: number;
  roomy?: boolean;
  onOpen: (dayKey: string) => void;
}

export function MonthGridView({ year, month, items, todayKey, maxChips = 2, roomy = false, onOpen }: MonthGridViewProps) {
  const t = useTranslations();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const events = useMemo(() => eventsByDay(items, cells.map((c) => c.key)), [items, cells]);

  return (
    <Panel aria-labelledby="month-heading" className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2" id="month-heading">
          {t('availability.abholungenUndRueckgaben')}
        </h2>
        <span className="sm mut">
          {monthName(month)} {year}
        </span>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-row" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => weekdayShort(i)).map((d) => (
          <div key={d} className="sm px-3 py-2.5 font-semibold text-graphite">
            {d}
          </div>
        ))}
      </div>

      <div role="group" aria-label={t('availability.abholungenUndRueckgaben2', { item: monthName(month), year })} className="grid grid-cols-7">
        {cells.map((cell) => {
          const list = events.get(cell.key) ?? [];
          const shown = list.slice(0, maxChips);
          const more = list.length - shown.length;
          const isToday = cell.key === todayKey;
          const summary = list.length ? list.map((e) => e.label).join(', ') : t('availability.keineTermine2');
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onOpen(cell.key)}
              aria-label={`${isToday ? t('availability.dayToday', { date: longDateLabel(cell.key) }) : longDateLabel(cell.key)}: ${summary}`}
              className={cn(
                'flex min-w-0 flex-col items-stretch gap-1 border-b border-r border-line-soft p-2 text-left hover:bg-row focus-visible:outline-offset-[-3px]',
                roomy ? 'min-h-[132px]' : 'min-h-[104px]',
                !cell.inMonth && 'bg-row text-field',
                '[&:nth-child(7n)]:border-r-0',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'num flex h-6 min-w-6 items-center justify-center self-start rounded-full px-1 text-sm font-semibold',
                  isToday && 'bg-ruby text-white',
                  !cell.inMonth && !isToday && 'font-medium',
                )}
              >
                {cell.label}
              </span>
              {shown.map((event) => (
                <span
                  key={event.id}
                  aria-hidden="true"
                  className={cn(
                    'block truncate rounded-md px-1.5 py-0.5 text-xs font-semibold',
                    CHIP_TONE[event.tone],
                    !cell.inMonth && 'opacity-70',
                  )}
                  title={event.label}
                >
                  {event.label}
                </span>
              ))}
              {more > 0 && (
                <span aria-hidden="true" className="sm mut">{t('availability.weitere', { more })}</span>
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
