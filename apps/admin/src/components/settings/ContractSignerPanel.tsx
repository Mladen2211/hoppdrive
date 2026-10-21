'use client';

/**
 * Einstellungen > Dokumente > Unterzeichner. Which administrator signs contracts for the company
 * (setting `contract.signerAdminId`; "Handelnder Admin" = whoever finalises the contract). The stored
 * signature of that admin is drawn into every contract, so an admin without a signature blocks
 * finalising (422 company_signature_missing).
 *
 * Whether an admin has a stored signature comes from the users list (`AdminUserDto.hasSignature`).
 */
import { CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminUserDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Select, Skeleton, useToast } from '@/components/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { tr } from '@/i18n/active';
import { SettingsPanel } from './SettingsPanel';

type SignatureState = 'unknown' | 'yes' | 'no';

export function ContractSignerPanel() {
  const t = useTranslations();
  const { token, admin } = useAdminAuth();
  const { toast } = useToast();
  const canEdit = useCan('websiteSettings', 'edit');

  const [admins, setAdmins] = useState<AdminUserDto[] | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [selected, setSelected] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, setting] = await Promise.all([api.getAdmins(), api.getSetting('contract').catch(() => null)]);
      setAdmins(list.filter((a) => !a.pending));
      const id = typeof setting?.signerAdminId === 'string' ? setting.signerAdminId : '';
      setSaved(id);
      setSelected(id);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, tr('documents.signer.loadFailed')));
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function save() {
    setSaving(true);
    try {
      await api.updateSetting('contract', { signerAdminId: selected || null });
      setSaved(selected);
      toast.success(tr('documents.signer.saved'), tr('documents.signer.savedText'));
    } catch (err) {
      toast.error(tr('documents.signer.saveFailed'), errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const dirty = admins !== null && selected !== saved;
  const selectedAdmin = admins?.find((a) => a.id === selected) ?? null;
  const effectiveId = selected || admin?.id || '';
  const isOwn = effectiveId === admin?.id;

  // Signature of the signer selected right now (the acting admin when "Handelnder Admin" is chosen).
  const effectiveAdmin = admins?.find((a) => a.id === effectiveId) ?? null;
  const state: SignatureState = effectiveAdmin ? (effectiveAdmin.hasSignature ? 'yes' : 'no') : 'unknown';

  const signerName = selected ? (selectedAdmin?.name ?? '–') : (admin?.name ?? '–');

  return (
    <SettingsPanel
      id="doc-signer-h"
      title={t('documents.signer.title')}
      subtitle={t('documents.signer.subtitle')}
      actions={
        canEdit ? (
          <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
            {t('common.speichern')}
          </Button>
        ) : undefined
      }
    >
      {loadError && (
        <Alert
          tone="err"
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}
      {admins === null && !loadError ? (
        <Skeleton className="h-11 w-full max-w-[420px]" rounded={10} />
      ) : admins ? (
        <>
          <Field label={t('documents.signer.label')} hint={t('documents.signer.hint')} className="max-w-[420px]">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!canEdit}>
              <option value="">{t('documents.signer.acting')}</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.id === admin?.id ? ` (${t('documents.signer.you')})` : ''} · {t(`roles.${a.role}`)}
                </option>
              ))}
            </Select>
          </Field>

          <div aria-live="polite">
            {state === 'yes' && (
              <p className="flex items-center gap-2 text-sm">
                <CircleCheck size={18} aria-hidden="true" className="flex-none text-ok" />
                <span>{t('documents.signer.hasSignature', { name: signerName })}</span>
              </p>
            )}
            {state === 'unknown' && selected && !isOwn && <p className="sm mut">{t('documents.signer.cannotTell', { name: signerName })}</p>}
          </div>

          {state === 'no' && (
            <Alert
              tone="warn"
              icon={<TriangleAlert size={20} />}
              title={t('documents.signer.missingTitle', { name: signerName })}
              action={
                isOwn ? (
                  <Button href="/profile?tab=signature" variant="outline" size="sm">
                    {t('documents.signer.addSignature')}
                  </Button>
                ) : undefined
              }
            >
              {isOwn ? t('documents.signer.missingOwn') : t('documents.signer.missingOther', { name: signerName })}
            </Alert>
          )}
          {!selected && <Alert tone="info">{t('documents.signer.actingNote')}</Alert>}
          <p className="sm mut">
            {t.rich('documents.signer.profileLink', {
              link: (chunks) => (
                <Link href="/profile?tab=signature" className="font-semibold text-ruby-fg underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </>
      ) : null}
    </SettingsPanel>
  );
}
