'use client';

/**
 * "Vorschau" of the homepage editor: a browser-frame mock that renders a simplified version of the
 * selected section from the DRAFT content (not the published page). Hero shows heading + highlight,
 * description, both buttons and the image or the car placeholder; the other sections show their texts
 * with grey placeholders for the items that come from other pages (vehicles, reviews, questions).
 */
import Image from 'next/image';
import { Check, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui';
import { CarGlyph } from '@/components/content/CarGlyph';
import type { SectionContent } from './editors';
import { useTranslations } from 'next-intl';

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

interface Sizes {
  h: string;
  p: string;
  pad: string;
  grid: string;
  stack: boolean;
}

const SIZES: Record<PreviewDevice, Sizes> = {
  desktop: { h: 'text-[26px]', p: 'text-xs', pad: 'px-5 py-6', grid: 'grid-cols-3', stack: false },
  tablet: { h: 'text-[22px]', p: 'text-[11px]', pad: 'px-4 py-5', grid: 'grid-cols-2', stack: false },
  mobile: { h: 'text-[19px]', p: 'text-[11px]', pad: 'px-3.5 py-4', grid: 'grid-cols-1', stack: true },
};

const FRAME_WIDTH: Record<PreviewDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-full max-w-[340px]',
  mobile: 'w-full max-w-[232px]',
};

function Muted({ children }: { children: ReactNode }) {
  return <span className="italic text-cool">{children}</span>;
}

function Heading({ children, size }: { children: ReactNode; size: string }) {
  return <div className={cn('font-bold leading-[1.1] tracking-[-0.02em] text-ink', size)}>{children}</div>;
}

function SectionIntro({ content, sizes, withHeading = true }: { content: SectionContent; sizes: Sizes; withHeading?: boolean }) {
  const tt = useTranslations();
  const label = text(content.label);
  const heading = text(content.heading);
  const description = text(content.description);
  return (
    <div className="flex flex-col gap-2">
      {label && <div className="text-[10px] font-bold uppercase tracking-[.08em] text-ruby-fg">{label}</div>}
      {withHeading && <Heading size={cn(sizes.h, 'max-md:text-[22px]')}>{heading || <Muted>{tt('content.ueberschrift')}</Muted>}</Heading>}
      {description && <p className={cn('leading-[1.45] text-graphite', sizes.p)}>{description}</p>}
    </div>
  );
}

function Bars({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-2 rounded bg-paper" style={{ width: `${88 - i * 16}%` }} />
      ))}
    </div>
  );
}

function Hero({ content, sizes }: { content: SectionContent; sizes: Sizes }) {
  const tt = useTranslations();
  const heading = text(content.heading);
  const highlight = text(content.headingHighlight);
  const description = text(content.description);
  const primary = text(content.ctaPrimaryText);
  const secondary = text(content.ctaSecondaryText);
  const badge = text(content.badgeText);
  const image = text(content.backgroundImageUrl);
  const trust = arr<string>(content.trustItems).filter((t) => typeof t === 'string' && t.trim());

  return (
    <div className={cn('bg-gradient-to-b from-card to-row', sizes.pad)}>
      {badge && <div className="mb-2 text-[10px] font-bold uppercase tracking-[.08em] text-ruby-fg">{badge}</div>}
      <Heading size={sizes.h}>
        {heading || highlight ? (
          <>
            {heading} {highlight && <span className="text-ruby-fg">{highlight}</span>}
          </>
        ) : (
          <Muted>{tt('common.titel')}</Muted>
        )}
      </Heading>
      {description ? <p className={cn('mt-2.5 leading-[1.45] text-graphite', sizes.p)}>{description}</p> : null}
      <div className={cn('mt-4 flex gap-2', sizes.stack && 'flex-col items-start')}>
        {primary && <span className="rounded-lg bg-ruby px-3.5 py-[9px] text-xs font-semibold text-white">{primary}</span>}
        {secondary && <span className="rounded-lg border-[1.5px] border-ink px-3 py-2 text-xs font-semibold">{secondary}</span>}
      </div>
      {trust.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[11px] font-medium">
          {trust.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-center gap-1">
              <Check size={12} strokeWidth={3} className="flex-none text-ruby-fg" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-5 flex h-[120px] items-end justify-center overflow-hidden rounded-xl bg-tile">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- editor-supplied URL of any host; a plain preview is enough
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <CarGlyph className="mb-3 w-[78%]" />
        )}
      </div>
    </div>
  );
}

