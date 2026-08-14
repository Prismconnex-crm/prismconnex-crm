import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

/**
 * /auth/reset-password — the destination of the link in the recovery email.
 *
 * This is the URL passed as `redirect_to` by /api/auth/forgot-password, so it
 * must also be listed under Authentication → URL Configuration → Redirect URLs
 * in the Supabase dashboard, or Supabase substitutes the project Site URL and
 * the link lands on the home page instead.
 *
 * No Suspense boundary is needed even though the form reads the URL: it uses
 * window.location in an effect rather than useSearchParams, which is required
 * anyway because the stock email template returns the token in the fragment and
 * useSearchParams cannot see fragments.
 */
export const metadata: Metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
