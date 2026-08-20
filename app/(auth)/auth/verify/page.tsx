import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { VerifyForm } from '@/components/auth/verify-form';

/**
 * /auth/verify — where sign-up sends the user when the project has email
 * confirmation switched on.
 *
 * Previously this file was a client component that rendered its own full-page
 * card, which left it as the last auth route still on the pre-AuthShell design.
 * It now matches /auth/forgot-password and /auth/reset-password: a server
 * component for the shell and its logo, with only the form shipping as client
 * JS.
 */
export const metadata: Metadata = {
  title: 'Verify Email',
};

export default function VerifyPage() {
  return (
    <AuthShell>
      <VerifyForm />
    </AuthShell>
  );
}
