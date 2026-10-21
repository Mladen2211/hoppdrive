'use client';

/**
 * ConfirmDialog + promise-based useConfirm(): replaces window.confirm().
 *
 * 1) Imperative (recommended). Mount <ConfirmProvider> once (shell), then:
 *      const confirm = useConfirm();
 *      if (!(await confirm({ title: 'Škoda Scala löschen?',
 *                            description: 'Das Fahrzeug verschwindet von der Website.',
 *                            warning: <>Für dieses Fahrzeug gibt es <b>keine</b> offenen Buchungen.</>,
 *                            confirmLabel: 'Fahrzeug löschen', icon: <Trash2 size={20} /> }))) return;
 *    With an async `onConfirm` the dialog stays open with a spinner until it finishes,
 *    resolves true on success, and shows the error (dialog stays open) if it throws:
 *      await confirm({ title: 'Stornieren?', confirmLabel: 'Stornieren',
 *                      onConfirm: () => api.cancelBooking(id) });
 *    Without a provider useConfirm() falls back to window.confirm, so pages keep working.
 *
 * 2) Declarative: <ConfirmDialog open onClose onConfirm ... />.
 *
 * Options / props: title, description?, warning? (amber callout node), confirmLabel
 *   (default "Bestätigen"), cancelLabel (default "Abbrechen"), tone 'danger' (default,
 *   red button) | 'primary', icon? (default: alert triangle / question mark), loading?
 *   (external), onConfirm (may be async), onClose (cancel / dismiss).
 * Focus starts on "Abbrechen" for danger and on the confirm button for primary;
 * Escape cancels; role="alertdialog".
 */
import { CircleHelp, TriangleAlert } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Modal } from './Modal';
import { tr } from '@/i18n/active';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  warning?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  icon?: ReactNode;
  loading?: boolean;
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  warning,
  confirmLabel = tr('ui.bestaetigen'),
  cancelLabel = tr('common.abbrechen'),
  tone = 'danger',
  icon,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const working = busy || loading;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : tr('ui.dieAktionIstFehlgeschlagen'));
    } finally {
      setBusy(false);
    }
  };

  const danger = tone === 'danger';
  const iconNode = icon ?? (danger ? <TriangleAlert size={20} /> : <CircleHelp size={20} />);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      hideClose
      dismissible={!working}
      initialFocusRef={danger ? cancelRef : confirmRef}
      icon={
        <span
          className={
            danger
              ? 'flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-err-tint text-err'
              : 'flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-info-tint text-info'
          }
          aria-hidden="true"
        >
          {iconNode}
        </span>
      }
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onClose} disabled={working}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={run} loading={working}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {warning && <Alert tone="warn" className="px-3.5 py-2.5" icon={false}>{warning}</Alert>}
      {error && <Alert tone="err">{error}</Alert>}
    </Modal>
  );
}

// ─── Provider + hook ─────────────────────────────────────────────

export type ConfirmOptions = Omit<ConfirmDialogProps, 'open' | 'onClose' | 'onConfirm' | 'loading'> & {
  onConfirm?: () => void | Promise<unknown>;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false); // a newer request replaces an open one
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        {...(options ?? { title: '' })}
        open={options !== null}
        onConfirm={async () => {
          await options?.onConfirm?.();
          settle(true);
        }}
        onClose={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

function textOf(node: ReactNode): string {
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}

const browserConfirm: ConfirmFn = async (options) => {
  const message = [textOf(options.title), textOf(options.description)].filter(Boolean).join('\n\n') || tr('ui.sindSieSicher');
  if (!window.confirm(message)) return false;
  await options.onConfirm?.();
  return true;
};

/** Promise-based confirm. Resolves true on confirm, false on cancel / Escape. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? browserConfirm;
}
