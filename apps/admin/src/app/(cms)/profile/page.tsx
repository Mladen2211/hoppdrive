'use client';

/**
 * Konto (/profile) as four tabs, selected with ?tab=profile|security|signature|appearance:
 *  - Profil        name, e-mail, phone
 *  - Sicherheit    password change (rules + strength meter)
 *  - Unterschrift  the company signature that is printed on every contract: draw it or upload a PNG / JPG
 *  - Darstellung   language (5) and theme (light / dark / system); applied immediately and saved on the account
 * All inputs live in ProfileView, so switching tabs keeps what was typed.
 */
import { Check, ImageUp, Monitor, Moon, PenTool, RotateCcw, Sun, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { evaluatePassword } from '@hoppdrive/shared';
import type SignatureCanvasType from 'react-signature-canvas';
import {
  Alert,
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  SkeletonRows,
  StatusPill,
  Tabs,
  cn,
  useToast,
} from '@/components/ui';
import { PasswordField } from '@/components/content/auth/PasswordField';
import { PasswordGuide, ruleLabel } from '@/components/content/auth/PasswordGuide';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { fieldMessages, isSamePasswordRejected } from '@/lib/auth-errors';
import { errorText } from '@/lib/errors';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/I18nProvider';
import { useTheme } from '@/components/shell/ThemeProvider';
import type { ThemePreference } from '@/lib/theme';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

let SignatureCanvas: typeof import('react-signature-canvas').default | null = null;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SignatureCanvas = require('react-signature-canvas').default;
}

type TabId = 'profile' | 'security' | 'signature' | 'appearance';
const TAB_IDS: TabId[] = ['profile', 'security', 'signature', 'appearance'];
const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;

export default function ProfilePage() {
  return (
    <Suspense fallback={<SkeletonRows rows={4} />}>
      <ProfileView />
    </Suspense>
  );
}

