'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Server } from 'lucide-react';
import {
  AuthCard,
  AuthDivider,
  AuthErrorBanner,
  AuthSuccessBanner,
} from '@/components/auth/auth-card';
import { GoogleIcon, MicrosoftIcon } from '@/components/auth/brand-icons';
import { FormField, PasswordField } from '@/components/auth/form-field';
import { createSignInSchema, toFieldErrors } from '@/models/auth';
import { localizePathname } from '@/lib/locale';
import type { Locale } from '@/types';

export default function SignInPage() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations('auth.signIn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Two redirects land here with a query flag: /auth/callback on a failed
  // Google/Microsoft sign-in (?error=<reason>), and the topbar's Sign Out
  // (?signedOut=1). Read from location rather than useSearchParams so the page
  // needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError(t('errors.signIn'));
    if (params.get('signedOut')) setNotice(t('status.signedOut'));
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t('errors.signIn'));
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

  // Google / Microsoft sign-in via Supabase. A full navigation (not fetch) is
  // required: the route responds with a redirect to the provider's consent
  // screen, and it sets the httpOnly PKCE cookie the callback needs.
  const handleOAuthLogin = (provider: 'google' | 'microsoft') => {
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  const handleCognitoLogin = async () => {
    try {
      const res = await fetch('/api/auth/cognito-url');
      if (res.redirected) {
        window.location.href = res.url;
      }
    } catch {
      setError(t('errors.cognito'));
    }
  };

  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('actions.signUpPrompt')}{' '}
          <Link
            href="/auth/sign-up"
            className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
          >
            {t('actions.signUpLink')}
          </Link>
        </>
      }
    >
      {notice ? <AuthSuccessBanner message={notice} /> : null}
      {error ? <AuthErrorBanner message={error} /> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          name="email"
          label={t('fields.identifier')}
          placeholder={t('placeholders.identifier')}
          autoComplete="username"
          defaultValue="owner@prismconnex.demo"
          error={fieldErrors.email}
        />

        <PasswordField
          name="password"
          label={t('fields.secret')}
          placeholder={t('placeholders.secret')}
          autoComplete="current-password"
          defaultValue="Prism123!"
          showLabel={t('actions.showPassword')}
          hideLabel={t('actions.hidePassword')}
          error={fieldErrors.password}
        />

        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-[13px] text-slate-400 transition-colors hover:text-indigo-400"
          >
            {t('actions.forgotPassword')}
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111B2E] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.submit')}
        </button>
      </form>

      <AuthDivider label={t('actions.divider')} />

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#22304A] bg-[#0F1829] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-[#2C3B57] hover:bg-[#16223A] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <GoogleIcon />
          {t('actions.google')}
        </button>

        <button
          type="button"
          onClick={() => handleOAuthLogin('microsoft')}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#22304A] bg-[#0F1829] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-[#2C3B57] hover:bg-[#16223A] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <MicrosoftIcon />
          {t('actions.microsoft')}
        </button>

        <button
          type="button"
          onClick={handleCognitoLogin}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#22304A] bg-[#0F1829] px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:border-[#2C3B57] hover:bg-[#16223A] hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <Server className="h-4 w-4" />
          {t('actions.cognito')}
        </button>
      </div>
    </AuthCard>
  );
}
