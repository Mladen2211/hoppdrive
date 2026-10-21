'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { AuthShell } from '@/components/content/auth/AuthShell';
import { PasswordField } from '@/components/content/auth/PasswordField';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { isInvalidCredentials, loginErrorText } from '@/lib/auth-errors';
import { useTranslations } from 'next-intl';

export default function AdminLoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [credentialsWrong, setCredentialsWrong] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setCredentialsWrong(false);

    try {
      const result = await api.login({ email: email.trim(), password });
      login(result.accessToken, result.admin);

      if (result.admin.mustResetPassword) {
        router.push('/reset-password');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(loginErrorText(err));
      setCredentialsWrong(isInvalidCredentials(err));
      setLoading(false);
    }
    // On success the page navigates away, so `loading` stays on until then (no double submit).
  }

  return (
    <AuthShell
      title={t('login.anmelden')}
      subtitle={t('login.zugangZumVerwaltungsbereich')}
      footnote={t('login.nach5FehlversuchenWird')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        {error && <Alert tone="err">{error}</Alert>}

        <Field label={t('common.eMail')}>
          <Input
            name="email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={credentialsWrong}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
        </Field>

        <PasswordField
          label={t('common.passwort')}
          name="password"
          value={password}
          onChange={setPassword}
          invalid={credentialsWrong}
          required
          markRequired={false}
          autoComplete="current-password"
        />

        <Link
          href="/forgot-password"
          className="inline-flex min-h-[44px] items-center self-start font-semibold text-ruby-dark underline underline-offset-2"
        >
          {t('login.passwortVergessen')}
        </Link>

        <Button type="submit" fullWidth loading={loading} className="min-h-[48px]">
          {loading ? t('login.anmeldungLaeuft') : t('login.anmelden')}
        </Button>
      </form>
    </AuthShell>
  );
}
