'use client';

/**
 * Toasts: short confirmations that replace alert().
 * Mount <ToastProvider> once in the shell, then anywhere below it:
 *
 *   const { toast } = useToast();
 *   toast({ title: 'Fahrzeug gespeichert', tone: 'success',
 *           action: { label: 'Rückgängig', onClick: undo } });
 *   toast.success('Fahrzeug gespeichert');                 // shorthands
 *   toast.error('Speichern fehlgeschlagen', 'Verbindung unterbrochen.');
 *   toast.info('Neue Version verfügbar', undefined, { action: { label: 'Neu laden', onClick: reload } });
 *
 * Options: title, description?, tone ('success' default | 'error' | 'info'),
 *   action? { label, onClick } (underlined button; also dismisses), duration (ms, default 6000, 0 = sticky).
 * Name the action like the button that caused it ("Speichern" -> "gespeichert").
 *
 * Behaviour: dark toast, bottom-centre on mobile and bottom-right from 768 px, at most 3
 * stacked (oldest is dropped), auto-dismiss after 6 s (paused while hovered or focused),
 * polite live region (error toasts use role="alert"), safe-area aware. A shell with a mobile
 * bottom navigation can lift the stack by setting `--toast-offset` (default 16px) on :root.
 * Without a provider useToast() returns no-ops, so components never crash.
 */
import { Check, CircleAlert, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Portal } from './Portal';
import { useTranslations } from 'next-intl';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastItemData extends ToastOptions {
  id: string;
}

type ShorthandOptions = Pick<ToastOptions, 'action' | 'duration'>;

export interface ToastFn {
  (options: ToastOptions): string;
  success: (title: ReactNode, description?: ReactNode, options?: ShorthandOptions) => string;
  error: (title: ReactNode, description?: ReactNode, options?: ShorthandOptions) => string;
  info: (title: ReactNode, description?: ReactNode, options?: ShorthandOptions) => string;
}

export interface ToastApi {
  toast: ToastFn;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 6000;

const ToastContext = createContext<ToastApi | null>(null);

function createToastFn(push: (options: ToastOptions) => string): ToastFn {
  const fn = ((options: ToastOptions) => push(options)) as ToastFn;
  fn.success = (title, description, options) => push({ title, description, tone: 'success', ...options });
  fn.error = (title, description, options) => push({ title, description, tone: 'error', ...options });
  fn.info = (title, description, options) => push({ title, description, tone: 'info', ...options });
  return fn;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItemData[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const push = (options: ToastOptions) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setItems((current) => [...current, { ...options, id }].slice(-MAX_TOASTS));
      return id;
    };
    return { toast: createToastFn(push), dismiss };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+var(--toast-offset,16px))] md:items-end md:px-6"
        >
          {items.map((item) => (
            <ToastView key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: <Check size={20} className="text-toast-ok" />,
  error: <CircleAlert size={20} className="text-toast-err" />,
  info: <Info size={20} className="text-toast-info" />,
};

function ToastView({ item, onDismiss }: { item: ToastItemData; onDismiss: (id: string) => void }) {
  const t = useTranslations();
  const { id, title, description, action, duration = DEFAULT_DURATION } = item;
  const tone = item.tone ?? 'success';
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [paused, duration, id, onDismiss]);

  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="toast pointer-events-auto w-full max-w-[420px] animate-slide-up"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="flex-none" aria-hidden="true">
        {TONE_ICON[tone]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {description && <div className="text-sm text-on-inverse/80">{description}</div>}
      </div>
      {action && (
        <button
          type="button"
          className="min-h-[44px] flex-none px-1.5 text-sm font-semibold text-on-inverse underline"
          onClick={() => {
            action.onClick();
            onDismiss(id);
          }}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t('ui.meldungSchliessen')}
        className="-mr-1.5 flex h-11 w-11 flex-none items-center justify-center rounded-lg text-on-inverse/70 hover:text-on-inverse"
        onClick={() => onDismiss(id)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

const noop = () => '';
const NOOP_API: ToastApi = {
  toast: Object.assign(noop, { success: noop, error: noop, info: noop }) as ToastFn,
  dismiss: () => undefined,
};

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_API;
}
