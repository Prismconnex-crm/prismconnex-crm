import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth/session";

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
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionPayload();

  if (!session) {
    redirect("/auth/sign-in");
  }

  return <>{children}</>;
}
