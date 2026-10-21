'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { evaluatePassword, isAdminRole } from '@hoppdrive/shared';
import { Alert, Button, Field, Input, Skeleton, StatusPill } from '@/components/ui';
import { AuthShell } from '@/components/content/auth/AuthShell';
import { PasswordField } from '@/components/content/auth/PasswordField';
import { PasswordGuide } from '@/components/content/auth/PasswordGuide';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { fieldMessages, isInvalidToken, isSamePasswordRejected } from '@/lib/auth-errors';
import { errorText } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

type InviteState =
  | { status: 'checking' }
  | { status: 'valid'; email: string; role: string | null }
  | { status: 'invalid'; message?: string };

export default function AcceptInvitePage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<AuthShell title={t('acceptInvite.einladungAnnehmen')}><Skeleton className="h-11 w-full" /></AuthShell>}>
      <AcceptInviteView />
    </Suspense>
  );
}

function AcceptInviteView() {
  const t = useTranslations();
  const router = useRouter();
  const token = useSearchParams()?.get('token') ?? '';
  const { login } = useAdminAuth();

  const [invite, setInvite] = useState<InviteState>(token ? { status: 'checking' } : { status: 'invalid' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; password?: string; repeat?: string }>({});
  const [sameRejected, setSameRejected] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setInvite({ status: 'checking' });
    api
      .getInvite(token)
      .then((info) => {
        if (cancelled) return;
        setInvite(info.valid && info.email ? { status: 'valid', email: info.email, role: info.role } : { status: 'invalid' });
      })
      .catch((err) => {
        if (cancelled) return;
        setInvite({ status: 'invalid', message: isInvalidToken(err) ? undefined : errorText(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSameRejected(false);

    const next: typeof errors = {};
    if (!firstName.trim()) next.firstName = tr('acceptInvite.bitteGebenSieIhren');
    if (!lastName.trim()) next.lastName = tr('acceptInvite.bitteGebenSieIhren2');
    if (!evaluatePassword(password).valid) next.password = tr('acceptInvite.dasPasswortErfuelltNoch');
    else if (password !== repeat) next.repeat = tr('acceptInvite.diePasswoerterStimmenNicht');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const session = await api.acceptInvite({ token, firstName: firstName.trim(), lastName: lastName.trim(), password });
      login(session.accessToken, session.admin);
      router.push('/');
    } catch (err) {
      if (isInvalidToken(err)) {
        setInvite({ status: 'invalid' });
      } else {
        const server: typeof errors = {};
        const fn = fieldMessages(err, 'firstName');
        const ln = fieldMessages(err, 'lastName');
        const pw = fieldMessages(err, 'password');
        if (fn.length) server.firstName = fn.join(' ');
        if (ln.length) server.lastName = ln.join(' ');
        if (isSamePasswordRejected(err, 'password')) setSameRejected(true);
        if (pw.length) server.password = pw.join(' ');
        if (Object.keys(server).length > 0) setErrors(server);
        else setError(errorText(err, tr('acceptInvite.dieEinladungKonnteNicht')));
      }
      setSubmitting(false);
    }
  }

  if (invite.status === 'checking') {
    return (
      <AuthShell title={t('acceptInvite.einladungAnnehmen')} subtitle={t('acceptInvite.dieEinladungWirdGeprueft')}>
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t('acceptInvite.dieEinladungWirdGeprueft2')}</span>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </AuthShell>
    );
  }

  if (invite.status === 'invalid') {
    return (
      <AuthShell title={t('acceptInvite.einladungNichtMehrGueltig')} subtitle={t('acceptInvite.derEinladungslinkIstUngueltig')}>
        <Alert tone="warn">
          {invite.message ?? t('acceptInvite.bittenSieEineAdministratorin')}
        </Alert>
        <Button href="/login" variant="ghost" fullWidth>
          {t('acceptInvite.zurAnmeldung')}
        </Button>
      </AuthShell>
    );
  }

  const roleLabel = invite.role && isAdminRole(invite.role) ? tr(`roles.${invite.role}`) : null;

  return (
    <AuthShell
      title={t('acceptInvite.einladungAnnehmen')}
      subtitle={t('acceptInvite.legenSieIhrKonto')}
      footnote={t('acceptInvite.dasPasswortMussMindestens')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        {error && <Alert tone="err">{error}</Alert>}

        <Field label={t('common.eMail')} hint={t('acceptInvite.mitDieserAdresseMelden')}>
          <Input type="email" value={invite.email} readOnly autoComplete="username" className="bg-paper" />
        </Field>
        {roleLabel && (
          <div className="flex items-center gap-2 text-sm">
            <span className="mut">{t('acceptInvite.ihreRolle')}</span>
            <StatusPill kind="role" status={invite.role as string} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label={t('acceptInvite.vorname')} error={errors.firstName} required>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              autoFocus
            />
          </Field>
          <Field label={t('acceptInvite.nachname')} error={errors.lastName} required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </Field>
        </div>

        <PasswordField
          label={t('common.passwort')}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setSameRejected(false);
          }}
          error={errors.password}
          required
          autoComplete="new-password"
        />

        <PasswordGuide password={password} differentRejected={sameRejected} hideDifferent />

        <PasswordField
          label={t('acceptInvite.passwortWiederholen')}
          value={repeat}
          onChange={setRepeat}
          error={errors.repeat}
          required
          autoComplete="new-password"
        />

        <Button type="submit" fullWidth loading={submitting} className="min-h-[48px]">
          {submitting ? t('acceptInvite.kontoWirdErstellt') : t('acceptInvite.kontoAktivieren')}
        </Button>
      </form>
    </AuthShell>
  );
}
