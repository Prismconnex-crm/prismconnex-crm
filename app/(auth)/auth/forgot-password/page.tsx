import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

/**
 * /auth/forgot-password
 *
 * Previously a static card explaining the feature was not implemented. It now
 * renders the real form; the page itself stays a server component so the shell
 * and its logo are server-rendered, with only the form shipping as client JS —
 * the same split /auth/sign-in uses.
 */
export const metadata: Metadata = {
  title: 'Forgot Password',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
