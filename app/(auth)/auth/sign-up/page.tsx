import { AuthLanding } from '@/components/auth/auth-landing';

/**
 * Auth landing page, Sign Up tab active.
 *
 * The route is kept (rather than redirected to `/auth/sign-in`) so existing
 * links and bookmarks to `/auth/sign-up` open straight on the sign-up form.
 * Switching tabs from here does not navigate.
 */
export default function SignUpPage() {
  return <AuthLanding defaultTab="signup" />;
}
