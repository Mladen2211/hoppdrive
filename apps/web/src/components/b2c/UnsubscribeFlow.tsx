'use client';

/**
 * Unsubscribe from marketing e-mails (page /abmelden, /en/unsubscribe, ...).
 * The mails link to it as `<url>?token=<unsubscribeToken>`:
 *
 *   GET  /marketing/unsubscribe/:token  -> { valid, email (masked), unsubscribed }   status of the link
 *   POST /marketing/unsubscribe {token} -> { valid, alreadyUnsubscribed }           the actual unsubscribe
 *
 * States: loading, ready (button "Abmelden"), submitting, done, already unsubscribed,
 * invalid / expired / missing token, and a retryable network error. Service e-mails about rental
 * contracts are not affected, which every state says.
 */
import { CircleCheck, MailCheck, MailX, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button, Spinner, cn } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

type State =
  | { name: 'loading' }
  | { name: 'ready'; email?: string }
  | { name: 'submitting'; email?: string }
  | { name: 'done'; email?: string }
  | { name: 'already'; email?: string }
  | { name: 'invalid' }
  | { name: 'error'; action: 'status' | 'submit'; email?: string };

const MAX_TOKEN_LENGTH = 200;

function Panel({
  icon,
  tone = 'neutral',
  title,
  headingRef,
  children,
}: {
  icon: ReactNode;
  tone?: 'neutral' | 'ok';
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  return (
    <div className="card mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 text-center !p-10 max-md:!p-6">
      <div
        className={cn(
          'flex h-[72px] w-[72px] items-center justify-center rounded-full',
          tone === 'ok' ? 'bg-ok-tint text-ok' : 'bg-paper text-graphite',
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="h3 !text-[28px] outline-none max-md:!text-[24px]">
        {title}
      </h1>
      {children}
    </div>
  );
}

function Loading() {
  const t = useTranslations('unsubscribe');
  return (
    <div className="card mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 text-center !p-10 max-md:!p-6" role="status">
      <Spinner size={32} />
      <p className="mut">{t('loading')}</p>
    </div>
  );
}

function Flow() {
  const t = useTranslations('unsubscribe');
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim().slice(0, MAX_TOKEN_LENGTH);

  const [state, setState] = useState<State>({ name: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Focus moves to the new heading only after something the visitor did (button / retry).
  const userAction = useRef(false);

  // Status of the link.
  useEffect(() => {
    if (!token) {
      setState({ name: 'invalid' });
      return;
    }
    let cancelled = false;
    setState({ name: 'loading' });
    api
      .getUnsubscribeStatus(token)
      .then((status) => {
        if (cancelled) return;
        if (!status.valid) setState({ name: 'invalid' });
        else if (status.unsubscribed) setState({ name: 'already', email: status.email });
        else setState({ name: 'ready', email: status.email });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(error instanceof ApiError && error.status === 404 ? { name: 'invalid' } : { name: 'error', action: 'status' });
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  useEffect(() => {
    if (!userAction.current) return;
    if (state.name === 'done' || state.name === 'already' || state.name === 'invalid' || state.name === 'error') {
      headingRef.current?.focus();
      userAction.current = false;
    }
  }, [state.name]);

  async function submit() {
    if (state.name !== 'ready' && !(state.name === 'error' && state.action === 'submit')) return;
    const email = state.email;
    userAction.current = true;
    setState({ name: 'submitting', email });
    try {
      const result = await api.unsubscribe(token);
      if (!result.valid) setState({ name: 'invalid' });
      else setState(result.alreadyUnsubscribed ? { name: 'already', email } : { name: 'done', email });
    } catch (error) {
      setState(
        error instanceof ApiError && error.status === 404 ? { name: 'invalid' } : { name: 'error', action: 'submit', email },
      );
    }
  }

  switch (state.name) {
    case 'loading':
      return <Loading />;

    case 'ready':
    case 'submitting': {
      const busy = state.name === 'submitting';
      return (
        <Panel icon={<MailX size={34} />} title={t('readyTitle')} headingRef={headingRef}>
          <p className="mut max-w-[44ch]">{t('readyText')}</p>
          {state.email && <p className="num text-[17px] font-semibold">{t('emailLine', { email: state.email })}</p>}
          <p className="hint max-w-[44ch]">{t('serviceNote')}</p>
          <div className="mt-1 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Button size="lg" loading={busy} onClick={submit}>
              {busy ? t('submitting') : t('submit')}
            </Button>
            <Button href="/" variant="ghost" size="lg">
              {t('home')}
            </Button>
          </div>
        </Panel>
      );
    }

    case 'done':
      return (
        <Panel icon={<MailCheck size={34} />} tone="ok" title={t('doneTitle')} headingRef={headingRef}>
          <p className="mut max-w-[44ch]" role="status">
            {t('doneText')}
          </p>
          {state.email && <p className="num text-[17px] font-semibold">{state.email}</p>}
          <Button href="/" className="mt-1">
            {t('home')}
          </Button>
        </Panel>
      );

    case 'already':
      return (
        <Panel icon={<CircleCheck size={34} />} tone="ok" title={t('alreadyTitle')} headingRef={headingRef}>
          <p className="mut max-w-[44ch]" role="status">
            {t('alreadyText')}
          </p>
          {state.email && <p className="num text-[17px] font-semibold">{state.email}</p>}
          <Button href="/" className="mt-1">
            {t('home')}
          </Button>
        </Panel>
      );

    case 'invalid':
      return (
        <Panel icon={<MailX size={34} />} title={t('invalidTitle')} headingRef={headingRef}>
          <p className="mut max-w-[44ch]">{t('invalidText')}</p>
          <Button href="/" className="mt-1">
            {t('home')}
          </Button>
        </Panel>
      );

    case 'error':
      return (
        <Panel icon={<WifiOff size={34} />} title={t('errorTitle')} headingRef={headingRef}>
          <p className="mut max-w-[44ch]" role="alert">
            {t('errorText')}
          </p>
          <div className="mt-1 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              onClick={() => {
                if (state.action === 'submit') void submit();
                else {
                  userAction.current = true;
                  setAttempt((n) => n + 1);
                }
              }}
            >
              {t('retry')}
            </Button>
            <Button href="/" variant="ghost" size="lg">
              {t('home')}
            </Button>
          </div>
        </Panel>
      );
  }
}

export function UnsubscribeFlow() {
  return (
    <Suspense fallback={<Loading />}>
      <Flow />
    </Suspense>
  );
}
