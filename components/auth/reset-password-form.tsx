'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import {
  AUTH_PRIMARY_BUTTON_CLASSES,
  AuthErrorBanner,
} from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/form-field';
import { createResetPasswordSchema, toFieldErrors } from '@/models/auth';
import { readJsonResponse, type ApiErrorBody } from '@/lib/http/read-json';
import {
  createRecoveryLinkReader,
  isExpiredRecoveryError,
  isRecoveryCredential,
  type RecoveryLink,
} from '@/lib/auth/recovery-link';

/** How long the confirmation stays up before the automatic bounce to sign-in. */
const REDIRECT_DELAY_MS = 2500;

/**
 * Step 2 of the reset flow: the page the emailed link opens.
 *
 * Like the forgot-password page, this replaced a static "not implemented" card
 * — the route existed and was reachable, it simply had no password fields.
 *
 * The token is read from the URL on mount rather than on the server because the
 * stock Supabase template returns it in the fragment, and browsers never send
 * the fragment upstream. That is also why this is a client component.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const t = useTranslations('auth.resetPassword');

  const [link, setLink] = useState<RecoveryLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Held in a ref as well as state: the token is scrubbed from the URL below,
  // so the address bar stops being a second source of truth for it.
  const tokenRef = useRef<{ tokenHash?: string; accessToken?: string; code?: string }>({});

  // One reader per mounted page. It parses the URL on the first call and then
  // repeats that answer, which is what makes the effect below safe to run more
  // than once — and it *will* run twice, because React StrictMode is on by
  // default for the App Router and double-invokes mount effects in development.
  // Reading the URL a second time would see the scrubbed pathname and downgrade
  // a perfectly good link to "missing". See lib/auth/recovery-link.ts.
  const readerRef = useRef<ReturnType<typeof createRecoveryLinkReader> | null>(null);
  readerRef.current ??= createRecoveryLinkReader();

  useEffect(() => {
    const read = readerRef.current!;
    const parsed = read({
      search: window.location.search,
      hash: window.location.hash,
    });

    if (parsed.kind === 'access_token') {
      tokenRef.current = { accessToken: parsed.accessToken };
    } else if (parsed.kind === 'token_hash') {
      tokenRef.current = { tokenHash: parsed.tokenHash };
    } else if (parsed.kind === 'code') {
      tokenRef.current = { code: parsed.code };
    }

    setLink(parsed);

    // Strip the credential from the visible URL once it is in memory. A
    // recovery access token is a bearer credential: left in the address bar it
    // rides along into browser history, and into the Referer header of any
    // outbound link on the page. replaceState avoids adding a history entry.
    if (isRecoveryCredential(parsed)) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Bounce to the login page once the password is changed, per the flow spec.
  useEffect(() => {
    if (!done) return;

    const timer = setTimeout(() => router.push('/auth/sign-in'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [done, router]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = createResetPasswordSchema(t).safeParse({
      password: String(formData.get('password') || ''),
      confirmPassword: String(formData.get('confirmPassword') || ''),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: parsed.data.password,
          ...tokenRef.current,
        }),
      });

      const data = await readJsonResponse<ApiErrorBody>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error?.message || t('errors.update'));
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.update'));
    } finally {
      setLoading(false);
    }
  };

  // First paint, before the effect has read the URL. Without this the "invalid
  // link" panel would flash for one frame on a perfectly good link.
  if (link === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
        <span className="sr-only">{t('status.checking')}</span>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </div>

        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {t('success.title')}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400" role="status">
          {t('success.description')}
        </p>

        {/* The auto-redirect is a convenience, never the only way out. */}
        <Link href="/auth/sign-in" className={`${AUTH_PRIMARY_BUTTON_CLASSES} mt-6`}>
          {t('actions.signIn')}
        </Link>
      </div>
    );
  }

  if (link.kind === 'error' || link.kind === 'missing') {
    // Three distinct situations, deliberately worded differently. Calling all of
    // them "Invalid reset link" was actively misleading for the third: it blames
    // a link that was never presented.
    //   expired — Supabase rejected it (aged out / already used)
    //   error   — Supabase rejected it for some other reason
    //   missing — no recovery data at all, i.e. the page was opened directly
    const expired = link.kind === 'error' && isExpiredRecoveryError(link.code);
    const missing = link.kind === 'missing';

    const heading = expired
      ? t('invalid.expiredTitle')
      : missing
        ? t('invalid.missingTitle')
        : t('invalid.title');

    const body = expired
      ? t('invalid.expiredDescription')
      : missing
        ? t('invalid.missingDescription')
        : t('invalid.description');

    return (
      <div>
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>

        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {heading}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400">{body}</p>

        <div className="mt-6 space-y-3">
          <Link href="/auth/forgot-password" className={AUTH_PRIMARY_BUTTON_CLASSES}>
            {t('actions.requestNew')}
          </Link>
          <Link
            href="/auth/sign-in"
            className="block w-full rounded-lg px-4 py-2 text-center text-[13px] font-medium text-slate-600 transition-colors hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:text-slate-400 dark:hover:text-brand-hover"
          >
            {t('actions.return')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {error ? <AuthErrorBanner message={error} /> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <PasswordField
          name="password"
          label={t('fields.password')}
          placeholder={t('placeholders.password')}
          autoComplete="new-password"
          showLabel={t('actions.showPassword')}
          hideLabel={t('actions.hidePassword')}
          error={fieldErrors.password}
        />

        <PasswordField
          name="confirmPassword"
          label={t('fields.confirmPassword')}
          placeholder={t('placeholders.confirmPassword')}
          autoComplete="new-password"
          showLabel={t('actions.showPassword')}
          hideLabel={t('actions.hidePassword')}
          error={fieldErrors.confirmPassword}
        />

        <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASSES}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.submit')}
        </button>
      </form>
    </div>
  );
}