function ProfileView() {
  const t = useTranslations();
  const { token, login, role } = useAdminAuth();
  const { toast } = useToast();
  const param = useSearchParams()?.get('tab');
  const tab: TabId = TAB_IDS.includes(param as TabId) ? (param as TabId) : 'profile';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Signature
  const [existingSignature, setExistingSignature] = useState<string | null>(null);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const sigRef = useRef<SignatureCanvasType | null>(null);
  const [sigIsEmpty, setSigIsEmpty] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [sameRejected, setSameRejected] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    api
      .getProfile()
      .then((data) => {
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        if (data.signatureData) setExistingSignature(data.signatureData);
      })
      .catch(() => setError(tr('profile.profilKonnteNichtGeladen')))
      .finally(() => setLoading(false));
  }, [token]);

  // Preview of the picked image; the object URL is released when it changes.
  useEffect(() => {
    if (!uploadFile) {
      setUploadPreview(null);
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  // The error banner belongs to the tab it came from.
  useEffect(() => {
    setError('');
  }, [tab]);

  /** Stores the profile response in the session (keeps the language / theme of the account). */
  function storeAdmin(updated: any) {
    login(token ?? sessionStorage.getItem('accessToken') ?? '', {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      mustResetPassword: updated.mustResetPassword,
      role: updated.role,
      locale: updated.locale,
      theme: updated.theme,
    });
  }

  async function saveProfile(extra?: { currentPassword: string; newPassword: string }) {
    const payload: Record<string, string> = { firstName, lastName, email, phone };
    if (extra) {
      payload.currentPassword = extra.currentPassword;
      payload.newPassword = extra.newPassword;
    }
    const updated = await api.updateProfile(payload);
    storeAdmin(updated);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await saveProfile();
      toast.success(tr('profile.profilGespeichert'), tr('profile.ihreAenderungenWurdenUebernomm'));
    } catch (err) {
      setError(errorText(err, tr('profile.fehlerBeimSpeichern')));
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSameRejected(false);

    // Validate the password change (match, rules, current password required)
    const next: typeof fieldErrors = {};
    if (!newPassword) next.next = tr('profile.enterNewPassword');
    else {
      if (newPassword !== confirmPassword) next.confirm = tr('profile.passwoerterStimmenNichtUeberei');
      const evaluation = evaluatePassword(newPassword, currentPassword);
      if (!evaluation.valid) {
        const failed = evaluation.rules.filter((r) => !r.passed).map((r) => ruleLabel(r.id));
        next.next = tr('profile.dasNeuePasswortErfuellt', { join: failed.join(', ') });
      }
    }
    if (!currentPassword) next.current = tr('profile.aktuellesPasswortErforderlich');
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    setSaving(true);
    try {
      await saveProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(tr('profile.passwordChanged'), tr('profile.ihreAenderungenWurdenUebernomm'));
    } catch (err) {
      if (isSamePasswordRejected(err, 'newPassword')) {
        setSameRejected(true);
        setFieldErrors({ next: tr('profile.dasNeuePasswortDarf') });
      } else {
        const messages = fieldMessages(err, 'newPassword');
        if (messages.length > 0) setFieldErrors({ next: messages.join(' ') });
        else setError(errorText(err, tr('profile.fehlerBeimSpeichern')));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSignature() {
    try {
      setSignatureSaving(true);
      await api.updateSignature('');
      setExistingSignature(null);
      toast.success(tr('profile.unterschriftEntfernt'));
    } catch (err) {
      setError(errorText(err, tr('profile.unterschriftKonnteNichtGeloesc')));
    } finally {
      setSignatureSaving(false);
    }
  }

  async function handleSaveSignature() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError(tr('profile.bitteZuerstEineUnterschrift'));
      return;
    }
    setSignatureSaving(true);
    setError('');
    try {
      const canvas = sigRef.current.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');

      await api.updateSignature(dataUrl);
      setExistingSignature(dataUrl);
      sigRef.current.clear();
      setSigIsEmpty(true);
      toast.success(tr('profile.unterschriftGespeichert'));
    } catch (err) {
      setError(errorText(err, tr('profile.unterschriftKonnteNichtGespeic')));
    } finally {
      setSignatureSaving(false);
    }
  }

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadError('');
    if (!file) {
      setUploadFile(null);
      return;
    }
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setUploadError(tr('profile.fileTypeError'));
      setUploadFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setUploadError(tr('profile.fileTooLarge'));
      setUploadFile(null);
      e.target.value = '';
      return;
    }
    setUploadFile(file);
  }

  function clearPickedFile() {
    setUploadFile(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUploadSignature() {
    if (!uploadFile) return;
    setSignatureSaving(true);
    setUploadError('');
    try {
      const updated = await api.uploadSignature(uploadFile);
      if (updated?.signatureData) setExistingSignature(updated.signatureData);
      clearPickedFile();
      toast.success(tr('profile.signatureUploaded'));
    } catch (err) {
      setUploadError(errorText(err, tr('profile.uploadFailed')));
    } finally {
      setSignatureSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex max-w-[760px] flex-col gap-5">
        <SkeletonRows rows={4} label={t('profile.profilWirdGeladen')} />
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: t('profile.tabs.profile'), href: '/profile' },
    { id: 'security', label: t('profile.tabs.security'), href: '/profile?tab=security' },
    { id: 'signature', label: t('profile.tabs.signature'), href: '/profile?tab=signature' },
    { id: 'appearance', label: t('profile.tabs.appearance'), href: '/profile?tab=appearance' },
  ];

  return (
    <div className="flex max-w-[760px] flex-col gap-5 md:gap-6">
      <div className="max-md:hidden">
        <PageHeader
          title={t('profile.meinProfil')}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              {t('profile.subtitle')}
              {role && <StatusPill kind="role" status={role} />}
            </span>
          }
          tabs={<Tabs aria-label={t('profile.meinProfil')} tabs={tabs} value={tab} />}
        />
      </div>
      <div className="md:hidden">
        <h1 className="sr-only">{t('profile.meinProfil')}</h1>
        <Tabs aria-label={t('profile.meinProfil')} tabs={tabs} value={tab} className="w-full" />
      </div>

      {error && <Alert tone="err">{error}</Alert>}

      {tab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-5 md:gap-6" noValidate>
          <Panel aria-labelledby="profile-personal">
            <div className="panel-h">
              <h2 className="h2" id="profile-personal">
                {t('profile.persoenlicheDaten')}
              </h2>
            </div>
            <PanelBody className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label={t('profile.vorname')}>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('profile.vorname')} autoComplete="given-name" />
              </Field>
              <Field label={t('profile.nachname')}>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('profile.nachname')} autoComplete="family-name" />
              </Field>
              <Field label={t('common.eMail')} className="sm:col-span-2">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="email" />
              </Field>
              <Field label={t('common.telefon')} className="sm:col-span-2">
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 79 123 45 67" autoComplete="tel" />
              </Field>
            </PanelBody>
          </Panel>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} className="max-sm:w-full">
              {t('common.speichern')}
            </Button>
          </div>
        </form>
      )}

      {tab === 'security' && (
        <form onSubmit={handleSavePassword} className="flex flex-col gap-5 md:gap-6" noValidate>
          <Panel>
            <PanelHeader title={t('profile.passwortAendern')} subtitle={t('profile.securityHint')} />
            <PanelBody className="flex flex-col gap-4">
              <PasswordField
                label={t('profile.aktuellesPasswort')}
                value={currentPassword}
                onChange={(v) => {
                  setCurrentPassword(v);
                  setFieldErrors((f) => ({ ...f, current: undefined }));
                }}
                error={fieldErrors.current}
                autoComplete="current-password"
              />
              <PasswordField
                label={t('profile.neuesPasswort')}
                value={newPassword}
                onChange={(v) => {
                  setNewPassword(v);
                  setSameRejected(false);
                  setFieldErrors((f) => ({ ...f, next: undefined }));
                }}
                error={fieldErrors.next}
                autoComplete="new-password"
                placeholder={t('profile.mindestens12Zeichen')}
              />
              {newPassword && <PasswordGuide password={newPassword} current={currentPassword} differentRejected={sameRejected} />}
              <PasswordField
                label={t('profile.neuesPasswortBestaetigen')}
                value={confirmPassword}
                onChange={(v) => {
                  setConfirmPassword(v);
                  setFieldErrors((f) => ({ ...f, confirm: undefined }));
                }}
                error={fieldErrors.confirm}
                autoComplete="new-password"
              />
            </PanelBody>
          </Panel>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} className="max-sm:w-full">
              {t('profile.passwortAendern')}
            </Button>
          </div>
        </form>
      )}

      {tab === 'signature' && (
        <div className="flex flex-col gap-5 md:gap-6">
          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <PenTool size={20} className="text-ruby-fg" aria-hidden="true" />
                  {t('profile.firmenunterschrift')}
                </span>
              }
              subtitle={t('profile.dieseUnterschriftWirdAutomatis')}
            />
            <PanelBody className="flex flex-col gap-4">
              {existingSignature ? (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-row p-4">
                  <p className="lbl">{t('profile.aktuelleUnterschrift')}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL of the stored signature (not optimisable) */}
                  <img src={existingSignature} alt={t('profile.aktuelleUnterschrift')} className="max-h-20 rounded-lg border border-line bg-canvas p-2" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemoveSignature()}
                    disabled={signatureSaving}
                    iconLeft={<Trash2 size={16} aria-hidden="true" />}
                    className="text-err"
                  >
                    {t('profile.unterschriftEntfernen')}
                  </Button>
                </div>
              ) : (
                <p className="mut">{t('profile.noSignature')}</p>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={t('profile.neueUnterschriftZeichnen')} />
            <PanelBody className="flex flex-col gap-4">
              {/* The canvas is a sheet of paper: it stays light (pen colour is dark) in the dark theme too. */}
              <div data-theme="light" className="relative overflow-hidden rounded-xl border-2 border-dashed border-field bg-canvas">
                {mounted && SignatureCanvas && (
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="#1a1a1a"
                    canvasProps={{
                      className: 'block w-full touch-none',
                      style: { width: '100%', height: '160px' },
                    }}
                    onBegin={() => setSigIsEmpty(false)}
                    onEnd={() => setSigIsEmpty(false)}
                  />
                )}
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[18px] bottom-[30px] border-t-[1.5px] border-line" />
                <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-[18px] text-xs text-graphite">
                  {t('profile.mitFingerOderMaus')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => {
                    sigRef.current?.clear();
                    setSigIsEmpty(true);
                  }}
                  disabled={sigIsEmpty}
                  iconLeft={<RotateCcw size={18} aria-hidden="true" />}
                >
                  {t('common.loeschen')}
                </Button>
                <Button
                  variant="outline"
                  loading={signatureSaving}
                  onClick={() => void handleSaveSignature()}
                  iconLeft={<Check size={18} aria-hidden="true" />}
                >
                  {t('profile.unterschriftSpeichern')}
                </Button>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={t('profile.uploadTitle')} subtitle={t('profile.uploadHint')} />
            <PanelBody className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                id="signature-file"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handlePickFile}
                className="sr-only"
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <label htmlFor="signature-file" className="btn btn-o cursor-pointer">
                  <ImageUp size={18} aria-hidden="true" />
                  {t('profile.chooseFile')}
                </label>
                {uploadFile && (
                  <span className="sm mut min-w-0 truncate" title={uploadFile.name}>
                    {uploadFile.name}
                  </span>
                )}
              </div>
              {uploadError && <p className="errm">{uploadError}</p>}
              {uploadPreview && (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-row p-4">
                  <p className="lbl">{t('profile.preview')}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob preview of the picked file */}
                  <img src={uploadPreview} alt={t('profile.preview')} className="max-h-24 max-w-full rounded-lg border border-line bg-canvas p-2" />
                </div>
              )}
              {uploadFile && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="ghost" onClick={clearPickedFile} disabled={signatureSaving} iconLeft={<X size={18} aria-hidden="true" />}>
                    {t('profile.removeSelectedFile')}
                  </Button>
                  <Button loading={signatureSaving} onClick={() => void handleUploadSignature()} iconLeft={<Check size={18} aria-hidden="true" />}>
                    {t('profile.uploadSave')}
                  </Button>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}

      {tab === 'appearance' && <AppearanceTab />}
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
];

