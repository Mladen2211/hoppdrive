/**
 * Alert / inline banner (radius 12). Tone + icon + text, never colour alone.
 *
 *   <Alert tone="err" title="Fahrzeuge konnten nicht geladen werden."
 *          action={<Button variant="outline" size="sm" onClick={retry}>Erneut versuchen</Button>}>
 *     Die Verbindung zum Server wurde unterbrochen. Ihre Daten sind sicher.
 *   </Alert>
 *   <Alert tone="ok"><b>Gespeichert.</b> Änderungen sind live.</Alert>
 *
 * Props:
 *  - tone: 'ok' | 'err' | 'warn' | 'info' (default 'info')
 *  - title: bold first line (optional; children may carry their own <b>)
 *  - children: the message
 *  - action: node below the message (button)
 *  - icon: custom node, or `false` for none (default icon per tone)
 *  - role: defaults to "alert" for err, "status" otherwise
 */
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type AlertTone = 'ok' | 'err' | 'warn' | 'info';

const TONE_CLASS: Record<AlertTone, string> = {
  ok: 'al-ok',
  err: 'al-err',
  warn: 'al-warn',
  info: 'al-info',
};

const TONE_ICON: Record<AlertTone, ReactNode> = {
  ok: <CircleCheck size={20} />,
  err: <TriangleAlert size={20} />,
  warn: <CircleAlert size={20} />,
  info: <Info size={20} />,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode | false;
  role?: 'alert' | 'status';
  className?: string;
}

export function Alert({ tone = 'info', title, children, action, icon, role, className }: AlertProps) {
  const iconNode = icon === undefined ? TONE_ICON[tone] : icon;
  return (
    <div className={cn('alert', TONE_CLASS[tone], className)} role={role ?? (tone === 'err' ? 'alert' : 'status')}>
      {iconNode && (
        <span className="mt-px flex-none" aria-hidden="true">
          {iconNode}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <b className="block font-semibold">{title}</b>}
        {children && <div className={cn(title ? 'sm mt-0.5' : undefined)}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
