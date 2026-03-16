'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, RotateCcw, Check, PenTool } from 'lucide-react';

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
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  function handleClear() {
    sigRef.current?.clear();
    setIsEmpty(true);
  }

  function handleConfirm() {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
    onConfirm(dataUrl);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-neutral-900">Vertrag unterschreiben</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            title="Schliessen"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {customerName && (
            <p className="text-sm text-neutral-600 mb-3">
              Unterschrift von <span className="font-semibold text-neutral-900">{customerName}</span>
            </p>
          )}

          <p className="text-xs text-neutral-500 mb-3">
            Bitte unterschreiben Sie im Feld unten. Mit der Unterschrift bestätigen Sie den Mietvertrag.
          </p>

          {/* Signature canvas area */}
          <div className="relative border-2 border-dashed border-neutral-300 rounded-xl bg-neutral-50 overflow-hidden">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1a1a1a"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: '200px' },
              }}
              onBegin={() => setIsEmpty(false)}
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-neutral-400 text-sm">Hier unterschreiben…</p>
              </div>
            )}
          </div>

          {/* Legal note */}
          <p className="text-[11px] text-neutral-400 mt-2">
            Diese elektronische Unterschrift ist rechtlich bindend gemäss Schweizer OR Art. 14.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
            Löschen
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isEmpty || loading}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Unterschreiben
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
