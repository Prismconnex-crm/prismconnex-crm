'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, Loader2, Server } from 'lucide-react';
import { getLocaleNativeLabel, localeDetails, localizePathname } from '@/lib/locale';
import type { Locale } from '@/types';

export default function SignInPage() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations('auth.signIn');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

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
      // TO RE-ENABLE: swap the line below back to '/onboarding'.
      router.push('/app/dashboard');
      // router.push(localizePathname('/onboarding', locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.signIn'));
    } finally {
      setLoading(false);
    }
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0e1a]">
      <div className="relative hidden overflow-hidden p-10 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="absolute left-[10%] top-[15%] h-72 w-72 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[5%] h-80 w-80 rounded-full bg-purple-600/10 blur-[140px]" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white shadow-sm">
              <Image
                src="/prismconnex-logo.jpeg"
                alt="Prismconnex"
                fill
                sizes="40px"
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide text-slate-900 dark:text-white">
                Prism<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 font-extrabold inline-block">connex</span>
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('brandSubtitle')}</p>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-slate-900 dark:text-white">
            {t('heroTitleLine1')}
            <br />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {t('heroTitleLine2')}
            </span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {t('heroDescription')}
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
              {t('heroBadges.aiPowered')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <Globe className="h-3 w-3" />
              {t('heroBadges.languages', { count: localeDetails.length })}
            </span>
          </div>
        </div>

        <div className="relative z-10" />
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('title')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t('fields.email')}
              </label>
              <input
                name="email"
                type="email"
                defaultValue="owner@prismconnex.demo"
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t('fields.password')}
              </label>
              <input
                name="password"
                type="password"
                defaultValue="Prism123!"
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('actions.submit')}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">{t('actions.divider')}</span>
            </div>
          </div>

          <button
            onClick={handleCognitoLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:outline-none"
          >
            <Server className="h-4 w-4" />
            {t('actions.cognito')}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <Link href="/auth/forgot-password" className="transition-colors hover:text-slate-300">
              {t('actions.forgotPassword')}
            </Link>
            <Link href="/auth/sign-up" className="transition-colors hover:text-slate-300">
              {t('actions.createAccount')}
            </Link>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {t('footer.language', { language: getLocaleNativeLabel(locale) })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Server className="h-3 w-3" />
              {t('footer.region', { region: 'US-East' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
