'use client';

/** Small pieces shared by the steps of the signing page. */
import type { ContractPreviewDto } from '@hoppdrive/shared';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { CarGlyph } from '@/components/content/CarGlyph';
import { contractNumber } from '@/lib/booking';
import { fmtDate, fmtMoney } from '@/lib/format';
import { formatPlate } from '@/lib/plate';
import { daysForRange } from '@/lib/pricing';
import { fmtZurichPeriod } from '@/lib/zurich';

export function VehicleCard({ preview, thumbnail }: { preview: ContractPreviewDto; thumbnail: string | null }) {
  const t = useTranslations();
  const { booking } = preview;
  const days = daysForRange(booking.startDate, booking.endDate);
  return (
    <div className="flex items-center gap-3.5 rounded-14 border-[1.5px] border-line p-3.5">
      <div className="relative flex h-16 w-24 flex-none items-center justify-center overflow-hidden rounded-10 bg-tile">
        {thumbnail ? <Image src={thumbnail} alt="" fill sizes="96px" unoptimized className="object-cover" /> : <CarGlyph className="w-[88%]" />}
      </div>
      <div className="min-w-0">
        <b className="block text-[17px] font-semibold leading-tight">
          {booking.vehicleBrand} {booking.vehicleModel}
        </b>
        <div className="num mut mt-0.5 text-[15px]">
          {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}
          {days > 0 && ` · ${days} ${t('sign.tagN', { count: days })}`}
        </div>
      </div>
    </div>
  );
}

export function Summary({ preview }: { preview: ContractPreviewDto }) {
  const t = useTranslations();
  const { booking } = preview;
  const signer = preview.companySigner;
  return (
    <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1.5 max-sm:grid-cols-[100px_minmax(0,1fr)]">
      <dt className="mut">{t('sign.mieterIn')}</dt>
      <dd className="m-0 break-words">{booking.customerName}</dd>
      <dt className="mut">{t('common.vertrag')}</dt>
      <dd className="m-0">{t('sign.nr', { contractNumber: contractNumber(booking.id) })}</dd>
      <dt className="mut">{t('sign.zeitraum')}</dt>
      <dd className="num m-0">{fmtZurichPeriod(booking)}</dd>
      {booking.licensePlate && (
        <>
          <dt className="mut">{t('sign.kontrollschild')}</dt>
          <dd className="num m-0">{formatPlate(booking.licensePlate)}</dd>
        </>
      )}
      {booking.locationName && (
        <>
          <dt className="mut">{t('sign.standort')}</dt>
          <dd className="m-0">{booking.locationName}</dd>
        </>
      )}
      <dt className="mut">{t('sign.gesamtpreis')}</dt>
      <dd className="num m-0 text-xl font-bold">{fmtMoney(booking.totalPrice, { currency: booking.currency || 'CHF' })}</dd>
      {signer.name && signer.hasSignature && (
        <>
          <dt className="mut">{t('sign.vermieter')}</dt>
          <dd className="m-0">{t('sign.signedByLandlord', { name: signer.name })}</dd>
        </>
      )}
    </dl>
  );
}
