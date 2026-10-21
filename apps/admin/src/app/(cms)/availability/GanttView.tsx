'use client';

/**
 * "Belegung pro Fahrzeug": one row per vehicle, one column per day of the visible month.
 * Bars: booking aktiv (green) / reserviert (blue) / erledigt (grey), offene Anfrage (dashed amber),
 * Wartung (hatched grey). Bars are clipped to the month; when a booking runs on, its label says
 * "(bis 10.02.)". Overlapping items get their own lane. On narrow screens the grid scrolls
 * horizontally and the vehicle column stays in place (sticky).
 */
import { CarFront } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { EmptyState, Panel, cn } from '@/components/ui';
import {
  barLabel,
  ganttBars,
  itemDescription,
  longDateLabel,
  monthDays,
  vehicleLabel,
  vehicleMeta,
  type CalItem,
  type CalVehicle,
} from '@/lib/calendar-model';
import { BAR_TONE } from './tone';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';
import { monthName, weekdayShort } from '@/lib/format';

const LANE_HEIGHT = 44;
const ROW_PAD = 12;
const BAR_HEIGHT = 36;

export interface GanttViewProps {
  year: number;
  month: number;
  vehicles: CalVehicle[];
  items: CalItem[];
  todayKey: string;
  onOpen: (dayKey: string, itemKey?: string) => void;
}

const LEGEND: { tone: keyof typeof BAR_TONE; label: string }[] = [
  { tone: 'ok', get label() { return tr('common.aktiv'); } },
  { tone: 'info', get label() { return tr('common.reserviert'); } },
  { tone: 'amber', get label() { return tr('availability.offeneAnfrage'); } },
  { tone: 'gray', get label() { return tr('common.wartung'); } },
];