/** Language and theme: applied the moment they are picked, then saved on the account. */
function AppearanceTab() {
  const t = useTranslations();
  const { toast } = useToast();
  const { updateAdmin } = useAdminAuth();
  const { locale, setLocale } = useAppLocale();
  const { preference, setPreference } = useTheme();
  const [saving, setSaving] = useState(false);

  async function save(next: { locale?: Locale; theme?: ThemePreference }) {
    const previous = { locale, theme: preference };
    // Apply first so the change is visible at once; roll back if the account could not be updated.
    if (next.locale) await setLocale(next.locale);
    if (next.theme) setPreference(next.theme);
    setSaving(true);
    try {
      const updated = await api.updatePreferences(next);
      updateAdmin({ locale: updated.locale ?? next.locale, theme: updated.theme ?? next.theme });
      toast.success(tr('profile.appearance.saved'));
    } catch (err) {
      if (next.locale) void setLocale(previous.locale);
      if (next.theme) setPreference(previous.theme);
      toast.error(tr('profile.appearance.saveFailed'), errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Panel aria-labelledby="appearance-language">
        <PanelHeader title={<span id="appearance-language">{t('profile.appearance.language')}</span>} subtitle={t('profile.appearance.languageHint')} />
        <PanelBody>
          <fieldset className="m-0 border-0 p-0" disabled={saving}>
            <legend className="sr-only">{t('profile.appearance.language')}</legend>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 md:grid-cols-3">
              {LOCALES.map((code) => (
                <OptionCard
                  key={code}
                  name="locale"
                  checked={locale === code}
                  onSelect={() => void save({ locale: code })}
                  lang={code}
                >
                  <span className="font-semibold">{LOCALE_NAMES[code]}</span>
                  <span className="sm mut uppercase">{code}</span>
                </OptionCard>
              ))}
            </div>
          </fieldset>
        </PanelBody>
      </Panel>

      <Panel aria-labelledby="appearance-theme">
        <PanelHeader title={<span id="appearance-theme">{t('profile.appearance.theme')}</span>} subtitle={t('profile.appearance.themeHint')} />
        <PanelBody>
          <fieldset className="m-0 border-0 p-0" disabled={saving}>
            <legend className="sr-only">{t('profile.appearance.theme')}</legend>
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              {THEME_OPTIONS.map(({ value, icon: Icon }) => (
                <OptionCard key={value} name="theme" checked={preference === value} onSelect={() => void save({ theme: value })}>
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon size={18} aria-hidden="true" />
                    {t(`profile.appearance.${value}`)}
                  </span>
                  {value === 'system' && <span className="sm mut">{t('profile.appearance.systemHint')}</span>}
                </OptionCard>
              ))}
            </div>
          </fieldset>
        </PanelBody>
      </Panel>
    </div>
  );
}

/** Radio shown as a selectable card (native input, so keyboard and screen readers work as usual). */
function OptionCard({
  name,
  checked,
  onSelect,
  lang,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      lang={lang}
      className={cn(
        'relative flex min-h-[56px] cursor-pointer flex-col justify-center gap-0.5 rounded-xl border-[1.5px] bg-card px-4 py-3 text-ink hover:bg-paper',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
        checked ? 'border-ruby bg-ruby-tint hover:bg-ruby-tint' : 'border-line',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {children}
      {checked && <Check size={18} aria-hidden="true" className="absolute right-3 top-3 text-ruby-fg" />}
    </label>
  );
}
