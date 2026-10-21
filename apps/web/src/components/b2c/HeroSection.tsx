import Image from 'next/image';
import { Check, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HeroCarousel, type HeroSlide } from '@/components/b2c/HeroCarousel';
import { QuickRequestBar } from '@/components/b2c/QuickRequestBar';
import { Button, CarSilhouette, SwissCross, cn } from '@/components/ui';
import { useFormatters } from '@/i18n/useFormatters';
import { canOptimizeImage } from '@/lib/images';
import type { HeroContent } from '@/types/homepage-sections';

export type { HeroContent, HeroSlide };

interface HeroSectionProps {
  content?: HeroContent;
  /** Lowest daily price of the live fleet (null when there are no vehicles: the price tag is hidden). */
  minPrice?: number | null;
  /** Highest discount of the day tiers in percent ("Bis 40 % Langzeitrabatt"). */
  maxDiscount?: number;
  /** Render the quick-request bar (needs vehicles). */
  showQuickBar?: boolean;
  /** One slide per listed vehicle (main image or silhouette). Without vehicles the CMS image / silhouette is shown. */
  slides?: HeroSlide[];
  /** ISO code of the site currency (`currency` setting). */
  currency?: string;
}

// The ruby stage panel (carousel and fallback share it).
const STAGE =
  'relative flex min-h-[470px] items-end justify-center overflow-hidden rounded-28 bg-ruby max-lg:min-h-[360px] max-md:min-h-[250px] max-md:rounded-20 3xl:min-h-[560px]';

export function HeroSection({
  content,
  minPrice = null,
  maxDiscount = 40,
  showQuickBar = true,
  slides = [],
  currency,
}: HeroSectionProps) {
  const t = useTranslations('hero');
  const f = useFormatters(currency);
  const c = content || {};
  const hasPrice = minPrice !== null;
  const priceText = hasPrice ? f.money(minPrice, { decimals: 0 }) : '';
  const badgeText = c.badgeText ?? t('badge');
  const heading = c.heading ?? t('heading');
  const headingHighlight = c.headingHighlight ?? t('headingHighlight');
  const description = c.description ?? (hasPrice ? t('description', { price: priceText }) : t('descriptionNoPrice'));
  const ctaPrimaryText = c.ctaPrimaryText ?? t('ctaPrimary');
  const ctaPrimaryLink = c.ctaPrimaryLink ?? '#fleet';
  const ctaSecondaryText = c.ctaSecondaryText ?? t('ctaSecondary');
  const ctaSecondaryLink = c.ctaSecondaryLink ?? '#contact-form';
  const stageImage = c.backgroundImageUrl?.trim() || null;
  const trustItems =
    c.trustItems ??
    [t('trustCover'), t('trustFlexible'), ...(maxDiscount > 0 ? [t('trustDiscount', { percent: maxDiscount })] : [])];

  // Swiss cross and the live "Ab CHF" tag sit on top of the stage (photo or silhouette). Above the
  // carousel slides they need a z-index; on the plain stage the silhouette keeps painting over them.
  const layer = slides.length > 0 ? 'z-[2]' : undefined;
  const decoration = (
    <>
      <SwissCross
        variant="cross"
        className={cn(
          'pointer-events-none absolute -right-[70px] -top-[70px] h-[330px] w-[330px] text-white opacity-[.13] max-md:-right-[50px] max-md:-top-[50px] max-md:h-[210px] max-md:w-[210px] 3xl:-right-[90px] 3xl:-top-[90px] 3xl:h-[420px] 3xl:w-[420px]',
          layer,
        )}
      />
      {hasPrice && (
        <div
          className={cn(
            'pointer-events-none absolute left-6 top-6 flex flex-col rounded-[14px] bg-white px-[18px] py-3 max-md:left-3.5 max-md:top-3.5 max-md:px-3 max-md:py-2 3xl:left-8 3xl:top-8',
            layer,
          )}
        >
          <span className="text-[13px] text-graphite">{t('from')}</span>
          <b className="num text-[38px] font-bold leading-none text-ruby max-md:text-[26px]">{priceText}</b>
          <span className="text-[13px] text-graphite">
            {t('perDay')}
            <span className="max-md:hidden">{t('coverShort')}</span>
          </span>
        </div>
      )}
    </>
  );

  return (
    <header className="pt-14 max-md:pt-7">
      <div className="wrap">
        <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] items-center gap-14 max-lg:grid-cols-1 max-lg:gap-8 3xl:grid-cols-2 3xl:gap-20">
          <div className="flex flex-col gap-[26px] max-md:gap-5 3xl:gap-[30px]">
            <p className="kick">{badgeText}</p>
            <h1 className="disp 3xl:text-[84px]">
              {heading} <span>{headingHighlight}</span>
            </h1>
            <p className="lead 3xl:max-w-[52ch] 3xl:text-[22px]">{description}</p>
            <div className="flex flex-wrap gap-3.5 max-md:flex-col max-md:[&>*]:w-full">
              <Button href={ctaPrimaryLink} size="lg" iconRight={<ChevronRight size={20} aria-hidden="true" />}>
                {ctaPrimaryText}
              </Button>
              <Button href={ctaSecondaryLink} variant="outline" size="lg">
                {ctaSecondaryText}
              </Button>
            </div>
            {trustItems.length > 0 && (
              <ul className="flex flex-wrap gap-x-7 gap-y-2 pt-1.5 max-md:flex-col max-md:gap-1.5">
                {trustItems.map((text) => (
                  <li key={text} className="flex items-center gap-2.5 font-medium">
                    <Check size={22} strokeWidth={2.4} className="flex-none text-ruby" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {slides.length > 0 ? (
            // Stage 1: carousel of the vehicles' main images (the fleet is the best hero picture).
            <HeroCarousel slides={slides} stageClassName={STAGE}>
              {decoration}
            </HeroCarousel>
          ) : (
            // Stage 2/3: the CMS hero image, or the car silhouette on the ruby panel.
            <div className={STAGE}>
              {stageImage && (
                <Image
                  src={stageImage}
                  alt={t('imageAlt')}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  unoptimized={!canOptimizeImage(stageImage)}
                  className="object-cover"
                />
              )}
              {decoration}
              {!stageImage && (
                // The road line sits at the wheels' ground line (10.8 % of the silhouette's height).
                <div className="relative mb-8 w-[92%] max-md:mb-3 max-md:w-[96%] 3xl:mb-10 3xl:w-[86%]">
                  <span
                    aria-hidden="true"
                    className="absolute -inset-x-[200%] bottom-[10.8%] h-[3px] bg-white/40"
                  />
                  <CarSilhouette variant="estate" className="relative w-full" />
                </div>
              )}
            </div>
          )}
        </div>

        {showQuickBar && <QuickRequestBar />}
      </div>
    </header>
  );
}
