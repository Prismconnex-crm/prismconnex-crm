'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import {
  AUTH_PRIMARY_BUTTON_CLASSES,
  AuthErrorBanner,
  AuthSuccessBanner,
} from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';
import { createForgotPasswordSchema, toFieldErrors } from '@/models/auth';

/**
 * Step 1 of the reset flow: collect the address and ask Supabase to email a
 * link.
 *
 * The page this replaces was a static card that said the feature was not
 * implemented — there was no input and no request, which is why no reset email
 * was ever sent.
 *
 * On success the form is swapped for a confirmation panel rather than left
 * on screen with a green banner. Re-submitting is a wasted send against
 * Supabase's per-hour mail cap, and the user's next action is in their inbox,
 * not here.
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = createForgotPasswordSchema(t).safeParse({
      email: String(formData.get('email') || ''),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t('errors.send'));
      }

      setSentTo(parsed.data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.send'));
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div>
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {t('sent.title')}
        </h1>

        {/*
          The address is echoed back because the most common failure here is a
          typo the user cannot otherwise see — they wait for mail that went to
          an address they never own.
        */}
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400">
          {t('sent.description', { email: sentTo })}
        </p>

        <p className="mt-4 text-[13px] text-slate-500 dark:text-slate-500">{t('sent.hint')}</p>

        <div className="mt-6 space-y-3">
          <Link
            href="/auth/sign-in"
            className={AUTH_PRIMARY_BUTTON_CLASSES}
          >
            {t('actions.return')}
          </Link>

          <button
            type="button"
            onClick={() => setSentTo('')}
            className="w-full rounded-lg px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:text-slate-400 dark:hover:text-brand-hover"
          >
            {t('actions.useDifferentEmail')}
          </button>
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
        <FormField
          name="email"
          type="email"
          label={t('fields.email')}
          placeholder={t('placeholders.email')}
          autoComplete="email"
          error={fieldErrors.email}
        />

        <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASSES}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.submit')}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/auth/sign-in"
          className="inline-flex items-center gap-1.5 rounded text-[13px] text-slate-600 transition-colors hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:text-slate-400 dark:hover:text-brand-hover"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t('actions.return')}
        </Link>
      </div>
    </div>
  );
}
