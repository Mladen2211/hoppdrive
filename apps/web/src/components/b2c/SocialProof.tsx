import Image from 'next/image';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { canOptimizeImage } from '@/lib/images';
import type { SocialProofContent } from '@/types/homepage-sections';

export type { SocialProofContent };

export interface Testimonial {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
}

function Stars({ rating, label }: { rating: number; label: (value: number) => string }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5 text-[#B8860B]" role="img" aria-label={label(value)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={20}
          aria-hidden="true"
          className={i < value ? 'fill-current' : 'text-line'}
        />
      ))}
    </div>
  );
}

interface SocialProofProps {
  content?: SocialProofContent;
  testimonials?: Testimonial[];
}

export function SocialProof({ content, testimonials: testimonialsProp }: SocialProofProps) {
  const t = useTranslations('social');
  const c = content || {};
  const label = c.label ?? t('label');
  const heading = c.heading ?? t('heading');

  // Shown while the CMS has no testimonials (texts in messages/<locale>.json -> social.fallback).
  const fallbackTestimonials: Testimonial[] = (['one', 'two', 'three'] as const).map((key, index) => ({
    id: String(index + 1),
    name: t(`fallback.${key}.name`),
    location: t(`fallback.${key}.location`),
    text: t(`fallback.${key}.text`),
    rating: 5,
    avatarUrl: null,
  }));
  const testimonials = testimonialsProp && testimonialsProp.length > 0 ? testimonialsProp : fallbackTestimonials;

  return (
    <section className="sec">
      <div className="wrap">
        <div className="sec-head">
          <p className="kick">{label}</p>
          <h2 className="h2">{heading}</h2>
          {c.description && <p className="lead">{c.description}</p>}
        </div>

        <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-1">
          {testimonials.slice(0, 3).map((item) => (
            <figure key={item.id} className="m-0 flex flex-col gap-4 rounded-18 border border-line bg-white p-7 max-md:p-[22px]">
              <Stars rating={item.rating} label={(value) => t('stars', { value })} />
              <blockquote className="m-0 text-lg leading-[1.55] max-md:text-[17px]">{item.text}</blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                {item.avatarUrl ? (
                  <Image
                    src={item.avatarUrl}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized={!canOptimizeImage(item.avatarUrl)}
                    className="h-11 w-11 flex-none rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink font-semibold text-white"
                    aria-hidden="true"
                  >
                    {item.name.charAt(0)}
                  </div>
                )}
                <div>
                  <b>{item.name}</b>
                  {item.location && <div className="text-sm leading-[1.45] text-graphite">{item.location}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
