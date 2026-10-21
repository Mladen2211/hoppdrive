'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { AuthShell } from '@/components/content/auth/AuthShell';
import { api } from '@/lib/api';
import { fieldMessages } from '@/lib/auth-errors';
import { errorText } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setFieldError(null);

    const value = email.trim();
    if (!value || !value.includes('@')) {
      setFieldError(tr('forgotPassword.gebenSieDieE'));
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(value);
      // Always the same neutral answer: the API never reveals whether the account exists.
      setSent(true);
    } catch (err) {
      const messages = fieldMessages(err, 'email');
      if (messages.length > 0) setFieldError(tr('common.gebenSieEineGueltige'));
      else setError(errorText(err, tr('forgotPassword.dieAnfrageKonnteNicht')));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title={t('forgotPassword.linkGesendet')} subtitle={t('forgotPassword.pruefenSieIhrPostfach')}>
        <div className="flex flex-col gap-[18px]">
          <Alert tone="ok" icon={<MailCheck size={20} />}>
            {t('forgotPassword.sentText')}
          </Alert>
          <p className="sm mut">
            {t('forgotPassword.keineEMailErhalten')}
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button href="/login" fullWidth>
              {t('forgotPassword.zurueckZurAnmeldung')}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setSent(false)}>
              {t('forgotPassword.neuenLinkAnfordern')}
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('forgotPassword.passwortVergessen')}
      subtitle={t('forgotPassword.gebenSieIhreE')}
      footnote={t('forgotPassword.derLinkIst60')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
        {error && <Alert tone="err">{error}</Alert>}

        <Field label={t('common.eMail')} error={fieldError} required>
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
        </Field>

        <Button type="submit" fullWidth loading={loading} className="min-h-[48px]">
          {loading ? t('forgotPassword.wirdGesendet') : t('forgotPassword.linkSenden')}
        </Button>

        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center self-start font-semibold text-ruby-dark underline underline-offset-2"
        >
          {t('forgotPassword.zurueckZurAnmeldung')}
        </Link>
      </form>
    </AuthShell>
  );
}
