'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';

interface ContractPreview {
  booking: {
    id: string;
    customerName: string;
    customerEmail: string | null;
    vehicleBrand: string;
    vehicleModel: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
    locationName: string | null;
  };
  clauses: { id: string; heading: string; body: string }[];
}

type Step = 'agb' | 'contract' | 'sign' | 'done';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function SignContractContent() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { token } = useAdminAuth();

  const [preview, setPreview] = useState<ContractPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('agb');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    api
      .getContractPreview(id)
      .then(setPreview)
      .catch((err: any) => setError(err.message || 'Vertrag konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [token, id]);

  async function handleSign(signatureDataUrl: string) {
    setSigning(true);
    setError(null);
    try {
      await api.finalizeContract(id, { signature: signatureDataUrl });
      const blob = await api.downloadContract(id);
      triggerBlobDownload(blob, `HoppDrive-Vertrag-${id.substring(0, 8).toUpperCase()}.pdf`);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Vertrag konnte nicht signiert werden.');
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6 text-center">
        <div>
          <p className="text-red-600 font-medium mb-4">{error || 'Vertrag nicht gefunden.'}</p>
          <button onClick={() => router.push('/contracts')} className="text-brand-600 underline text-sm">
            Zurück zu Verträgen
          </button>
        </div>
      </div>
    );
  }

  const { booking } = preview;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Minimal chrome-free header — safe to hand this device to the customer */}
      <header className="bg-white border-b border-neutral-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/contracts')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Abbrechen
        </button>
        <div className="text-sm font-semibold text-neutral-900 text-center truncate px-2">
          {booking.vehicleBrand} {booking.vehicleModel} · {booking.customerName}
        </div>
        <div className="w-20 shrink-0" />
      </header>

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-neutral-300">
          <span className={step === 'agb' ? 'text-brand-600' : ''}>1. AGB</span>
          <span>→</span>
          <span className={step === 'contract' ? 'text-brand-600' : ''}>2. Vertrag</span>
          <span>→</span>
          <span className={step === 'sign' ? 'text-brand-600' : ''}>3. Unterschrift</span>
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pb-10">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {step === 'agb' && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mt-2">
            <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-neutral-900">Allgemeine Geschäftsbedingungen</h2>
            </div>
            <iframe src={`${API_URL}/legal/agb`} className="w-full h-[60vh]" title="AGB" />
            <div className="p-4 border-t border-neutral-100 flex justify-end">
              <button
                onClick={() => setStep('contract')}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Weiter zum Vertrag
              </button>
            </div>
          </div>
        )}

        {step === 'contract' && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mt-2">
            <div className="p-4 border-b border-neutral-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-neutral-900">Mietvertrag</h2>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <span className="text-xs text-neutral-400">Mieter</span>
                  <p className="font-medium text-neutral-900">{booking.customerName}</p>
                </div>
                <div>
                  <span className="text-xs text-neutral-400">Fahrzeug</span>
                  <p className="font-medium text-neutral-900">{booking.vehicleBrand} {booking.vehicleModel}</p>
                </div>
                <div>
                  <span className="text-xs text-neutral-400">Von</span>
                  <p className="font-medium text-neutral-900">{fmtDate(booking.startDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-neutral-400">Bis</span>
                  <p className="font-medium text-neutral-900">{fmtDate(booking.endDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-neutral-400">Gesamtpreis</span>
                  <p className="font-medium text-neutral-900">{booking.currency} {booking.totalPrice.toFixed(2)}</p>
                </div>
                {booking.locationName && (
                  <div>
                    <span className="text-xs text-neutral-400">Standort</span>
                    <p className="font-medium text-neutral-900">{booking.locationName}</p>
                  </div>
                )}
              </div>

              {preview.clauses.map((c) => (
                <div key={c.id}>
                  <h3 className="font-semibold text-neutral-900 mb-1">{c.heading}</h3>
                  <p className="text-neutral-600 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-neutral-100 flex justify-between">
              <button
                onClick={() => setStep('agb')}
                className="px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={() => setStep('sign')}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Weiter zur Unterschrift
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center mt-2">
            <ShieldCheck className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Vertrag unterschrieben</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Der signierte Vertrag wurde auf diesem Gerät heruntergeladen{booking.customerEmail
                ? ` und an ${booking.customerEmail} per E-Mail zugestellt.`
                : '.'}
            </p>
            <button
              onClick={() => router.push('/contracts')}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Zurück zu Verträgen
            </button>
          </div>
        )}
      </main>

      {step === 'sign' && (
        <SignaturePad
          customerName={booking.customerName}
          loading={signing}
          onConfirm={handleSign}
          onCancel={() => setStep('contract')}
        />
      )}
    </div>
  );
}

export default function SignContractPage() {
  return (
    <AdminAuthProvider>
      <SignContractContent />
    </AdminAuthProvider>
  );
}
