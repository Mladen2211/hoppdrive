'use client';

/**
 * Einstellungen: Website | E-Mail | Dokumente | Gebühren | Benutzer und Rollen | Aktivitätsprotokoll,
 * selected with ?tab=website|email|documents|fees|users|activity (default website). The shell maps users and
 * activity to the "users" permission area (administrators only); the other tabs belong to "websiteSettings".
 */
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, SkeletonRows, StatusPill, Tabs } from '@/components/ui';
import { ActivityLog } from './ActivityLog';
import { DocumentsTab } from './DocumentsTab';
import { EmailTab } from './EmailTab';
import { FeesTab } from './FeesTab';
import { UsersTab } from './UsersTab';
import { WebsiteTab } from './WebsiteTab';
import { useTranslations } from 'next-intl';

type TabId = 'website' | 'email' | 'documents' | 'fees' | 'users' | 'activity';

const TAB_IDS: TabId[] = ['website', 'email', 'documents', 'fees', 'users', 'activity'];

// Short labels below 768 px so the three tabs fit one row on a phone.
function tabItems(t: (key: string) => string) {
  return [
    { id: 'website', label: t('common.website'), href: '/settings' },
    { id: 'email', label: t('settings.tabs.email'), href: '/settings?tab=email' },
    { id: 'documents', label: t('settings.tabs.documents'), href: '/settings?tab=documents' },
    { id: 'fees', label: t('settings.tabs.fees'), href: '/settings?tab=fees' },
    {
      id: 'users',
      label: (
        <>
          <span className="max-md:hidden">{t('settings.tabs.users')}</span>
          <span className="md:hidden">{t('settings.tabs.usersShort')}</span>
        </>
      ),
      href: '/settings?tab=users',
      badge: <StatusPill tone="vio" label={t('settings.tabs.new')} />,
    },
    {
      id: 'activity',
      label: (
        <>
          <span className="max-md:hidden">{t('settings.tabs.activity')}</span>
          <span className="md:hidden">{t('settings.tabs.activityShort')}</span>
        </>
      ),
      href: '/settings?tab=activity',
    },
  ];
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={5} />}>
      <SettingsView />
    </Suspense>
  );
}

function SettingsView() {
  const t = useTranslations();
  const param = useSearchParams()?.get('tab');
  const TAB_ITEMS = tabItems(t);
  const tab: TabId = (TAB_IDS as string[]).includes(param ?? '') ? (param as TabId) : 'website';

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="max-md:hidden">
        <PageHeader
          title={t('settings.einstellungen')}
          subtitle={t('settings.pageSubtitle')}
          tabs={<Tabs aria-label={t('settings.einstellungen')} tabs={TAB_ITEMS} value={tab} />}
          tabsInline
        />
      </div>
      <div className="md:hidden">
        <h1 className="sr-only">{t('settings.einstellungen')}</h1>
        <Tabs aria-label={t('settings.einstellungen')} tabs={TAB_ITEMS} value={tab} className="w-full max-md:flex-nowrap max-md:overflow-x-auto [&>a]:flex-none" />
      </div>

      {tab === 'website' && <WebsiteTab />}
      {tab === 'email' && <EmailTab />}
      {tab === 'documents' && <DocumentsTab />}
      {tab === 'fees' && <FeesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'activity' && <ActivityLog className="max-w-[820px]" />}
    </div>
  );
}
