'use client';

/**
 * "Umsatz pro Monat": grouped bars, this period against the same months one year earlier. Plain SVG,
 * no chart library. The viewBox follows the container width, so text keeps its size; below a minimum
 * width the chart scrolls sideways. Accessible as one image (summary in aria-label) plus a visually
 * hidden data table with every value.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { fmtMoney, fmtNumber } from '@/lib/format';
import { niceScale, type ChartMonth } from '@/lib/reports-model';
import { useTranslations } from 'next-intl';

const HEIGHT = 300;
const MARGIN = { left: 78, right: 12, top: 16, bottom: 34 };
// Colours come from the theme tokens (CSS variables), so the chart follows light / dark.
const CURRENT = 'rgb(var(--c-ruby))';
const PREVIOUS = 'rgb(var(--c-chart-prev))';

export function ChartLegend({ names }: { names: { current: string; previous: string } }) {
  const t = useTranslations();
  return (
    <ul className="sm flex gap-4" aria-label={t('reports.legende')}>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: CURRENT }} />
        {names.current}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: PREVIOUS }} />
        {names.previous}
      </li>
    </ul>
  );
}

/** Bar with rounded top corners. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

function useContainerWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth) || 720);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width) || 720));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export interface RevenueChartProps {
  months: ChartMonth[];
  names: { current: string; previous: string };
  /** One-sentence summary for screen readers (aria-label of the image). */
  summary: string;
}

export function RevenueChart({ months, names, summary }: RevenueChartProps) {
  const t = useTranslations();
  const currency = useCurrency();
  const [ref, containerWidth] = useContainerWidth();
  const minWidth = Math.max(480, months.length * 38 + MARGIN.left + MARGIN.right);
  const width = Math.max(containerWidth, minWidth);

  const geometry = useMemo(() => {
    const max = Math.max(0, ...months.map((m) => m.revenue), ...months.map((m) => m.previous));
    const scale = niceScale(max);
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const y = (v: number) => MARGIN.top + plotH - (v / scale.top) * plotH;
    const groupW = months.length > 0 ? plotW / months.length : plotW;
    const barW = Math.max(6, Math.min(22, groupW * 0.32));
    return { scale, plotW, plotH, y, groupW, barW };
  }, [months, width]);

  const { scale, y, groupW, barW } = geometry;
  const gap = 3;

  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto pb-1">
        <svg
          role="img"
          aria-label={summary}
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block max-w-none"
          fontFamily="var(--font-sans), 'Fira Sans', system-ui, sans-serif"
        >
          {scale.ticks.map((tick, i) => {
            const ty = y(tick);
            const isTop = i === scale.ticks.length - 1;
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={ty} y2={ty} className={tick === 0 ? 'stroke-cool' : 'stroke-line-soft'} strokeWidth={1} />
                <text x={MARGIN.left - 8} y={ty + 4} textAnchor="end" fontSize={12} className="fill-graphite">
                  {isTop ? fmtMoney(tick, { currency, decimals: 0 }) : fmtNumber(tick, 0)}
                </text>
              </g>
            );
          })}

          {months.map((m, i) => {
            const cx = MARGIN.left + groupW * (i + 0.5);
            const prevH = m.previous > 0 ? Math.max(2, y(0) - y(m.previous)) : 0;
            const curH = m.revenue > 0 ? Math.max(2, y(0) - y(m.revenue)) : 0;
            const open = m.future && m.revenue === 0;
            const tip = open
              ? t('reports.stehtNochAus', { fullLabel: m.fullLabel, previous: names.previous, cHF: fmtMoney(m.previous, { currency, decimals: 0 }) })
              : t(m.future ? 'reports.barTipBooked' : 'reports.barTip', { fullLabel: m.fullLabel, revenue: fmtMoney(m.revenue, { currency, decimals: 0 }), previousName: names.previous, previous: fmtMoney(m.previous, { currency, decimals: 0 }) });
            return (
              <g key={m.key}>
                <title>{tip}</title>
                <rect x={cx - groupW / 2} y={MARGIN.top} width={groupW} height={HEIGHT - MARGIN.top - MARGIN.bottom} fill="transparent" />
                {prevH > 0 && <path d={barPath(cx - gap / 2 - barW, y(0) - prevH, barW, prevH)} style={{ fill: PREVIOUS }} />}
                {curH > 0 && <path d={barPath(cx + gap / 2, y(0) - curH, barW, curH)} style={{ fill: CURRENT }} />}
                <text x={cx} y={HEIGHT - 12} textAnchor="middle" fontSize={12} className={m.future ? 'fill-field' : 'fill-graphite'}>
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <table className="sr-only">
        <caption>{t('reports.revenuePerMonthIn', { currency })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('reports.monat')}</th>
            <th scope="col">{names.current}</th>
            <th scope="col">{names.previous}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row">{m.fullLabel}</th>
              <td>{m.future && m.revenue === 0 ? t('reports.pending') : fmtMoney(m.revenue, { currency, decimals: 0 })}</td>
              <td>{fmtMoney(m.previous, { currency, decimals: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
