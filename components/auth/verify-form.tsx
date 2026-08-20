'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AUTH_PRIMARY_BUTTON_CLASSES, AuthErrorBanner } from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';

/**
 * Step 2 of sign-up: exchange the emailed OTP for a confirmed account.
 *
 * Only the presentation changed when this moved out of
 * `app/(auth)/auth/verify/page.tsx`. It used to render its own centred card on
 * `bg-slate-50` / `dark:bg-slate-950`, with hand-rolled inputs and a
 * `bg-blue-600` button — the design every auth page used before `AuthShell`.
 * Sign-in, sign-up, forgot-password and reset-password had all been migrated;
 * this one had not, so the middle of the signup funnel dropped the user into
 * what looked like a different product, with a second blue that was not the
 * `brand` token.
 *
 * The request, the error handling and the post-verify redirect are unchanged.
 */
export function VerifyForm() {
  const router = useRouter();
  const t = useTranslations('auth.verify');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // `?email=` is supplied by the sign-up form so the address need not be
  // retyped. Read from `location` in an effect rather than with
  // useSearchParams so this page needs no Suspense boundary — the same trade
  // sign-in-form makes. The field is controlled for exactly this reason: a
  // `defaultValue` cannot be filled in after mount.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('email');
    if (value) setEmail(value);
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get('email');
    const code = formData.get('code');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t('errors.verify'));
      }

      // Read by sign-in-form, which shows the "email verified" banner.
      router.push('/auth/sign-in?verified=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.verify'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {error ? <AuthErrorBanner message={error} /> : null}

      {/*
        No `noValidate` here, unlike the other auth forms. They each mirror a
        server schema from models/auth.ts to render inline field errors; verify
        has no such schema, so the browser's own required-field check is what
        stops an empty submit. Adding one would mean new validation strings in
        all nine locale files for no behaviour the user would notice.
      */}
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          name="email"
          type="email"
          label={t('fields.email')}
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <FormField
          name="code"
          label={t('fields.code')}
          placeholder={t('placeholders.code')}
          autoComplete="one-time-code"
          required
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
