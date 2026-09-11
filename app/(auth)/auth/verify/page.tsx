'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { VERIFICATION_CODE_TTL_SECONDS } from '@/lib/auth/verification-window';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verify');
  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resending, setResending] = useState(false);

  // Epoch ms at which the outstanding code stops being accepted. null means
  // "nothing outstanding" — no code, or one that has already died.
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // Until the first server answer lands, neither the countdown nor the resend
  // button is truthful, so the row renders empty rather than guessing.
  const [windowLoaded, setWindowLoaded] = useState(false);

  const startWindow = useCallback((seconds: number) => {
    setExpiresAt(seconds > 0 ? Date.now() + seconds * 1000 : null);
    setWindowLoaded(true);
  }, []);

  /**
   * Asks the server how much life the current code has left.
   *
   * The remaining time is deliberately not kept in localStorage. The server is
   * the only thing that knows when the code was mailed and the only thing that
   * decides whether it still works, so reading it from there means a refresh, a
   * second tab and a cleared browser store all show the same true number — and
   * a client that lies to itself gains nothing, because /api/auth/verify applies
   * the same check.
   */
  useEffect(() => {
    const address = email.trim();
    if (!address) {
      setExpiresAt(null);
      setWindowLoaded(true);
      return;
    }

    // Guards against a slow response for a previous address overwriting the
    // state of the one now in the field.
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/auth/resend-verification?email=${encodeURIComponent(address)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (cancelled) return;

        startWindow(res.ok && typeof data.expiresInSeconds === 'number' ? data.expiresInSeconds : 0);
      } catch {
        // Offline or a transient failure. Fall back to offering the resend:
        // the worst case is a 429 that tells the page the real number.
        if (!cancelled) startWindow(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, startWindow]);

  /**
   * The one-second tick.
   *
   * Each tick recomputes from the deadline rather than decrementing a counter,
   * so a backgrounded tab (browsers throttle its timers to about once a minute)
   * and a sleeping laptop both come back showing the correct remaining time
   * instead of a countdown that has fallen behind. The interval is cleared on
   * unmount and whenever the deadline changes, so a resend cannot leave a second
   * timer running alongside the first.
   */
  useEffect(() => {
    if (expiresAt === null) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) clearInterval(id);
    };

    const id = setInterval(tick, 1000);
    tick();

    return () => clearInterval(id);
  }, [expiresAt]);

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
        throw new Error(data.error?.message || t('errors.verify'));
      }

      router.push('/auth/sign-in?verified=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.verify'));

      // The code may have died between the page rendering and the request
      // arriving — a submit at 00:00, or a clock that drifted. The server has
      // just said so, so stop counting down and offer the resend.
      setExpiresAt((current) => (current !== null && current <= Date.now() ? null : current));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (secondsLeft > 0 || resending || !email.trim()) return;

    setResending(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        // A 429 means a code is still alive that this page thought was dead
        // (a second tab, a clock skew). Adopt the server's number.
        const retryAfter = data.error?.details?.retryAfterSeconds;
        if (typeof retryAfter === 'number' && retryAfter > 0) {
          startWindow(retryAfter);
        }
        throw new Error(data.error?.message || t('errors.resend'));
      }

      startWindow(
        typeof data.expiresInSeconds === 'number'
          ? data.expiresInSeconds
          : VERIFICATION_CODE_TTL_SECONDS
      );
      setNotice(data.message || t('resendSent'));
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
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
            {notice}
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
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('fields.code')}
            </label>
            <input
              name="code"
              type="text"
              required
              placeholder={t('placeholders.code')}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('actions.submit')}
          </button>
        </form>

        {/* aria-live so a screen reader hears the code expire and the button
            appear. Only the state swap is announced, not all 90 ticks. */}
        <div className="space-y-2 text-center" aria-live="polite">
          {!windowLoaded ? null : secondsLeft > 0 ? (
            <p className="text-[13px] leading-5 text-slate-500 sm:text-sm dark:text-slate-400">
              {t('expiresIn', { seconds: secondsLeft })}
            </p>
          ) : (
            <>
              <p className="text-[13px] font-medium leading-5 text-amber-600 sm:text-sm dark:text-amber-400">
                {t('expired')}
              </p>
              <button
                type="button"
                onClick={onResend}
                disabled={resending || !email.trim()}
                className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-[13px] font-semibold leading-5 text-blue-600 hover:text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline sm:text-sm dark:text-blue-400 dark:hover:text-blue-300"
              >
                {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('actions.resend')}
              </button>
            </>
          )}
        </div>
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
