'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AuthCard, AuthErrorBanner } from '@/components/auth/auth-card';
import { FormField, PasswordField } from '@/components/auth/form-field';
import { createSignUpSchema, toFieldErrors } from '@/models/auth';

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations('auth.signUp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // `disabled={loading}` only takes effect on the next render, so a fast
  // double-click or a held Enter key can fire two submits in the same tick.
  // Each extra submit costs one Supabase confirmation email, and the built-in
  // email service allows only a few per hour. This ref closes the gap
  // synchronously; it does not change the sign-up flow itself.
  const submittingRef = useRef(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    setError('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const parsed = createSignUpSchema(t).safeParse({
      firstName: String(formData.get('firstName') || ''),
      middleName: String(formData.get('middleName') || ''),
      lastName: String(formData.get('lastName') || ''),
      email: String(formData.get('email') || ''),
      phone: String(formData.get('phone') || ''),
      password: String(formData.get('password') || ''),
      confirmPassword: String(formData.get('confirmPassword') || ''),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    const { firstName, middleName, lastName, email, phone, password } = parsed.data;

    try {
      // The name is sent as three discrete fields because public.profiles
      // stores first/middle/last separately, and `phone` is now persisted too.
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, middleName, lastName, email, phone, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t('errors.signUp'));
      }

      // Supabase only emails a confirmation code when email confirmation is
      // enabled for the project; otherwise the verify step has nothing to do.
      if (data.emailConfirmationRequired === false) {
        router.push('/auth/sign-in');
      } else {
        router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.signUp'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('actions.signInPrompt')}{' '}
          <Link
            href="/auth/sign-in"
            className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
          >
            {t('actions.signInLink')}
          </Link>
        </>
      }
    >
      {error ? <AuthErrorBanner message={error} /> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="firstName"
            label={t('fields.firstName')}
            autoComplete="given-name"
            error={fieldErrors.firstName}
          />
          <FormField
            name="lastName"
            label={t('fields.lastName')}
            autoComplete="family-name"
            error={fieldErrors.lastName}
          />
        </div>

        <FormField
          name="middleName"
          label={t('fields.middleName')}
          optionalLabel={t('fields.optional')}
          autoComplete="additional-name"
          error={fieldErrors.middleName}
        />

        <FormField
          name="email"
          label={t('fields.email')}
          type="email"
          placeholder={t('placeholders.email')}
          autoComplete="email"
          error={fieldErrors.email}
        />

        <FormField
          name="phone"
          label={t('fields.phone')}
          type="tel"
          placeholder={t('placeholders.phone')}
          autoComplete="tel"
          error={fieldErrors.phone}
        />

        <PasswordField
          name="password"
          label={t('fields.password')}
          autoComplete="new-password"
          showLabel={t('actions.showPassword')}
          hideLabel={t('actions.hidePassword')}
          error={fieldErrors.password}
        />

        <PasswordField
          name="confirmPassword"
          label={t('fields.confirmPassword')}
          autoComplete="new-password"
          showLabel={t('actions.showPassword')}
          hideLabel={t('actions.hidePassword')}
          error={fieldErrors.confirmPassword}
        />

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111B2E] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
