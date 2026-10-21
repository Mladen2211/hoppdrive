/**
 * Skeleton placeholders: loading states in the SHAPE of the content (no page
 * spinners). The shimmer stops under prefers-reduced-motion (globals.css).
 *
 *   <Skeleton className="h-5 w-2/5" />                         single block (height/width via classes or props)
 *   <SkeletonRows rows={5} />                                  list rows: avatar + two lines + pill
 *   <tbody><SkeletonTableRows rows={5} columns={4} /></tbody>  table rows
 *
 * Skeleton props: width?, height? (number = px, or any CSS size), rounded? (CSS radius), className.
 * SkeletonRows props: rows (default 5), avatar (default true), pill (default true), label (sr-only text).
 * SkeletonTableRows props: rows (default 5), columns (default 4).
 */
import type { CSSProperties } from 'react';
import { cn } from './cn';
import { tr } from '@/i18n/active';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height, rounded, className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('skel', className)}
      style={{ width, height, borderRadius: rounded, ...style }}
    />
  );
}

const LINE_WIDTHS: Array<[string, string]> = [
  ['55%', '35%'],
  ['42%', '50%'],
  ['62%', '30%'],
  ['48%', '44%'],
  ['58%', '38%'],
];

export interface SkeletonRowsProps {
  rows?: number;
  avatar?: boolean;
  pill?: boolean;
  label?: string;
  className?: string;
}

export function SkeletonRows({
  rows = 5,
  avatar = true,
  pill = true,
  label = tr('ui.inhalteWerdenGeladen'),
  className,
}: SkeletonRowsProps) {
  return (
    <div aria-busy="true" role="status" className={className}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => {
        const [w1, w2] = LINE_WIDTHS[index % LINE_WIDTHS.length];
        return (
          <div key={index} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
            {avatar && <Skeleton className="h-10 w-10 flex-none" rounded="50%" />}
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5" width={w1} />
              <Skeleton className="h-3" width={w2} />
            </div>
            {pill && <Skeleton className="h-[26px] w-[72px] flex-none" rounded={999} />}
          </div>
        );
      })}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, col) => (
            <td key={col}>
              <Skeleton className="h-3.5" width={col === 0 ? '70%' : `${50 + ((row * 7 + col * 13) % 35)}%`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
