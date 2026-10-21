/**
 * KPI tile: label + icon on top, big value in Fira Sans Condensed (tabular
 * figures), optional trend line underneath.
 *
 *   <KpiCard label="Umsatz Oktober" value={fmtCHF(14820, { decimals: 0 })}
 *            icon={<Wallet size={20} />} trend="+12 % zum Vormonat" trendTone="ok" />
 *
 * Props:
 *  - label, value (ReactNode), icon (lucide node, optional)
 *  - trend: short text under the value; trendTone: 'ok' (green, default) | 'err' | 'warn' | 'mute'
 *    (a trend must always say what it compares to; the colour is never the only signal)
 *  - href: makes the whole tile a link (e.g. to the filtered list)
 *  - className
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  trend?: ReactNode;
  trendTone?: 'ok' | 'err' | 'warn' | 'mute';
  href?: string;
  className?: string;
}

const TREND_TONE: Record<NonNullable<KpiCardProps['trendTone']>, string> = {
  ok: 'text-ok',
  err: 'text-err',
  warn: 'text-warn',
  mute: 'text-graphite',
};

export function KpiCard({ label, value, icon, trend, trendTone = 'ok', href, className }: KpiCardProps) {
  const body = (
    <>
      <div className="l">
        <span>{label}</span>
        {icon && (
          <span className="ic" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <b>{value}</b>
      {trend && <span className={cn('tr', TREND_TONE[trendTone])}>{trend}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn('kpi no-underline transition-colors hover:border-ink', className)}>
        {body}
      </Link>
    );
  }
  return <div className={cn('kpi', className)}>{body}</div>;
}
