/**
 * Crumbs: visible breadcrumb trail. Semantic <nav aria-label="Breadcrumb"> (translated) with an
 * ordered list; the last item is the current page (aria-current="page", not a link).
 * It only renders the visible trail: keep emitting the BreadcrumbList JSON-LD from the
 * page, with the same names and URLs, so the markup and the structured data agree.
 *
 *   <Crumbs items={[{ label: 'Startseite', href: '/' }, { label: 'Fahrzeuge', href: '/fahrzeuge' }, { label: 'Škoda Kodiaq' }]} />
 *
 * Props: items ({ label, href? }[]), className.
 */
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { Link } from '@/i18n/navigation';

export interface CrumbItem {
  label: string;
  href?: string;
}

export function Crumbs({ items, className }: { items: CrumbItem[]; className?: string }) {
  const t = useTranslations('common');
  return (
    <nav aria-label={t('breadcrumb')} className={className}>
      <ol className="crumbs">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="inline-flex items-center">
                {last || !item.href ? (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-ink' : undefined}>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="inline-flex items-center">
                  <ChevronRight size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
