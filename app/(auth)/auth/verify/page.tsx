'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { RESEND_COOLDOWN_SECONDS, SIGNUP_OTP_TTL_SECONDS } from '@/models/auth';
import { readJsonResponse, type ApiErrorBody } from '@/lib/http/read-json';

type ErrorBody = ApiErrorBody & { error?: { details?: { retryAfterSeconds?: number } } };
type ResendBody = ErrorBody & { expiresInSeconds?: number; cooldownSeconds?: number };

/**
 * Signup OTP entry.
 *
 * The countdown here is a convenience, never the control: /api/auth/verify
 * refuses a code older than SIGNUP_OTP_TTL_SECONDS on the server regardless of
 * what this component believes. That matters because the two clocks can legally
 * disagree — the user may land on this page seconds after the code was issued,
 * or leave the tab suspended — so an `OtpExpiredError` from the server also
 * flips the page into its expired state, catching any drift the timer missed.
 * The same goes for the resend cooldown: the server enforces it in
 * lib/auth/otp-guard.ts and repositories/signup-otp.repository.ts.
 */
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verify');
  const emailParam = searchParams.get('email') || '';
  // Arriving from sign-in (?unverified=1) means no code was sent just now, so
  // Resend is available immediately and there is no deadline to count down —
  // the server decides whether the code already in the inbox is still good.
  // Arriving from sign-up, one just was.
  const cameFromSignIn = searchParams.get('unverified') === '1';

  const [email, setEmail] = useState(emailParam);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(cameFromSignIn ? t('status.unverified') : '');
  const [expired, setExpired] = useState(false);
  // null = no known deadline (see cameFromSignIn), so no countdown is shown.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    cameFromSignIn ? null : SIGNUP_OTP_TTL_SECONDS
  );
  const [cooldown, setCooldown] = useState(cameFromSignIn ? 0 : RESEND_COOLDOWN_SECONDS);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (expired || secondsLeft === null) return;
    const id = setTimeout(() => {
      if (secondsLeft <= 1) {
        setSecondsLeft(0);
        setExpired(true);
      } else {
        setSecondsLeft(secondsLeft - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [expired, secondsLeft]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    setError('');
    setNotice('');

    const formData = new FormData(e.currentTarget);
    const code = String(formData.get('code') || '').replace(/\s+/g, '');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });

      const data = await readJsonResponse<ErrorBody>(res);
      if (!res.ok) {
        // The server is the authority on expiry; trust it over the local timer.
        if (data?.error?.code === 'OtpExpiredError') {
          setExpired(true);
          setSecondsLeft(0);
        }
        throw new Error(data?.error?.message || t('errors.verify'));
      }

      router.push('/auth/sign-in?verified=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.verify'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const onResend = async () => {
    if (resending || cooldown > 0) return;
    if (!email.trim()) {
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
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await readJsonResponse<ResendBody>(res);
      if (!res.ok) {
        // Includes the cooldown and Supabase's mail-quota 429. Both carry a
        // message that tells the user what to do, so neither is replaced with a
        // generic one.
        const retryAfter = data?.error?.details?.retryAfterSeconds;
        if (retryAfter) setCooldown(retryAfter);
        throw new Error(data?.error?.message || t('errors.resend'));
      }

      // Restart the window from the server's own TTL rather than the constant,
      // so a change on the server takes effect without a client release.
      setSecondsLeft(data?.expiresInSeconds ?? SIGNUP_OTP_TTL_SECONDS);
      setExpired(false);
      setCooldown(data?.cooldownSeconds ?? RESEND_COOLDOWN_SECONDS);
      setNotice(t('notices.resent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.resend'));
    } finally {
      setResending(false);
    }
  };

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
          <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div role="status" className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('fields.code')}
              </label>
              {!expired && secondsLeft !== null ? (
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
              // A numeric OTP: numeric keypad on mobile, and paste-friendly
              // (spaces are stripped before submitting).
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,12}"
              maxLength={12}
              required
              placeholder={t('placeholders.code')}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 tracking-widest text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-slate-700 dark:text-white"
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

          <button
            type="button"
            onClick={onResend}
            disabled={resending || cooldown > 0}
            className={
              // Once the code has expired, resending is the only way forward,
              // so the button is promoted from a text link to a full button.
              expired
                ? 'flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                : 'flex w-full items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-blue-400'
            }
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : cooldown > 0 ? (
              t('actions.resendIn', { seconds: cooldown })
            ) : (
              t('actions.resend')
            )}
          </button>
        </form>
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
