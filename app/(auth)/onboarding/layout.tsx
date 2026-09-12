import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth/session";
import { EXPIRED_SESSION_SIGN_IN_HREF } from "@/lib/auth/routing";

/**
 * Server-side guard for /onboarding.
 *
 * The page itself is a client component, so it had no way to verify the session
 * — middleware.ts only checks that the pcx_session cookie exists. POST
 * /api/onboarding already rejects an invalid session, so no workspace could be
 * created, but the page still rendered for a signed-out visitor.
 *
 * A layout is the smallest place to add the check without converting the page
 * to a server component.
 *
 * The sessionExpired target matches app/(app)/app/layout.tsx: a bare
 * /auth/sign-in would be bounced back here by middleware while the dead cookie
 * is still set, which is an infinite redirect rather than a sign-in page.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionPayload();

  if (!session) {
    redirect(EXPIRED_SESSION_SIGN_IN_HREF);
  }

  return <>{children}</>;
}
