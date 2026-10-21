'use client';

/**
 * Marketing (permission area "marketing"): Rabattcodes | Kunden | Kampagne | Verlauf, selected with
 * ?tab=codes|customers|campaign|history (default codes). The customer selection lives here, so it
 * survives switching between the tabs. ?tab=history&campaign=<id> opens a campaign.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, PageHeader, SkeletonRows, Tabs } from '@/components/ui';
import { useCan } from '@/hooks/usePermission';
import { CampaignTab } from './CampaignTab';
import { CustomersTab } from './CustomersTab';
import { DiscountCodesTab } from './DiscountCodesTab';
import { HistoryTab } from './HistoryTab';
import { MARKETING_TABS, type MarketingTab } from './shared';

export default function MarketingPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <MarketingView />
    </Suspense>
  );
}

function MarketingView() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = useCan('marketing', 'edit');
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const param = searchParams.get('tab');
  const tab: MarketingTab = (MARKETING_TABS as string[]).includes(param ?? '') ? (param as MarketingTab) : 'codes';
  const campaignId = searchParams.get('campaign');

  const go = useCallback(
    (next: MarketingTab, extra?: string) => {
      const query = next === 'codes' ? '' : `?tab=${next}${extra ? `&${extra}` : ''}`;
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [router, pathname],
  );

  const tabs = MARKETING_TABS.map((id) => ({
    id,
    label: t(`marketing.tabs.${id}`),
    href: id === 'codes' ? '/marketing' : `/marketing?tab=${id}`,
    count: id === 'customers' && selection.size > 0 ? selection.size : undefined,
  }));

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="max-md:hidden">
        <PageHeader title={t('marketing.title')} subtitle={t('marketing.subtitle')} tabs={<Tabs aria-label={t('marketing.title')} tabs={tabs} value={tab} />} tabsInline />
      </div>
      <div className="md:hidden">
        <h1 className="sr-only">{t('marketing.title')}</h1>
        <Tabs aria-label={t('marketing.title')} tabs={tabs} value={tab} className="w-full [&>a]:flex-1 [&>a]:justify-center [&>a]:px-2" />
      </div>

      {!canEdit && <Alert tone="info">{t('marketing.readOnly')}</Alert>}

      <div className="max-w-[1200px]">
        {tab === 'codes' && <DiscountCodesTab canEdit={canEdit} />}
        {tab === 'customers' && <CustomersTab canEdit={canEdit} selection={selection} setSelection={setSelection} onCompose={() => go('campaign')} />}
        {tab === 'campaign' && (
          <CampaignTab
            canEdit={canEdit}
            selection={selection}
            onPickCustomers={() => go('customers')}
            onSent={(id) => {
              setSelection(new Set());
              go('history', `campaign=${id}`);
            }}
          />
        )}
        {tab === 'history' && <HistoryTab openId={campaignId} onOpen={(id) => go('history', id ? `campaign=${id}` : undefined)} />}
      </div>
    </div>
  );
}
