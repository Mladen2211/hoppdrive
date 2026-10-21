import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { Translate } from '@/i18n/types';
import { useFormatters } from '@/i18n/useFormatters';
import { DEFAULT_TIERS, type PricingTier } from '@/lib/pricing';
import type { FaqContent } from '@/types/homepage-sections';

export type { FaqContent };

export interface FaqItemData {
  id: string;
  question: string;
  answer: string;
  category: string;
}

/**
 * " Bei längerer Mietdauer profitieren Sie von automatischen Rabatten: 20% ab 8 Tagen und bis zu 40% ab 31 Tagen.",
 * built from the live day tiers. `t` = translator of the `faq` namespace.
 */
function discountSentence(tiers: PricingTier[], t: Translate, list: (items: string[]) => string): string {
  const discounted = tiers.filter((tier) => tier.discountPercent > 0).sort((a, b) => a.fromDay - b.fromDay);
  if (discounted.length === 0) return '';
  const parts = discounted.map((tier, i) =>
    t(i === discounted.length - 1 && discounted.length > 1 ? 'discountPartMax' : 'discountPart', {
      percent: tier.discountPercent,
      days: tier.fromDay,
    }),
  );
  return t('discountSentence', { parts: list(parts) });
}

export interface FaqSectionProps {
  content?: FaqContent;
  items?: FaqItemData[];
  minPrice?: number | null;
  /** Live day tiers, used for the fallback answer about discounts. */
  tiers?: PricingTier[];
  /** ISO code of the site currency. */
  currency?: string;
}

/**
 * FAQ as native <details> (keyboard and screen-reader support for free, no
 * height limit that could clip long answers). The first question is open.
 */
export function FaqSection({ content, items, minPrice = null, tiers = DEFAULT_TIERS, currency }: FaqSectionProps) {
  const t = useTranslations('faq');
  const f = useFormatters(currency);
  const c = content || {};
  const label = c.label ?? t('label');
  const heading = c.heading ?? t('heading');

  // Fallback Q&A while the CMS has none (texts in messages/<locale>.json -> faq.fallback).
  const fallbackItems: FaqItemData[] = [
    {
      id: '1',
      question: t('fallback.priceQuestion'),
      answer:
        minPrice !== null
          ? t('fallback.priceAnswer', {
              price: f.money(minPrice, { decimals: 0 }),
              discounts: discountSentence(tiers, t, f.list),
            })
          : t('fallback.priceAnswerNoPrice', { discounts: discountSentence(tiers, t, f.list) }),
      category: 'pricing',
    },
    { id: '2', question: t('fallback.insuranceQuestion'), answer: t('fallback.insuranceAnswer'), category: 'insurance' },
    { id: '3', question: t('fallback.durationQuestion'), answer: t('fallback.durationAnswer'), category: 'rental' },
    { id: '4', question: t('fallback.documentsQuestion'), answer: t('fallback.documentsAnswer'), category: 'documents' },
    { id: '5', question: t('fallback.extendQuestion'), answer: t('fallback.extendAnswer'), category: 'rental' },
    { id: '6', question: t('fallback.pickupQuestion'), answer: t('fallback.pickupAnswer'), category: 'pickup' },
  ];
  const faqItems = items && items.length > 0 ? items : fallbackItems;

  return (
    <section id="faq" className="sec bg-white">
      <div className="wrap">
        <div className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-x-16 gap-y-5 lg:grid-rows-[auto_1fr] max-lg:grid-cols-1 max-lg:gap-7">
          <div className="flex flex-col gap-3.5 self-start lg:col-start-1 lg:row-start-1">
            <p className="kick">{label}</p>
            <h2 className="h2">{heading}</h2>
            {c.description && <p className="lead">{c.description}</p>}
          </div>

          <div className="border-t border-line lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {faqItems.map((item, index) => (
              <details key={item.id} open={index === 0} className="group border-b border-line">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown
                    size={22}
                    strokeWidth={2.2}
                    aria-hidden="true"
                    className="flex-none transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-[62ch] whitespace-pre-line pb-[22px] text-graphite">{item.answer}</p>
              </details>
            ))}
          </div>

          <div className="flex flex-col gap-3 self-start rounded-18 border border-line bg-white p-6 lg:col-start-1 lg:row-start-2">
            <b>{t('askTitle')}</b>
            <p className="mut">{t('askText')}</p>
            <Button href="#contact-form" variant="outline" className="max-lg:w-full lg:self-start">
              {t('askCta')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
