'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  AUTH_PRIMARY_BUTTON_CLASSES,
  AuthDivider,
  AuthErrorBanner,
  AuthSuccessBanner,
} from '@/components/auth/auth-card';
import { GoogleIcon, MicrosoftIcon } from '@/components/auth/brand-icons';
import { FormField, PasswordField } from '@/components/auth/form-field';
import { createSignInSchema, toFieldErrors } from '@/models/auth';
import { resolveOAuthErrorCode } from '@/lib/auth/oauth-errors';
import { readJsonResponse, type ApiErrorBody } from '@/lib/http/read-json';
import { localizePathname } from '@/lib/locale';
import type { Locale } from '@/types';

/**
 * Sign-in form.
 *
 * Lifted out of `app/(auth)/auth/sign-in/page.tsx` unchanged so the landing
 * page can render it and the sign-up form as sibling tab panels. The
 * validation, the request, the OAuth hand-off and the post-sign-in redirect
 * are all exactly as they were.
 *
 * `onSwitchToSignUp` is supplied by `AuthLanding`, which owns the tab state.
 * The "Sign Up" affordance at the bottom has to flip that state rather than
 * navigate, so the choice cannot be made here — hence the prop.
 */
export function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations('auth.signIn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Second-factor step. Only ever true for accounts with a verified TOTP
  // factor; the password step is untouched for everyone else.
  //
  // Also raised by ?mfa=1, which is how the OAuth callback hands over: it has
  // already verified the provider identity and parked the pending session in
  // an httpOnly cookie, so the user must land straight on the code field
  // rather than being asked for a password they may not even have. Set in the
  // effect below, from location, for the same no-Suspense reason as ?error.
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  // Four redirects land here with a query flag: /api/auth/oauth/[provider]
  // when the hand-off cannot even be started (?error=provider_disabled
  // &provider=google), /auth/callback on a failed Google/Microsoft sign-in
  // /auth/verify after a confirmed signup (?verified=true), and the topbar's
  // Sign Out (?signedOut=1). Read from
  // location rather than useSearchParams so the page needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawError = params.get('error');

    // The OAuth callback redirects here with ?mfa=1 when the account has a
    // verified TOTP factor; the pending sign-in is already in an httpOnly
    // cookie and only the code is missing.
    if (params.get('mfa') === '1') setMfaRequired(true);

    if (rawError) {
      // Every OAuth failure used to collapse into "Failed to sign in", which
      // gave no way to tell a provider that is switched off in the Supabase
      // dashboard from a consent the user cancelled from an expired tab. The
      // code is normalised against a closed list first — it comes from the URL,
      // so it must never index the message table directly.
      const code = resolveOAuthErrorCode(rawError);
      const provider = params.get('provider');

      // The provider's own wording is server-side only (see the callback
      // route), so surface at least the raw code here — it is what turns
      // "it doesn't work" into something searchable.
      console.error('[OAuth] sign-in failed:', { error: rawError, provider, code });

      setError(
        t(`errors.oauth.${code}`, {
          provider: provider === 'microsoft' ? 'Microsoft' : provider === 'google' ? 'Google' : '',
        })
      );
    }

    // /auth/verify redirects here after the OTP is accepted. The flag was
    // being written but never read, so a user who had just confirmed their
    // email landed on a blank sign-in form with nothing to say it had worked.
    // else-if because the two are alternatives: only one notice slot exists.
    if (params.get('verified')) setNotice(t('status.verified'));
    else if (params.get('signedOut')) setNotice(t('status.signedOut'));
  }, [t]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = createSignInSchema(t).safeParse({
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setLoading(false);
      return;
    }

    const { email, password } = parsed.data;

    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await readJsonResponse<
        ApiErrorBody & { onboarded?: boolean; mfaRequired?: boolean }
      >(res);
      if (!res.ok || !data) {
        throw new Error(data?.error?.message || t('errors.signIn'));
      }

      // Accounts with 2FA get a second step instead of a session. The server
      // has parked the half-finished sign-in in an httpOnly cookie; this form
      // just swaps to the code field. Accounts without 2FA never see this.
      if (data.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // ONBOARDING DISABLED — go straight to the dashboard after sign-in.
      // TO RE-ENABLE: restore the commented line below. `data.onboarded` is
      // supplied by the sign-in API and reflects real workspace membership;
      // routing an already-onboarded user to /onboarding creates a 2nd workspace.
      router.push('/app/dashboard');
      // router.push(data.onboarded ? '/app/dashboard' : localizePathname('/onboarding', locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.signIn'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Second step for 2FA accounts.
   *
   * Nothing about the password is re-sent — the server holds the verified
   * half of the sign-in in an httpOnly cookie, so this request carries only
   * the code. A rejection sends the user back to the password step because
   * the Supabase challenge is single-use and cannot be retried.
   */
  const onSubmitMfa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/mfa-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });

      const data = await readJsonResponse<ApiErrorBody & { onboarded?: boolean }>(res);
      if (!res.ok || !data) {
        setMfaRequired(false);
        setMfaCode('');
        throw new Error(data?.error?.message || t('errors.signIn'));
      }

      router.push('/app/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.signIn'));
    } finally {
      setLoading(false);
    }
  };

  // Google / Microsoft sign-in via Supabase. A full navigation (not fetch) is
  // required: the route responds with a redirect to the provider's consent
  // screen, and it sets the httpOnly PKCE cookie the callback needs.
  const handleOAuthLogin = (provider: 'google' | 'microsoft') => {
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {notice ? <AuthSuccessBanner message={notice} /> : null}
      {error ? <AuthErrorBanner message={error} /> : null}

      {mfaRequired ? (
        <form onSubmit={onSubmitMfa} noValidate className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#22304A] dark:bg-[#101C2E]">
            <p className="text-[13px] font-semibold text-[#111827] dark:text-white">
              Two-factor authentication
            </p>
            <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">
              Enter the 6-digit code from your authenticator app to finish signing in.
            </p>
          </div>

          <div>
            <label
              htmlFor="mfa-code"
              className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300"
            >
              Authentication code
            </label>
            <input
              id="mfa-code"
              name="mfaCode"
              value={mfaCode}
              onChange={(event) =>
                setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              // inputMode + autoComplete are what make this usable on a phone:
              // the numeric keypad opens directly and the OS offers the code
              // it has just seen in the authenticator app.
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              aria-describedby="mfa-help"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-center text-[18px] font-semibold tracking-[0.4em] text-[#111827] placeholder:tracking-[0.4em] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-[#22304A] dark:bg-[#0F1729] dark:text-white"
            />
            <p id="mfa-help" className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">
              Codes refresh about every 30 seconds.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || mfaCode.length !== 6}
            className="h-11 w-full rounded-lg bg-brand text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Verifying…' : 'Verify and sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaRequired(false);
              setMfaCode('');
              setError('');
            }}
            className="w-full text-center text-[13px] font-medium text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Use a different account
          </button>
        </form>
      ) : (
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          name="email"
          label={t('fields.identifier')}
          placeholder={t('placeholders.identifier')}
          autoComplete="username"
          error={fieldErrors.email}
        />

        <PasswordField
          name="password"
          label={t('fields.secret')}
          placeholder={t('placeholders.secret')}
          autoComplete="current-password"
          showLabel={t('actions.showPassword')}
          hideLabel={t('actions.hidePassword')}
          error={fieldErrors.password}
        />

        {/*
          One row under the password field, directly above the Sign In button:
          Forgot Password on the left, the sign-up prompt on the right.

          `flex-wrap` + `gap-y-2` rather than a fixed row because the two labels
          together measure ~310px and the form column is only ~288px wide on a
          320px phone — below that the prompt drops to its own line instead of
          colliding. From 375px up they share the row.
        */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            href="/auth/forgot-password"
            className="text-[13px] text-slate-600 transition-colors hover:text-brand dark:text-slate-400 dark:hover:text-brand-hover"
          >
            {t('actions.forgotPassword')}
          </Link>

          {/*
            A <button>, not a <Link>: Login and Sign Up are tab panels on this
            same page, so this flips `AuthLanding`'s tab state instead of
            navigating. `AuthLanding` mirrors the URL to /auth/sign-up with
            history.replaceState, so the address bar still ends up correct
            without a page load.

            `type="button"` matters more here than it did below the social
            buttons — this now sits inside the <form>, so the default
            type="submit" would fire a sign-in attempt on click.
          */}
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            {t('actions.signUpPrompt')}{' '}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              // `text-brand` (#005C9D) is 6.96:1 on the white light-mode
              // column, but only 2.77:1 on the #0A0E1A dark one — under the
              // 4.5:1 AA floor for text this size. Dark mode therefore uses the
              // lighter `brand-hover` (#0086E6, 5.09:1). The solid buttons and
              // tabs need no such split: white-on-brand is 6.96:1 in both
              // themes.
              className="rounded font-semibold text-brand transition-colors hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:text-brand-hover dark:hover:text-brand-hover/80"
            >
              {t('actions.signUpLink')}
            </button>
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={AUTH_PRIMARY_BUTTON_CLASSES}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.submit')}
        </button>
      </form>
      )}

      {/* Hidden during the code step: the password half of this sign-in is
          already verified and parked server-side, so offering a different
          sign-in method there would abandon it mid-flight rather than
          continue it. */}
      {mfaRequired ? null : (
      <>
      <AuthDivider label={t('actions.divider')} />

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-[#22304A] dark:bg-[#0F1829] dark:text-slate-200 dark:hover:border-[#2C3B57] dark:hover:bg-[#16223A]"
        >
          <GoogleIcon />
          {t('actions.google')}
        </button>

        <button
          type="button"
          onClick={() => handleOAuthLogin('microsoft')}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-[#22304A] dark:bg-[#0F1829] dark:text-slate-200 dark:hover:border-[#2C3B57] dark:hover:bg-[#16223A]"
        >
          <MicrosoftIcon />
          {t('actions.microsoft')}
        </button>
      </div>
      </>
      )}
    </div>
  );
}
