'use client';

import { useState, useEffect } from 'react';
import { Star, Quote } from 'lucide-react';
import { api } from '@/lib/api';

interface Testimonial {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
}

const FALLBACK_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Marco S.',
    location: 'Zürich',
    text: 'Sehr unkompliziert und günstig. Hatte den VW Passat für 3 Monate – besser als jeder Leasingvertrag.',
    rating: 5,
    avatarUrl: null,
  },
  {
    id: '2',
    name: 'Laura M.',
    location: 'Basel',
    text: 'Freundlicher Service und das Auto war top gepflegt. Vollkasko inklusive ist ein grosser Pluspunkt.',
    rating: 5,
    avatarUrl: null,
  },
  {
    id: '3',
    name: 'Thomas K.',
    location: 'Bern',
    text: 'Perfekt für meine Überbrückungszeit. Der Langzeitrabatt hat sich wirklich gelohnt – klare Empfehlung!',
    rating: 5,
    avatarUrl: null,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
        />
      ))}
    </div>
  );
}

export interface SocialProofContent {
  label?: string;
  heading?: string;
  description?: string;
}

interface SocialProofProps {
  content?: SocialProofContent;
}

export function SocialProof({ content }: SocialProofProps) {
  const c = content || {};
  const label = c.label ?? 'Kundenstimmen';
  const heading = c.heading ?? 'Was unsere Kunden sagen';
  const description = c.description ?? 'Hunderte zufriedene Mieter vertrauen HoppDrive für günstige und flexible Mobilität.';
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK_TESTIMONIALS);

  useEffect(() => {
    api
      .getTestimonials()
      .then((data) => {
        if (data && data.length > 0) setTestimonials(data);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-brand-600 font-semibold text-sm uppercase tracking-wider">
            {label}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
            {heading}
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className="relative bg-neutral-50 rounded-2xl p-8 border border-neutral-100 hover:shadow-lg hover:border-brand-100 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-brand-100 mb-4" />
              <p className="text-neutral-700 leading-relaxed mb-6 text-sm">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                {t.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.avatarUrl}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  {t.location && (
                    <div className="text-xs text-neutral-400">{t.location}</div>
                  )}
                </div>
                <div className="ml-auto">
                  <StarRating rating={t.rating} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
