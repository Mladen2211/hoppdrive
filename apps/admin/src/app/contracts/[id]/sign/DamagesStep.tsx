'use client';

/**
 * Step "Bekannte Schäden": the vehicle's open damages on the car diagram (read-only) and as a list with photos.
 * The renter confirms that they took note of them; the same list is printed in the contract.
 * `damages` is null when the damages could not be loaded (the list from the contract preview is shown as text).
 */
import type { ContractPreviewDto, VehicleDamageDto } from '@hoppdrive/shared';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button, Checkbox } from '@/components/ui';
import { CarDiagram, type DiagramPin } from '@/components/damage/CarDiagram';
import { DamageList } from '@/components/damage/DamageList';
import { PhotoLightbox } from '@/components/damage/DamagePhotos';
import { damageAriaLabel, damageSeverityLabel, damageTypeLabel, numberDamages } from '@/lib/damage-model';
import { VehicleCard } from './SignParts';

const BIG_BUTTON = 'min-h-[52px] text-base';

export interface DamagesStepProps {
  preview: ContractPreviewDto;
  thumbnail: string | null;
  damages: VehicleDamageDto[] | null;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DamagesStep({ preview, thumbnail, damages, acknowledged, onAcknowledge, onBack, onNext }: DamagesStepProps) {
  const t = useTranslations();
  const [lightbox, setLightbox] = useState<{ id: string; index: number } | null>(null);
  const numbered = useMemo(() => numberDamages((damages ?? []).filter((d) => d.status === 'OPEN')), [damages]);
  const pins = useMemo<DiagramPin[]>(
    () =>
      numbered.map((d) => ({
        id: d.id,
        view: d.view,
        x: d.x,
        y: d.y,
        label: d.n ?? undefined,
        tone: 'open',
        severity: d.severity,
        ariaLabel: damageAriaLabel(d),
      })),
    [numbered],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const known = damages !== null ? numbered.length : preview.existingDamages.length;
  const lightboxDamage = lightbox ? (numbered.find((d) => d.id === lightbox.id) ?? null) : null;

  return (
    <section className="panel flex flex-col gap-4 p-5" aria-labelledby="damages-h">
      <div>
        <h2 className="h2" id="damages-h">
          {t('sign.stepDamages')}
        </h2>
        <p className="mut mt-1">{known > 0 ? t('sign.damagesIntro') : t('sign.damagesNone')}</p>
      </div>
      <VehicleCard preview={preview} thumbnail={thumbnail} />

      {known === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-ok-tint px-4 py-3.5 text-ok-ink">
          <ShieldCheck size={24} aria-hidden="true" />
          <b>{t('sign.damagesNoneBadge')}</b>
        </div>
      ) : damages !== null ? (
        <>
          <CarDiagram
            pins={pins}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hint={t('sign.damagesDiagramHint')}
            aria-label={t('damages.diagramOf', { vehicle: `${preview.booking.vehicleBrand} ${preview.booking.vehicleModel}` })}
          />
          <DamageList
            damages={numbered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenPhotos={(d, index) => setLightbox({ id: d.id, index })}
            emptyText={t('sign.damagesNone')}
          />
        </>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {preview.existingDamages.map((d) => (
            <li key={d.number} className="rounded-xl border border-line p-3.5">
              <b>
                {d.number}. {d.zone}
              </b>
              <p className="sm mut">
                {damageTypeLabel(d.type)} · {damageSeverityLabel(d.severity)}
              </p>
              {d.description && <p className="sm mt-1 whitespace-pre-wrap">{d.description}</p>}
            </li>
          ))}
        </ol>
      )}

      {known > 0 && (
        <Checkbox
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          label={t('sign.damagesAck')}
          aria-required="true"
          className="items-start py-1 [&_input]:mt-1 [&_input]:!h-6 [&_input]:!w-6"
        />
      )}

      <div className="flex flex-col-reverse gap-2.5 border-t border-line-soft pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} className={BIG_BUTTON}>
          {t('common.zurueck')}
        </Button>
        <Button onClick={onNext} disabled={known > 0 && !acknowledged} className={BIG_BUTTON}>
          {t('sign.damagesNext')}
        </Button>
      </div>

      <PhotoLightbox
        photos={lightboxDamage?.photos ?? []}
        index={lightbox && lightboxDamage ? lightbox.index : null}
        label={lightboxDamage ? `${damageTypeLabel(lightboxDamage.type)}, ${lightboxDamage.zone}` : ''}
        onIndexChange={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
}
