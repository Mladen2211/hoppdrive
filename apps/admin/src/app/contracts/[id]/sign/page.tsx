'use client';

/**
 * "Mietvertrag unterschreiben": the customer-facing signing flow on the staff device (Auth board,
 * panel 3). Steps: 1 AGB -> 2 Fahrerdaten -> 3 Bekannte Schäden -> 4 Vertrag -> 5 Unterschrift -> done.
 * Lives outside the (cms) group, so it has no sidebar and its own AdminAuthProvider.
 */
import type { ContractPreviewDto, VehicleDamageDto } from '@hoppdrive/shared';
import { ArrowLeft, Download, FileText, ShieldCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Logo, ProgressSteps, Skeleton, Spinner } from '@/components/ui';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { SignatureController } from '@/components/SignaturePad';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { contractFilename } from '@/lib/booking';
import { triggerBlobDownload } from '@/lib/download';
import { errorText } from '@/lib/errors';
import { isCompanySignatureMissing } from '@/lib/inspection-errors';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';
import { AgbFrame } from './AgbFrame';
import { ContractStep } from './ContractStep';
import { DamagesStep } from './DamagesStep';
import { DriverStep } from './DriverStep';
import { Summary, VehicleCard } from './SignParts';

const SignatureArea = dynamic(() => import('@/components/SignaturePad').then((m) => m.SignatureArea), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" rounded={12} />,
});

type Step = 'agb' | 'driver' | 'damages' | 'contract' | 'sign' | 'done';

const BIG_BUTTON = 'min-h-[52px] text-base';
const STEP_ORDER: Step[] = ['agb', 'driver', 'damages', 'contract', 'sign'];

function stepsFor(step: Step) {
  const index = step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step);
  const labels = ['AGB', tr('sign.stepDriver'), tr('sign.stepDamages'), tr('common.vertrag'), tr('sign.unterschrift')];
  return labels.map((label, i) => ({
    label: `${i + 1}. ${label}`,
    state: (i < index ? 'done' : i === index ? 'now' : 'todo') as 'done' | 'now' | 'todo',
  }));
}

