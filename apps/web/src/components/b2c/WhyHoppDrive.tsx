import { DollarSign, Headset, ShieldCheck, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormatters } from '@/i18n/useFormatters';
import type { WhyHoppDriveContent } from '@/types/homepage-sections';

const ICONS = [DollarSign, ShieldCheck, Wrench, Headset];

export type { WhyHoppDriveContent };

interface WhyHoppDriveProps {
  content?: WhyHoppDriveContent;
  /** Lowest daily price of the live fleet, used in the default first tile (none: neutral copy). */
  minPrice?: number | null;
  /** ISO code of the site currency. */
  currency?: string;
}

export function WhyHoppDrive({ content, minPrice = null, currency }: WhyHoppDriveProps) {
  const t = useTranslations('why');
  const f = useFormatters(currency);
  const c = content || {};
  const label = c.label ?? t('label');
  const heading = c.heading ?? t('heading');
  const defaultItems = [
    {
      title: t('priceTitle'),
      description:
        minPrice !== null ? t('priceText', { price: f.money(minPrice, { decimals: 0 }) }) : t('priceTextNoPrice'),
    },
    {
      title: t('coverTitle'),
      description: t('coverText'),
    },
    {
      title: t('maintenanceTitle'),
      description: t('maintenanceText'),
    },
    {
      title: t('serviceTitle'),
      description: t('serviceText'),
    },
  ];
  const items = c.items?.length ? c.items : defaultItems;

  return (
    <section className="sec bg-white">
      <div className="wrap">
        <div className="sec-head">
          <p className="kick">{label}</p>
          <h2 className="h2">{heading}</h2>
          {c.description && <p className="lead">{c.description}</p>}
        </div>

        <div className="grid grid-cols-4 gap-8 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-6">
          {items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <div key={`${item.title}-${index}`} className="flex flex-col gap-3 max-md:flex-row max-md:items-start max-md:gap-4">
                <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-14 bg-ruby-tint text-ruby">
                  <Icon size={26} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-3 max-md:gap-1">
                  <h3 className="h3">{item.title}</h3>
                  <p className="mut">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