export function GanttView({ year, month, vehicles, items, todayKey, onOpen }: GanttViewProps) {
  const t = useTranslations();
  const days = useMemo(() => monthDays(year, month), [year, month]);
  const n = days.length;
  const startKey = days[0].key;
  const endKey = days[n - 1].key;
  const todayIdx = days.findIndex((d) => d.key === todayKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () =>
      vehicles.map((v) => ({
        vehicle: v,
        ...ganttBars(
          items.filter((item) => item.vehicleId === v.id),
          startKey,
          endKey,
          n,
        ),
      })),
    [vehicles, items, startKey, endKey, n],
  );

  const hasCompleted = rows.some((r) => r.bars.some((b) => b.item.tone === 'mute'));
  const monthLabel = `${monthName(month)} ${year}`;

  // Bring today into view on narrow screens (the grid scrolls sideways there).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (todayIdx < 0 || el.scrollWidth <= el.clientWidth) {
      el.scrollLeft = 0;
      return;
    }
    const track = el.querySelector<HTMLElement>('[data-track]');
    const trackLeft = track?.offsetLeft ?? 0;
    const colWidth = (el.scrollWidth - trackLeft) / n;
    const visible = el.clientWidth - trackLeft;
    el.scrollLeft = Math.max(0, todayIdx * colWidth - visible / 3);
  }, [year, month, todayIdx, n, rows.length]);

  const template = `var(--lw) repeat(${n}, minmax(var(--col), 1fr))`;
  const gridLines = `repeating-linear-gradient(90deg, transparent 0, transparent calc(100%/${n} - 1px), rgb(var(--c-line-soft)) calc(100%/${n} - 1px), rgb(var(--c-line-soft)) calc(100%/${n}))`;

  return (
    <Panel aria-labelledby="gantt-heading" className="overflow-hidden">
      <div className="panel-h">
        <h2 className="h2" id="gantt-heading">
          {t('availability.belegungProFahrzeug')}
        </h2>
        <ul className="sm flex flex-wrap gap-x-4 gap-y-1.5" aria-label={t('availability.legende')}>
          {LEGEND.map((entry) => (
            <li key={entry.tone} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-4 w-4 flex-none rounded border-[1.5px]', BAR_TONE[entry.tone])} />
              {entry.label}
            </li>
          ))}
          {hasCompleted && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-4 w-4 flex-none rounded border-[1.5px]', BAR_TONE.mute)} />
              {t('common.erledigt')}
            </li>
          )}
        </ul>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          compact
          tone="neutral"
          icon={<CarFront size={32} />}
          title={t('availability.keineFahrzeuge')}
          text={t('availability.sobaldFahrzeugeInDer')}
        />
      ) : (
        <div
          ref={scrollRef}
          role="region"
          aria-label={t('availability.belegungProFahrzeugSeitlich', { monthLabel })}
          tabIndex={0}
          className="overflow-x-auto"
        >
          <div
            className="[--col:32px] [--lw:116px] md:[--col:28px] md:[--lw:200px]"
            style={{ minWidth: `calc(var(--lw) + ${n} * var(--col))` }}
          >
            {/* Header: weekday + date per column */}
            <div className="grid border-b border-line bg-row" style={{ gridTemplateColumns: template }}>
              <div className="sm sticky left-0 z-20 flex items-center border-r border-line-soft bg-row px-3 py-3 font-semibold text-graphite md:px-4">
                {t('common.fahrzeug')}
              </div>
              {days.map((d) => {
                const isToday = d.key === todayKey;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onOpen(d.key)}
                    aria-label={isToday ? t('availability.dayToday', { date: longDateLabel(d.key) }) : longDateLabel(d.key)}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'num flex flex-col items-center justify-center gap-0.5 py-1.5 text-[13px] font-semibold hover:bg-line-soft focus-visible:outline-offset-[-3px]',
                      d.weekend ? 'bg-weekend text-graphite' : 'text-ink',
                    )}
                  >
                    <span className="text-[11px] font-medium" aria-hidden="true">
                      {weekdayShort(d.weekday)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1',
                        isToday && 'bg-ruby text-white',
                      )}
                    >
                      {d.day}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* One row per vehicle */}
            {rows.map(({ vehicle, bars, lanes }) => {
              const labelId = `gantt-v-${vehicle.id}`;
              const height = lanes * LANE_HEIGHT + ROW_PAD;
              return (
                <div
                  key={vehicle.id}
                  role="group"
                  aria-labelledby={labelId}
                  className="grid border-b border-line-soft last:border-b-0"
                  style={{ gridTemplateColumns: template }}
                >
                  <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-line-soft bg-card px-3 py-2 md:px-4" style={{ minHeight: height }}>
                    <span id={labelId} className="line-clamp-2 break-words text-[14px] font-semibold leading-tight md:text-[15px]">
                      {vehicleLabel(vehicle)}
                    </span>
                    <span className="sm mut truncate">{vehicleMeta(vehicle)}</span>
                  </div>
                  <div data-track className="relative" style={{ gridColumn: '2 / -1', height }}>
                    <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: gridLines }} />
                    {days.map((d, i) =>
                      d.weekend ? (
                        <div
                          key={d.key}
                          aria-hidden="true"
                          className="absolute inset-y-0 bg-paper/70"
                          style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
                        />
                      ) : null,
                    )}
                    {todayIdx >= 0 && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-y-0 border-x border-ruby/40 bg-ruby-tint/60"
                        style={{ left: `${(todayIdx / n) * 100}%`, width: `${100 / n}%` }}
                      />
                    )}
                    {bars.map((bar) => {
                      const leftPx = bar.clippedStart ? 0 : 2;
                      const rightPx = bar.clippedEnd ? 0 : 2;
                      const span = bar.endIdx - bar.startIdx + 1;
                      const openKey = bar.item.startKey < startKey ? startKey : bar.item.startKey;
                      const description = itemDescription(bar.item);
                      return (
                        <button
                          key={bar.item.key}
                          type="button"
                          onClick={() => onOpen(openKey, bar.item.key)}
                          title={description}
                          aria-label={description}
                          className={cn(
                            'absolute block overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border-[1.5px] px-2 text-left text-[13px] font-semibold leading-[33px] hover:brightness-95',
                            BAR_TONE[bar.item.tone],
                            bar.clippedStart && 'rounded-l-none border-l-0',
                            bar.clippedEnd && 'rounded-r-none border-r-0',
                          )}
                          style={{
                            left: `calc(${(bar.startIdx / n) * 100}% + ${leftPx}px)`,
                            width: `calc(${(span / n) * 100}% - ${leftPx + rightPx}px)`,
                            top: ROW_PAD / 2 + bar.lane * LANE_HEIGHT,
                            height: BAR_HEIGHT,
                          }}
                        >
                          {barLabel(bar)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
