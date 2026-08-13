import { AuthLanding } from '@/components/auth/auth-landing';

/**
 * Auth landing page, Login tab active.
 *
 * The form itself lives in `components/auth/sign-in-form.tsx`; this route is
 * only the entry point that decides which tab opens first. `/auth/sign-up`
 * renders the same component with the Sign Up tab selected.
 */
export default function SignInPage() {
  return <AuthLanding defaultTab="login" />;
}
