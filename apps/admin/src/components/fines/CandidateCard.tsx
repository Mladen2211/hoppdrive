'use client';

/**
 * A booking that could have been driving the vehicle when the fine happened: renter, contact, period
 * with times, driver address / birth date / licence and how it matched. `actions` sit at the bottom.
 */
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FineLookupCandidateDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { StatusPill, cn } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { fmtZurichPeriod } from '@/lib/zurich';

function address(c: FineLookupCandidateDto): string {
  const city = [c.driverZip, c.driverCity].filter(Boolean).join(' ');
  return [c.driverStreet, city, c.driverCountry].filter((part) => part && String(part).trim()).join(', ');
}

export function CandidateCard({
  candidate: c,
  actions,
  highlighted,
  className,
}: {
  candidate: FineLookupCandidateDto;
  actions?: ReactNode;
  highlighted?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const addr = address(c);
  const licence = [c.driverLicenseNumber, c.driverLicenseCountry ? `(${c.driverLicenseCountry})` : ''].filter(Boolean).join(' ');
  const none = <span className="mut">–</span>;

  return (
    <article className={cn('flex flex-col gap-3 rounded-xl border p-4', highlighted ? 'border-ruby border-[1.5px]' : 'border-line', className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-base font-semibold">{c.customerName}</h3>
          <Link href={`/contracts?id=${c.bookingId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ruby-fg underline">
            {t('fines.openBooking')}
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill
            tone={c.matchType === 'exact' ? 'green' : 'amber'}
            label={c.matchType === 'exact' ? t('fines.match.exact') : t('fines.match.whole_day')}
          />
          {c.status === 'cancelled' && <StatusPill tone="red" label={t('status.booking.cancelled')} />}
        </div>
      </header>
      <p className="sm mut -mt-1.5">{c.matchType === 'exact' ? t('fines.match.exactHint') : t('fines.match.wholeDayHint')}</p>

      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm max-sm:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="mut">{t('fines.cand.period')}</dt>
        <dd className="num break-words">
          {fmtZurichPeriod(c)}
          {!c.hasTimes && <span className="mut"> · {t('fines.cand.wholeDays')}</span>}
        </dd>
        <dt className="mut">{t('common.eMail')}</dt>
        <dd className="break-all">{c.customerEmail || none}</dd>
        <dt className="mut">{t('common.telefon')}</dt>
        <dd>{c.customerPhone || none}</dd>
        <dt className="mut">{t('fines.cand.address')}</dt>
        <dd className="break-words">{addr || none}</dd>
        <dt className="mut">{t('driver.birthDate')}</dt>
        <dd className="num">{c.driverBirthDate ? fmtDate(c.driverBirthDate) : none}</dd>
        <dt className="mut">{t('driver.licenseNumber')}</dt>
        <dd className="break-words">{licence || none}</dd>
      </dl>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