function Cards({ items, sizes, children }: { items: Record<string, string>[]; sizes: Sizes; children: (item: Record<string, string>, index: number) => ReactNode }) {
  return <div className={cn('mt-4 grid gap-2.5', sizes.grid)}>{items.map((item, i) => <div key={i}>{children(item, i)}</div>)}</div>;
}

function SectionBody({ sectionKey, content, sizes }: { sectionKey: string; content: SectionContent; sizes: Sizes }) {
  const tt = useTranslations();
  switch (sectionKey) {
    case 'hero':
      return <Hero content={content} sizes={sizes} />;

    case 'why_hoppdrive': {
      const items = arr<Record<string, string>>(content.items);
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <Cards items={items} sizes={sizes}>
            {(item) => (
              <div className="h-full rounded-xl border border-line-soft p-2.5">
                <span className="mb-1.5 block h-5 w-5 rounded-md bg-ruby-tint" aria-hidden="true" />
                <b className="text-xs">{text(item.title) || <Muted>{tt('common.titel')}</Muted>}</b>
                {text(item.description) && <p className="mt-1 text-[11px] leading-[1.4] text-graphite">{text(item.description)}</p>}
              </div>
            )}
          </Cards>
          {items.length === 0 && <Bars count={3} className="mt-4" />}
        </div>
      );
    }

    case 'how_it_works': {
      const steps = arr<Record<string, string>>(content.steps);
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ruby text-[11px] font-bold text-white">
                  {text(step.number) || i + 1}
                </span>
                <span className="min-w-0">
                  <b className="text-xs">{text(step.title) || <Muted>{tt('common.titel')}</Muted>}</b>
                  {text(step.time) && <span className="ml-1.5 rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-graphite">{text(step.time)}</span>}
                  {text(step.description) && <p className="mt-0.5 text-[11px] leading-[1.4] text-graphite">{text(step.description)}</p>}
                </span>
              </li>
            ))}
          </ol>
          {steps.length === 0 && <Bars count={3} className="mt-4" />}
        </div>
      );
    }

    case 'fleet':
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <div className={cn('mt-4 grid gap-2.5', sizes.grid)}>
            {[0, 1, 2].slice(0, sizes.stack ? 2 : 3).map((i) => (
              <div key={i} className="rounded-xl border border-line-soft p-2">
                <div className="flex h-14 items-center justify-center rounded-lg bg-tile">
                  <CarGlyph className="w-[70%]" />
                </div>
                <Bars count={2} className="mt-2" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'pricing': {
      const tiers = arr<Record<string, string>>(content.tiers);
      const included = arr<string>(content.includedItems).filter((t) => typeof t === 'string' && t.trim());
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <Cards items={tiers} sizes={sizes}>
            {(tier) => (
              <div className="h-full rounded-xl border border-line-soft p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-ruby-fg">{text(tier.number)}</span>
                  {text(tier.badge) && <span className="rounded-full bg-ruby-tint px-1.5 py-0.5 text-[9px] font-bold text-ruby-dark">{text(tier.badge)}</span>}
                </div>
                <b className="mt-0.5 block text-xs">{text(tier.title) || <Muted>{tt('common.titel')}</Muted>}</b>
                {text(tier.description) && <p className="mt-1 text-[11px] leading-[1.4] text-graphite">{text(tier.description)}</p>}
              </div>
            )}
          </Cards>
          {included.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-[11px]">
              {included.map((item, i) => (
                <li key={`${item}-${i}`} className="flex items-center gap-1.5">
                  <Check size={12} strokeWidth={3} className="flex-none text-ok" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    case 'social_proof':
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <div className={cn('mt-4 grid gap-2.5', sizes.grid)}>
            {[0, 1, 2].slice(0, sizes.stack ? 2 : 3).map((i) => (
              <div key={i} className="rounded-xl border border-line-soft p-2.5">
                <div className="mb-1.5 flex gap-0.5 text-star" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} size={11} fill="currentColor" />
                  ))}
                </div>
                <Bars count={3} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'faq':
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <div className="mt-4 flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-line-soft px-2.5 py-2">
                <span className="h-2 rounded bg-paper" style={{ width: `${70 - i * 12}%` }} aria-hidden="true" />
                <span className="text-xs text-cool" aria-hidden="true">
                  +
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'contact': {
      const cta = text(content.ctaText);
      const trustLine = text(content.trustLine);
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
          <div className={cn('mt-4 grid gap-2', sizes.stack ? 'grid-cols-1' : 'grid-cols-2')} aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-7 rounded-lg border border-line bg-card" />
            ))}
          </div>
          {cta && <span className="mt-3 inline-block rounded-lg bg-ruby px-3.5 py-[9px] text-xs font-semibold text-white">{cta}</span>}
          {trustLine && <p className="mt-2 text-[11px] text-graphite">{trustLine}</p>}
        </div>
      );
    }

    case 'map':
      return (
        <div className={sizes.pad}>
          <Heading size={sizes.h}>{text(content.heading) || <Muted>{tt('content.ueberschrift')}</Muted>}</Heading>
          <div className="relative mt-4 h-[120px] overflow-hidden rounded-xl border border-line bg-map" aria-hidden="true">
            <span className="absolute inset-y-0 left-1/2 w-0.5 bg-map-road" />
            <span className="absolute inset-x-0 top-[60%] h-[3px] bg-map-road" />
            <span className="absolute left-[46%] top-[30%] flex h-7 w-7 -rotate-45 items-center justify-center rounded-[50%_50%_50%_0] bg-ruby">
              <span className="h-2.5 w-2.5 rounded-full bg-card" />
            </span>
          </div>
        </div>
      );

    default:
      return (
        <div className={sizes.pad}>
          <SectionIntro content={content} sizes={sizes} />
        </div>
      );
  }
}

export interface HomepagePreviewProps {
  sectionKey: string | null;
  content: SectionContent;
  device: PreviewDevice;
  /** Section is switched off on the website: the mock says so. */
  hidden?: boolean;
}

export function HomepagePreview({ sectionKey, content, device, hidden = false }: HomepagePreviewProps) {
  const tt = useTranslations();
  const sizes = SIZES[device];
  const navItems = [tt('common.flotte'), tt('content.preise'), 'FAQ', tt('content.kontakt')];
  return (
    <div className="flex justify-center">
      <div
        // The mock shows the PUBLIC website, which is always light: pin the light palette inside the frame.
        data-theme="light"
        className={cn('overflow-hidden rounded-14 border border-line bg-card text-charcoal transition-[max-width] duration-300 motion-reduce:transition-none', FRAME_WIDTH[device])}
      >
        <div className="flex h-[34px] items-center gap-1.5 border-b border-line bg-paper px-3" aria-hidden="true">
          <i className="h-[9px] w-[9px] rounded-full bg-gray-soft" />
          <i className="h-[9px] w-[9px] rounded-full bg-gray-soft" />
          <i className="h-[9px] w-[9px] rounded-full bg-gray-soft" />
          <span className="sm mut ml-2">{tt('content.hoppdriveCh')}</span>
        </div>
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
          <Image src="/logos/logo-horizontal.svg" alt="HoppDrive" width={148} height={18} unoptimized className="h-[18px] w-auto" />
          {device === 'desktop' && (
            <span className="flex gap-3 text-[11px] font-semibold text-graphite">
              {navItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
          )}
        </div>
        {hidden && (
          <div className="border-b border-line-soft bg-warn-tint px-3 py-1.5 text-[11px] font-semibold text-warn-ink">
            {tt('content.dieserAbschnittIstAusgeblendet')}
          </div>
        )}
        <div className={cn(hidden && 'opacity-60')}>
          {sectionKey ? <SectionBody sectionKey={sectionKey} content={content} sizes={sizes} /> : <div className="p-8 text-center text-xs text-graphite">{tt('content.waehlenSieEinenAbschnitt')}</div>}
        </div>
        <div className="flex gap-2 border-t border-line-soft px-4 py-3.5" aria-hidden="true">
          <div className="h-[26px] flex-1 rounded-lg bg-paper" />
          <div className="h-[26px] flex-1 rounded-lg bg-paper" />
          <div className="h-[26px] flex-1 rounded-lg bg-paper" />
        </div>
      </div>
    </div>
  );
}
