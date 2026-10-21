/**
 * Vehicle card (design: `.vcard`). Hook-free on purpose, so it works in server
 * components (similar vehicles) and inside client lists (home fleet, filters).
 *
 *  - photo area with availability badge ("Verfügbar" / "Reserviert") or the
 *    silhouette + "Foto folgt"
 *  - spec line, "Ab CHF x / Tag" in Fira Sans Condensed and "30 Tage zusammen"
 *    computed from the real day tiers (not a flat percentage)
 *  - "Details" (link) and "Anfragen": a real link to
 *    `/?vehicle=<id>#contact-form`; where the contact form is on the same page
 *    the parent passes `onInquire`, which then handles the click itself.
 *
 * Texts come from the `vehicleCard` / `labels` namespaces; the links resolve to the
 * localised vehicle URL (/fahrzeuge/<slug>, /en/vehicles/<slug>, ...).
 */
import { useTranslations } from 'next-intl';
import { Badge, cn } from '@/components/ui';
import { VehicleMedia } from '@/components/b2c/VehicleMedia';
import { Link } from '@/i18n/navigation';
import { useFormatters } from '@/i18n/useFormatters';
import { monthTotal, type PricingTier } from '@/lib/pricing';
import { vehicleSlug } from '@/lib/seo';
import { isAvailableNow, specsList, vehicleName, type VehicleCardData } from '@/lib/vehicles';

export type { VehicleCardData };

interface VehicleCardProps {
  vehicle: VehicleCardData;
  tiers: PricingTier[];
  /** Same-page handler for "Anfragen" (home page); without it the button is a plain link. */
  onInquire?: (vehicle: VehicleCardData) => void;
  /** 'compact' = photo, name and price only ("Ähnliche Fahrzeuge"). */
  variant?: 'full' | 'compact';
  /** Eager-load the photo (first row above the fold). */
  priority?: boolean;
  className?: string;
}

const SIZES = '(min-width: 1600px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw';

export function VehicleCard({
  vehicle,
  tiers,
  onInquire,
  variant = 'full',
  priority = false,
  className,
}: VehicleCardProps) {
  const t = useTranslations('vehicleCard');
  const tLabels = useTranslations('labels');
  // The currency of the card data is the site currency (see toCardData).
  const f = useFormatters(vehicle.currency || undefined);
  const name = vehicleName(vehicle);
  const href = `/fahrzeuge/${vehicleSlug(vehicle)}`;
  const inquireHref = `/?vehicle=${vehicle.id}#contact-form`;
  const available = isAvailableNow(vehicle);
  const month = monthTotal(vehicle.basePricePerDay, tiers);

  return (
    <article className={cn('flex flex-col overflow-hidden rounded-18 border border-line bg-white', className)}>
      <div className="relative aspect-[4/3]">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0 block">
          <VehicleMedia
            vehicle={vehicle}
            src={vehicle.thumbnailUrl}
            alt={name}
            sizes={SIZES}
            priority={priority}
          />
        </Link>
        <Badge tone={available ? 'ok' : 'off'} className="absolute left-3 top-3">
          {available ? t('available') : t('reserved')}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-[18px] pb-5 pt-[18px]">
        <h3 className="text-xl font-bold leading-tight tracking-[-0.01em]">
          <Link href={href} className="text-ink no-underline hover:text-ruby">
            {name}
          </Link>
        </h3>

        {variant === 'full' && (
          <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-sm text-graphite">
            {specsList(vehicle.specs, tLabels).map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-sm text-graphite">{t('from')}</span>
          <b className="num text-[30px] font-bold leading-none text-ink">{f.money(vehicle.basePricePerDay, { decimals: 0 })}</b>
          <span className="text-sm text-graphite">{t('perDay')}</span>
        </div>

        {variant === 'full' && (
          <>
            {month !== null && month > 0 && (
              <p className="-mt-1.5 text-[13px] text-graphite">
                {t.rich('month', {
                  price: f.money(month, { decimals: 0 }),
                  num: (chunks) => <span className="num">{chunks}</span>,
                })}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <Link href={href} className="btn btn-o !px-3 !text-[15px]" aria-label={t('detailsAria', { name })}>
                {t('details')}
              </Link>
              <Link
                href={inquireHref}
                className="btn btn-p !px-3 !text-[15px]"
                aria-label={t('inquireAria', { name })}
                onClick={
                  onInquire
                    ? (event) => {
                        event.preventDefault();
                        onInquire(vehicle);
                      }
                    : undefined
                }
              >
                {t('inquire')}
              </Link>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
