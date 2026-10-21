'use client';

/**
 * Signature capture.
 *
 *  - <SignatureArea>  the inline canvas (dashed box, base line, hint) with an imperative
 *                     controller; used by the sign page (customer-facing card) and by the dialog below.
 *  - <SignaturePad>   dialog around it (default export, props unchanged):
 *                     { onConfirm(dataUrl), onCancel, customerName?, loading? }
 *
 * The dataUrl is cropped to the drawn area by an alpha-channel bounding box
 * (the alpha build of react-signature-canvas has a broken getTrimmedCanvas()).
 */
import { PenTool, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button, Modal, cn } from '@/components/ui';
import { useTranslations } from 'next-intl';

/** Manual trim: crops to the non-transparent pixels plus 10 px padding. */
function trimCanvasToDataUrl(canvas: HTMLCanvasElement | undefined | null): string {
  if (!canvas) return '';

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height);
  const { data } = pixels;

  let top = height, bottom = 0, left = width, right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (top >= bottom || left >= right) return canvas.toDataURL('image/png');

  const pad = 10;
  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(height - 1, bottom + pad);
  right = Math.min(width - 1, right + pad);

  const tw = right - left + 1;
  const th = bottom - top + 1;
  const trimmed = document.createElement('canvas');
  trimmed.width = tw;
  trimmed.height = th;
  trimmed.getContext('2d')!.drawImage(canvas, left, top, tw, th, 0, 0, tw, th);
  return trimmed.toDataURL('image/png');
}

export interface SignatureController {
  /** Trimmed base64 PNG of the drawing ('' when nothing was drawn). */
  getDataUrl: () => string;
  clear: () => void;
  isEmpty: () => boolean;
}

export interface SignatureAreaProps {
  /** Canvas height in px (default 200). */
  height?: number;
  /** Called whenever the empty state changes (true = nothing drawn). */
  onEmptyChange?: (isEmpty: boolean) => void;
  /** Receives the controller once the canvas is mounted. */
  onReady?: (controller: SignatureController) => void;
  /** Disables drawing (e.g. while saving). */
  disabled?: boolean;
  className?: string;
}

export function SignatureArea({ height = 200, onEmptyChange, onReady, disabled = false, className }: SignatureAreaProps) {
  const t = useTranslations();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const onEmptyChangeRef = useRef(onEmptyChange);
  onEmptyChangeRef.current = onEmptyChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    onReadyRef.current?.({
      getDataUrl: () => {
        const pad = sigRef.current;
        if (!pad || pad.isEmpty()) return '';
        return trimCanvasToDataUrl(pad.getCanvas());
      },
      clear: () => {
        sigRef.current?.clear();
        onEmptyChangeRef.current?.(true);
      },
      isEmpty: () => sigRef.current?.isEmpty() ?? true,
    });
  }, []);

  return (
    <div
      role="group"
      // A sheet of paper with dark ink: it keeps the light palette in the dark theme as well.
      data-theme="light"
      aria-label={t('signaturePad.unterschriftsfeldMitFingerOder')}
      className={cn(
        'relative overflow-hidden rounded-xl border-2 border-dashed border-field bg-canvas',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <SignatureCanvas
        ref={sigRef}
        penColor="#1a1a1a"
        canvasProps={{
          className: 'block w-full touch-none',
          style: { width: '100%', height: `${height}px` },
        }}
        onBegin={() => onEmptyChangeRef.current?.(false)}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[18px] bottom-[30px] border-t-[1.5px] border-line" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-[18px] text-xs text-graphite">
        {t('signaturePad.mitFingerOderMaus')}
      </span>
    </div>
  );
}

interface SignaturePadProps {
  /** Called when the user confirms their signature (base64 PNG data URL) */
  onConfirm: (signatureDataUrl: string) => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Optional customer name to display */
  customerName?: string;
  /** Whether the confirm action is loading */
  loading?: boolean;
}

export default function SignaturePad({
  onConfirm,
  onCancel,
  customerName,
  loading = false,
}: SignaturePadProps) {
  const tt = useTranslations();
  const t = useTranslations();
  const controllerRef = useRef<SignatureController | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  function handleClear() {
    controllerRef.current?.clear();
    setIsEmpty(true);
  }

  function handleConfirm() {
    const controller = controllerRef.current;
    if (!controller || controller.isEmpty()) return;
    const dataUrl = controller.getDataUrl();
    if (dataUrl) onConfirm(dataUrl);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      dismissible={!loading}
      title={t('signaturePad.vertragUnterschreiben')}
      size="md"
      icon={
        <span
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-ruby-tint text-ruby-fg"
          aria-hidden="true"
        >
          <PenTool size={20} />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t('common.abbrechen')}
          </Button>
          <Button onClick={handleConfirm} disabled={isEmpty} loading={loading}>
            {loading ? tt('signaturePad.wirdGespeichert') : tt('signaturePad.unterschreiben')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {customerName && (
          <p className="text-sm">
            {t.rich('signaturePad.signatureOf', { name: customerName, b: (chunks) => <span className="font-semibold">{chunks}</span> })}
          </p>
        )}
        <p className="sm mut">
          {t('signaturePad.bitteUnterschreibenSieIm')}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="lbl">{t('signaturePad.ihreUnterschrift')}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isEmpty || loading}
            iconLeft={<RotateCcw size={16} aria-hidden="true" />}
          >
            {t('common.loeschen')}
          </Button>
        </div>

        <SignatureArea
          height={200}
          disabled={loading}
          onEmptyChange={setIsEmpty}
          onReady={(controller) => {
            controllerRef.current = controller;
          }}
        />

        <p className="text-[12px] text-graphite">
          {t('signaturePad.dieseElektronischeUnterschrift')}
        </p>
      </div>
    </Modal>
  );
}
