'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { SIGNUP_OTP_TTL_SECONDS } from '@/models/auth';

/**
 * Signup OTP entry.
 *
 * The countdown here is a convenience, never the control: /api/auth/verify
 * refuses a code older than SIGNUP_OTP_TTL_SECONDS on the server regardless of
 * what this component believes. That matters because the two clocks can legally
 * disagree — the user may land on this page seconds after the code was issued,
 * or leave the tab suspended — so an `OtpExpiredError` from the server also
 * flips the page into its expired state, catching any drift the timer missed.
 */
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verify');
  const emailParam = searchParams.get('email') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expired, setExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SIGNUP_OTP_TTL_SECONDS);
  const [resending, setResending] = useState(false);

  // One interval for the life of the current code. Restarted by resend via the
  // `secondsLeft` reset below, not by tearing the effect down.
  useEffect(() => {
    if (expired) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [expired]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const code = formData.get('code');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        // The server is the authority on expiry; trust it over the local timer.
        if (data.error?.code === 'OtpExpiredError') {
          setExpired(true);
          setSecondsLeft(0);
        }
        throw new Error(data.error?.message || t('errors.verify'));
      }

      router.push('/auth/sign-in?verified=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.verify'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = useCallback(async () => {
    const email = emailParam || (document.querySelector<HTMLInputElement>('input[name="email"]')?.value ?? '');

    if (!email) {
      setError(t('errors.emailRequired'));
      return;
    }

    setResending(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Includes the cooldown and Supabase's mail-quota 429. Both carry a
        // message that tells the user what to do, so neither is replaced with a
        // generic one — and the page stays in its expired state so the button
        // remains available to retry.
        throw new Error(data.error?.message || t('errors.resend'));
      }

      // Restart the window from the server's own TTL rather than the constant,
      // so a change on the server takes effect without a client release.
      setSecondsLeft(data.expiresInSeconds ?? SIGNUP_OTP_TTL_SECONDS);
      setExpired(false);
      setNotice(t('notices.resent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.resend'));
    } finally {
      setResending(false);
    }
  }, [emailParam, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            {notice}
          </div>
        ) : null}

        {expired ? (
          <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            {t('expired')}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('fields.email')}
            </label>
            <input
              name="email"
              type="email"
              defaultValue={emailParam}
              required
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('fields.code')}
              </label>
              {!expired ? (
                <span
                  aria-live="polite"
                  className="text-[13px] tabular-nums text-slate-500 dark:text-slate-400"
                >
                  {t('expiresIn', { seconds: secondsLeft })}
                </span>
              ) : null}
            </div>
            <input
              name="code"
              type="text"
              required
              // A 6-digit OTP: numeric keypad on mobile, and paste-friendly.
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t('placeholders.code')}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-slate-700 dark:text-white"
              disabled={expired}
            />
          </div>

          <button
            type="submit"
            disabled={loading || expired}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('actions.submit')}
          </button>
        </form>

        {expired ? (
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {resending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              t('actions.resend')
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
