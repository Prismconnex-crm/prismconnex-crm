import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getSessionPayload } from "@/lib/auth/session";
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
    redirect("/auth/sign-in");
  }

  const profile = await ProfileService.getByUserId(session.sub as string);

  return (
    <AppShell
      user={
        profile
          ? {
              name: [profile.firstName, profile.middleName, profile.lastName]
                .filter(Boolean)
                .join(" "),
              email: profile.email,
            }
          : { name: null, email: (session.email as string) ?? null }
      }
    >
      {children}
    </AppShell>
  );
}