function SignContractContent() {
  const t = useTranslations();
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { token } = useAdminAuth();

  const [preview, setPreview] = useState<ContractPreviewDto | null>(null);
  const [damages, setDamages] = useState<VehicleDamageDto[] | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('agb');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigEmpty, setSigEmpty] = useState(true);
  const [consent, setConsent] = useState(false);
  const [damagesAck, setDamagesAck] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const controllerRef = useRef<SignatureController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const [loaded, booking] = await Promise.all([api.getContractPreview(id), api.getBooking(id).catch(() => null)]);
        if (cancelled) return;
        setPreview(loaded);
        // The preview carries no vehicle id: take it from the booking to load the damages (with photos).
        if (booking?.vehicleId) {
          api
            .getVehicleDamages(booking.vehicleId, 'OPEN')
            .then((open) => !cancelled && setDamages(open))
            .catch(() => {
              /* the textual list of the preview is shown instead */
            });
        }
      } catch (err) {
        if (!cancelled) setError(errorText(err, tr('sign.vertragKonnteNichtGeladen')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  // Best-effort vehicle photo (the preview has none): match by brand + model in the public list.
  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    api
      .getVehicles()
      .then((list) => {
        if (cancelled) return;
        const match = list.find(
          (v: { brand: string; model: string }) => v.brand === preview.booking.vehicleBrand && v.model === preview.booking.vehicleModel,
        );
        setThumbnail(match?.thumbnailUrl ?? match?.images?.[0]?.url ?? null);
      })
      .catch(() => {
        /* the silhouette placeholder is fine */
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
    // Tablet use: always start the next step at the top.
    window.scrollTo({ top: 0 });
    topRef.current?.focus({ preventScroll: true });
  }

  async function handleSign() {
    const controller = controllerRef.current;
    if (!controller || controller.isEmpty()) {
      setError(tr('sign.bitteUnterschreibenSieIm'));
      return;
    }
    if (!consent) {
      setError(tr('sign.bitteBestaetigenSieDass'));
      return;
    }
    const signature = controller.getDataUrl();
    if (!signature) {
      setError(tr('sign.bitteUnterschreibenSieIm'));
      return;
    }
    setSigning(true);
    setError(null);
    try {
      await api.finalizeContract(id, { signature });
      const blob = await api.downloadContract(id);
      triggerBlobDownload(blob, contractFilename(id));
      goTo('done');
    } catch (err) {
      if (await isCompanySignatureMissing(err)) {
        // Staff problem, not the renter's: send them back to the contract step, which explains it.
        goTo('contract');
        setPreview((p) => (p ? { ...p, companySigner: { ...p.companySigner, hasSignature: false } } : p));
      } else {
        setError(errorText(err, tr('sign.vertragKonnteNichtSigniert')));
      }
    } finally {
      setSigning(false);
    }
  }

  async function handleDownloadAgain() {
    setDownloading(true);
    try {
      triggerBlobDownload(await api.downloadContract(id), contractFilename(id));
    } catch (err) {
      setError(errorText(err, tr('sign.derVertragKonnteNicht')));
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner size={32} label={t('sign.vertragWirdGeladen')} className="text-ruby-fg" />
      </div>
    );
  }

  if (!preview) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper p-6">
        <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
          <Alert tone="err">{error || t('sign.vertragNichtGefunden')}</Alert>
          <Button variant="ghost" onClick={() => router.push('/contracts')}>
            {t('sign.zurueckZuVertraegen')}
          </Button>
        </div>
      </main>
    );
  }

  const { booking } = preview;
  const showEmail = Boolean(booking.customerEmail);

  return (
    <div className="min-h-dvh bg-paper font-sans text-[15px] text-ink">
      {/* Minimal chrome-free header: safe to hand this device to the customer */}
      <header className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-4 pt-4 sm:pt-6">
        <Logo variant="stacked" height={63} priority className="max-sm:!h-[54px]" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {step !== 'done' && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/contracts')} iconLeft={<ArrowLeft size={18} aria-hidden="true" />}>
              <span className="max-[430px]:sr-only">{t('common.abbrechen')}</span>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pb-10 pt-4">
        <div ref={topRef} tabIndex={-1} className="outline-none">
          <h1 className="h1 text-[26px]">{step === 'done' ? t('sign.vertragUnterschrieben') : t('sign.mietvertragUnterschreiben')}</h1>
          {step !== 'done' && <p className="mut mt-1">{t('sign.bittePruefenSieDie')}</p>}
        </div>

        {step !== 'done' && <ProgressSteps aria-label={t('common.schritte')} steps={stepsFor(step)} />}

        {error && <Alert tone="err">{error}</Alert>}

        {step === 'agb' && (
          <section className="panel overflow-hidden" aria-labelledby="agb-h">
            <div className="panel-h">
              <h2 className="h2 flex items-center gap-2" id="agb-h">
                <FileText size={20} className="text-ruby-fg" aria-hidden="true" />
                {t('sign.allgemeineGeschaeftsbedingunge')}
              </h2>
            </div>
            <AgbFrame title={t('sign.allgemeineGeschaeftsbedingunge')} />
            <div className="flex justify-end border-t border-line-soft p-4">
              <Button onClick={() => goTo('driver')} className={`${BIG_BUTTON} max-sm:w-full`}>
                {t('sign.weiterZuDenFahrerdaten')}
              </Button>
            </div>
          </section>
        )}

        {step === 'driver' && (
          <DriverStep
            preview={preview}
            onBack={() => goTo('agb')}
            onDone={(fresh) => {
              setPreview(fresh);
              goTo('damages');
            }}
          />
        )}

        {step === 'damages' && (
          <DamagesStep
            preview={preview}
            thumbnail={thumbnail}
            damages={damages}
            acknowledged={damagesAck}
            onAcknowledge={setDamagesAck}
            onBack={() => goTo('driver')}
            onNext={() => goTo('contract')}
          />
        )}

        {step === 'contract' && <ContractStep preview={preview} thumbnail={thumbnail} onBack={() => goTo('damages')} onNext={() => goTo('sign')} />}

        {step === 'sign' && (
          <section className="panel flex flex-col gap-4 p-5" aria-labelledby="sign-h">
            <h2 className="sr-only" id="sign-h">
              {t('sign.unterschrift')}
            </h2>
            <VehicleCard preview={preview} thumbnail={thumbnail} />
            <Summary preview={preview} />

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="lbl">{t('sign.ihreUnterschrift')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={sigEmpty || signing}
                  onClick={() => {
                    controllerRef.current?.clear();
                    setSigEmpty(true);
                  }}
                >
                  {t('common.loeschen')}
                </Button>
              </div>
              <SignatureArea
                height={200}
                disabled={signing}
                onEmptyChange={setSigEmpty}
                onReady={(controller) => {
                  controllerRef.current = controller;
                }}
              />
              <p className="mt-1.5 text-[12px] text-graphite">{t('sign.dieseElektronischeUnterschrift')}</p>
            </div>

            <label className="chk items-start gap-3 py-1">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-6 w-6"
                aria-required="true"
              />
              <span>{t('sign.ichHabeDenVertrag')}</span>
            </label>

            <Button onClick={() => void handleSign()} loading={signing} disabled={sigEmpty || !consent} fullWidth className="min-h-[52px] text-base">
              {signing ? t('sign.wirdGespeichert') : t('sign.verbindlichUnterschreiben')}
            </Button>
            <Button variant="ghost" onClick={() => goTo('contract')} disabled={signing} className={BIG_BUTTON}>
              {t('sign.zurueckZumVertrag')}
            </Button>
            <p className="sm mut">
              {showEmail ? t('sign.nachDerUnterschriftPaket', { customerEmail: booking.customerEmail }) : t('sign.nachDerUnterschriftWird')}
            </p>
          </section>
        )}

        {step === 'done' && (
          <section className="panel flex flex-col items-center gap-4 p-8 text-center" aria-labelledby="done-h">
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-20 bg-ok-tint text-ok" aria-hidden="true">
              <ShieldCheck size={36} />
            </span>
            <h2 className="h2" id="done-h">
              {t('sign.vielenDank', { customerName: booking.customerName })}
            </h2>
            <p className="mut max-w-[440px]">
              {t('sign.doneDownloaded')} {showEmail ? t('sign.donePackage', { customerEmail: booking.customerEmail }) : t('sign.doneNoEmail')}
            </p>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <Button variant="ghost" loading={downloading} onClick={() => void handleDownloadAgain()} iconLeft={<Download size={18} aria-hidden="true" />} className={BIG_BUTTON}>
                {t('sign.vertragAlsPDFLesen')}
              </Button>
              <Button onClick={() => router.push('/contracts')} className={BIG_BUTTON}>
                {t('sign.zurueckZuVertraegen')}
              </Button>
            </div>
          </section>
        )}
      </main>
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
