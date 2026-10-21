'use client';

/**
 * Two modes on one route:
 *  (a) /reset-password?token=...  link from the "Passwort vergessen" e-mail (no session):
 *      GET reset-token -> POST reset-password-token -> the API signs the user in -> "/"
 *  (b) /reset-password             forced reset after login (mustResetPassword): POST reset-password,
 *      then markPasswordReset() BEFORE navigating (otherwise the auth guard bounces back here).
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { evaluatePassword } from '@hoppdrive/shared';
import { Alert, Button, Skeleton } from '@/components/ui';
import { AuthShell } from '@/components/content/auth/AuthShell';
import { PasswordField } from '@/components/content/auth/PasswordField';
import { PasswordGuide } from '@/components/content/auth/PasswordGuide';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { fieldMessages, isInvalidToken, isSamePasswordRejected } from '@/lib/auth-errors';
import { errorText } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

type TokenState =
  | { status: 'checking' }
  | { status: 'valid'; minutes: number }
  | { status: 'invalid'; message?: string };

export default function ResetPasswordPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<AuthShell title={t('resetPassword.neuesPasswortFestlegen')}><Skeleton className="h-11 w-full" /></AuthShell>}>
      <ResetPasswordView />
    </Suspense>
  );
}

function minutesText(minutes: number): string {
  return `${minutes} ${tr('resetPassword.minuteN', { count: minutes })}`;
}

function ResetPasswordView() {
  const t = useTranslations();
  const router = useRouter();
  const token = useSearchParams()?.get('token') ?? '';
  const { admin, loading: authLoading, login, markPasswordReset } = useAdminAuth();

  const [tokenState, setTokenState] = useState<TokenState>(token ? { status: 'checking' } : { status: 'invalid' });
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [repeatError, setRepeatError] = useState<string | null>(null);
  const [sameRejected, setSameRejected] = useState(false);

  // Mode (a): is the link from the e-mail still valid?
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setTokenState({ status: 'checking' });
    api
      .checkResetToken(token)
      .then((info) => {
        if (cancelled) return;
        setTokenState(info.valid ? { status: 'valid', minutes: Math.max(1, info.expiresInMinutes) } : { status: 'invalid' });
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenState({ status: 'invalid', message: isInvalidToken(err) ? undefined : errorText(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setPasswordError(null);
    setRepeatError(null);
    setSameRejected(false);

    if (!evaluatePassword(password).valid) {
      setPasswordError(tr('resetPassword.dasPasswortErfuelltNoch'));
      return;
    }
    if (password !== repeat) {
      setRepeatError(tr('resetPassword.diePasswoerterStimmenNicht'));
      return;
    }

    setSubmitting(true);
    try {
      if (token) {
        const session = await api.resetPasswordWithToken(token, password);
        login(session.accessToken, session.admin);
      } else {
        await api.resetPassword({ newPassword: password });
        markPasswordReset(); // before navigating, or the guard sends the user straight back here
      }
      router.push('/');
    } catch (err) {
      if (token && isInvalidToken(err)) {
        setTokenState({ status: 'invalid' });
      } else if (isSamePasswordRejected(err, 'newPassword')) {
        setSameRejected(true);
        setPasswordError(tr('resetPassword.dasNeuePasswortDarf'));
      } else {
        const messages = fieldMessages(err, 'newPassword');
        if (messages.length > 0) setPasswordError(messages.join(' '));
        else setError(errorText(err, tr('resetPassword.dasPasswortKonnteNicht')));
      }
      setSubmitting(false);
    }
  }

  // ── Link mode, link checked ──────────────────────────────────
  if (token && tokenState.status === 'checking') {
    return (
      <AuthShell title={t('resetPassword.neuesPasswortFestlegen')} subtitle={t('resetPassword.derLinkWirdGeprueft')}>
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t('resetPassword.derLinkWirdGeprueft2')}</span>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-11 w-full" />
        </div>
      </AuthShell>
    );
  }

  if (token && tokenState.status === 'invalid') {
    return (
      <AuthShell title={t('resetPassword.linkNichtMehrGueltig')} subtitle={t('resetPassword.derLinkZumZuruecksetzen')}>
        <Alert tone="warn">
          {tokenState.message ?? t('resetPassword.ausSicherheitsgruendenSindLink')}
        </Alert>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button href="/forgot-password" fullWidth>
            {t('resetPassword.neuenLinkAnfordern')}
          </Button>
          <Button href="/login" variant="ghost" fullWidth>
            {t('resetPassword.zurAnmeldung')}
          </Button>
        </div>
      </AuthShell>
    );
  }

  // ── Forced mode needs a session ──────────────────────────────
  if (!token) {
    if (authLoading) {
      return (
        <AuthShell title={t('resetPassword.neuesPasswortFestlegen')}>
          <Skeleton className="h-11 w-full" />
        </AuthShell>
      );
    }
    if (!admin) {
      return (
        <AuthShell title={t('resetPassword.neuesPasswortFestlegen')} subtitle={t('resetPassword.oeffnenSieDenLink')}>
          <Alert tone="info">{t('resetPassword.ohneLinkOderAnmeldung')}</Alert>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button href="/forgot-password" fullWidth>
              {t('resetPassword.linkPerEMail')}
            </Button>
            <Button href="/login" variant="ghost" fullWidth>
              {t('resetPassword.zurAnmeldung')}
            </Button>
          </div>
        </AuthShell>
      );
    }
  }

  const subtitle =
    token && tokenState.status === 'valid'
      ? t('resetPassword.derLinkAusIhrer', { minutesText: minutesText(tokenState.minutes) })
      : t('resetPassword.ausSicherheitsgruendenMuessenS');

  return (
    <AuthShell
      title={t('resetPassword.neuesPasswortFestlegen')}
      subtitle={subtitle}
      footnote={token ? t('resetPassword.danachWerdenSieAutomatisch') : t('resetPassword.danachGelangenSieZur')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        {error && <Alert tone="err">{error}</Alert>}

        <PasswordField
          label={t('resetPassword.neuesPasswort')}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setSameRejected(false);
            setPasswordError(null);
          }}
          error={passwordError}
          required
          autoComplete="new-password"
          autoFocus
        />

        <PasswordGuide password={password} differentRejected={sameRejected} />

        <PasswordField
          label={t('resetPassword.passwortWiederholen')}
          value={repeat}
          onChange={(v) => {
            setRepeat(v);
            setRepeatError(null);
          }}
          error={repeatError}
          required
          autoComplete="new-password"
        />

        <Button type="submit" fullWidth loading={submitting} className="min-h-[48px]">
          {submitting ? t('resetPassword.wirdGespeichert') : t('resetPassword.passwortSpeichern')}
        </Button>
      </form>
    </AuthShell>
  );
}
