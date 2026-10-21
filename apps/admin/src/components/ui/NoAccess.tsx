/**
 * NoAccess: the "Keine Berechtigung" state shown when a role has no access
 * to an area (lock icon, title, text naming the role, back-to-overview button).
 *
 *   <NoAccess roleName="Redaktion" />
 *   <NoAccess roleName="Lesen" description="Mit der Rolle Lesen können Sie Daten ansehen, aber nicht ändern." />
 *
 * Props:
 *  - roleName: the user's role label (e.g. "Redaktion"); shown in bold
 *  - description: replaces the default sentence
 *  - homeHref: target of "Zur Übersicht" (default "/")
 *  - onRequestAccess / requestHref: when given, adds a secondary "Zugriff anfragen" button
 *    (not rendered by default: there is no backend flow for it)
 *  - className
 */
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { useTranslations } from 'next-intl';

export interface NoAccessProps {
  roleName?: string;
  description?: ReactNode;
  homeHref?: string;
  onRequestAccess?: () => void;
  requestHref?: string;
  className?: string;
}

export function NoAccess({
  roleName,
  description,
  homeHref = '/',
  onRequestAccess,
  requestHref,
  className,
}: NoAccessProps) {
  const t = useTranslations();
  const text =
    description ??
    (roleName ? (
      <>{t.rich('ui.noAccessForRole', { role: roleName, b: (chunks) => <b>{chunks}</b> })}</>
    ) : (
      t('ui.fuerDiesenBereichFehlt')
    ));

  return (
    <EmptyState
      tone="neutral"
      icon={<Lock size={32} />}
      title={t('ui.dieserBereichIstNicht')}
      text={text}
      className={className}
      actions={
        <>
          <Button href={homeHref}>{t('ui.zurUebersicht')}</Button>
          {requestHref ? (
            <Button href={requestHref} variant="ghost">
              {t('ui.zugriffAnfragen')}
            </Button>
          ) : onRequestAccess ? (
            <Button variant="ghost" onClick={onRequestAccess}>
              {t('ui.zugriffAnfragen')}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
