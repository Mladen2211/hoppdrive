/** Star rating as in the Content-Lists board: filled stars in amber, the rest grey. Announced as "4 von 5 Sternen". */
import { cn } from '@/components/ui';
import { useTranslations } from 'next-intl';

export function Stars({ rating, className }: { rating: number; className?: string }) {
  const t = useTranslations();
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      role="img"
      aria-label={t('content.von5Sternen', { value })}
      className={cn('whitespace-nowrap text-[15px] tracking-[1px] text-star', className)}
    >
      {'★'.repeat(value)}
      <span className="text-star-off">{'★'.repeat(5 - value)}</span>
    </span>
  );
}
