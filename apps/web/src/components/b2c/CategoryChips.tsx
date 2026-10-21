import { useTranslations } from 'next-intl';
import { Chip, cn } from '@/components/ui';
import { CATEGORY_SLUGS, CATEGORY_TYPES, categoryLabel } from '@/lib/seo';
import type { VehicleType } from '@hoppdrive/shared';

/**
 * Category filter chips as REAL links (`/fahrzeuge`, `/mieten/<kategorie>`), so
 * the category landing pages stay crawlable (SEO). The current category is
 * marked with aria-current. `scroll` makes the row one horizontally scrolling
 * line (mobile sticky bar).
 */
interface CategoryChipsProps {
  vehicles: { type: string }[];
  /** Current category type, or 'all' on /fahrzeuge. */
  current: VehicleType | 'all';
  scroll?: boolean;
  className?: string;
}

export function CategoryChips({ vehicles, current, scroll = false, className }: CategoryChipsProps) {
  const t = useTranslations('categoryChips');
  const tCategory = useTranslations('category');
  const categories = CATEGORY_TYPES
    .map((type) => ({ type, count: vehicles.filter((v) => v.type === type).length }))
    .filter((entry) => entry.count > 0);

  if (categories.length === 0) return null;

  return (
    <nav
      aria-label={t('aria')}
      className={cn(
        'chips',
        scroll && 'max-md:-mr-5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1 max-md:pr-5',
        className,
      )}
    >
      <Chip href="/fahrzeuge" pressed={current === 'all'} count={vehicles.length}>
        {t('all')}
      </Chip>
      {categories.map(({ type, count }) => (
        <Chip key={type} href={`/mieten/${CATEGORY_SLUGS[type]}`} pressed={current === type} count={count}>
          {categoryLabel(type, tCategory)}
        </Chip>
      ))}
    </nav>
  );
}
