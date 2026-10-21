/**
 * Alert / inline message (radius 12, 15 px). Tone + icon + text, never colour alone.
 *
 *   <Alert tone="err" title="Die Anfrage wurde nicht gesendet."
 *          action={<Button size="md" onClick={retry}>Erneut senden</Button>}>
 *     Der Server ist gerade nicht erreichbar. Ihre Eingaben sind noch da.
 *   </Alert>
 *   <Alert tone="info" actionPlacement="end" action={<Button variant="ghost">Ändern</Button>}>
 *     Fahrzeug aus Ihrer Auswahl übernommen: <b>Škoda Kodiaq</b>
 *   </Alert>
 *
 * Props:
 *  - tone: 'ok' | 'err' | 'warn' | 'info' (default 'info')
 *  - title: bold first line (optional)
 *  - children: the message
 *  - action: a button/link node; actionPlacement 'below' (default) | 'end' (right side, centred)
 *  - icon: custom node, or `false` for none (default icon per tone)
 *  - role: defaults to "alert" for err (announced immediately), "status" otherwise
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
  actionPlacement?: 'below' | 'end';
  icon?: ReactNode | false;
  role?: 'alert' | 'status';
  className?: string;
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  actionPlacement = 'below',
  icon,
  role,
  className,
}: AlertProps) {
  const iconNode = icon === undefined ? TONE_ICON[tone] : icon;
  return (
    <div
      className={cn('alert', TONE_CLASS[tone], actionPlacement === 'end' && Boolean(action) && 'items-center', className)}
      role={role ?? (tone === 'err' ? 'alert' : 'status')}
    >
      {iconNode && (
        <span className="mt-px flex-none" aria-hidden="true">
          {iconNode}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <b className="block font-semibold">{title}</b>}
        {children && <div className={cn(title ? 'text-sm' : undefined)}>{children}</div>}
        {action && actionPlacement === 'below' && <div className="mt-3">{action}</div>}
      </div>
      {action && actionPlacement === 'end' && <div className="flex-none">{action}</div>}
    </div>
  );
}
