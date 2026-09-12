import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getSessionPayload } from "@/lib/auth/session";
import { EXPIRED_SESSION_SIGN_IN_HREF } from "@/lib/auth/routing";
import { ProfileService } from "@/services/profile.service";

/**
 * Server-side guard for every CRM route under /app.
 *
 * middleware.ts only checks that the pcx_session cookie is PRESENT — it never
 * verifies it, so any non-empty value would previously get the authenticated
 * shell rendered (the data APIs would still 401, but the UI would load).
 * getSessionPayload() verifies the HS256 signature and expiry, so a cleared,
 * forged or expired cookie lands on the sign-in page instead.
 *
 * The redirect target carries the sessionExpired flag rather than being a bare
 * /auth/sign-in. Without it middleware sees a present cookie, bounces sign-in
 * back to /app/dashboard, and this guard bounces it here again — an infinite
 * redirect that made the app unreachable for anyone holding an expired session
 * until they cleared cookies by hand. The flag both renders the form and tells
 * middleware to expire the dead cookie.
 *
 * This runs on the server for every /app navigation, which is also what stops a
 * signed-out user from reaching the app with the browser's back button.
 *
 * The profile is resolved here rather than fetched from the client so the
 * topbar renders the real user on first paint, with no flash of a placeholder.
 * It is null for legacy sessions whose `sub` is not a Supabase user id.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionPayload();

  if (!session) {
    redirect(EXPIRED_SESSION_SIGN_IN_HREF);
  }

  // A profile lookup failure must not take the whole shell down. This layout
  // wraps every /app route, so an unhandled throw here renders the error
  // boundary instead of the CRM — which is what a slow or unreachable database
  // (connection timeout, pooler saturation) used to do to every page at once.
  // The null branch below already renders a usable topbar from the session
  // alone, so degrading into it keeps the app navigable while the database is
  // recovering. Only the name/avatar are missing.
  let profile = null;
  try {
    profile = await ProfileService.getByUserId(session.sub as string);
  } catch (error) {
    console.error("[app-layout] profile lookup failed, rendering session-only shell", error);
  }

  return (
    <AppShell
      user={
        profile
          ? {
              name: [profile.firstName, profile.middleName, profile.lastName]
                .filter(Boolean)
                .join(" "),
              email: profile.email,
              avatarUrl: profile.avatarUrl,
            }
          : {
              name: null,
              email: (session.email as string) ?? null,
              avatarUrl: null,
            }
      }
    >
      {children}
    </AppShell>
  );
}
