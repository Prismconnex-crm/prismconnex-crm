'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AUTH_PRIMARY_BUTTON_CLASSES, AuthErrorBanner } from '@/components/auth/auth-card';
import { FormField, PasswordField } from '@/components/auth/form-field';
import { useCompanyDetection } from '@/components/auth/use-company-detection';
import { createSignUpSchema, toFieldErrors } from '@/models/auth';
import { readJsonResponse, type ApiErrorBody } from '@/lib/http/read-json';

/**
 * Sign-up form.
 *
 * Lifted out of `app/(auth)/auth/sign-up/page.tsx` unchanged so it can render
 * as a tab panel next to the sign-in form. Validation, the POST body and the
 * verify-vs-sign-in redirect are untouched.
 *
 * The Company Name field added for email-domain detection is deliberately
 * outside all of that: it is not parsed by createSignUpSchema and not included
 * in the POST body, because public.profiles has no column to store it in.
 */
export function SignUpForm() {
  const router = useRouter();
  const t = useTranslations('auth.signUp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const company = useCompanyDetection();

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

      const data = await readJsonResponse<ApiErrorBody & { emailConfirmationRequired?: boolean }>(
        res
      );
      if (!res.ok || !data) {
        throw new Error(data?.error?.message || t('errors.signUp'));
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
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-[#111827] dark:text-white sm:text-2xl">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      </div>

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
          onChange={company.onEmailChange}
          onBlur={company.onEmailBlur}
        />

        {/*
          Filled from the email domain when a company matches, blank when none
          does, and editable either way. Sits directly under the email field so
          the value appearing has a visible cause.
        */}
        <FormField
          name="companyName"
          label={t('fields.companyName')}
          placeholder={t('placeholders.companyName')}
          optionalLabel={t('fields.optional')}
          autoComplete="organization"
          value={company.companyName}
          onChange={company.onCompanyNameChange}
          busy={company.detecting}
          hint={company.autoFilled ? t('hints.companyDetected') : undefined}
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
          className={AUTH_PRIMARY_BUTTON_CLASSES}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('actions.submit')}
        </button>
      </form>
    </div>
  );
}
