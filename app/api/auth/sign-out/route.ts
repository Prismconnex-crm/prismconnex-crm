import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import { clearAuthCookies, readSupabaseTokens } from "@/lib/auth/session";

/**
 * Signs the user out.
 *
 * Two independent steps, in this order:
 *   1. Revoke the Supabase session (supabase.auth.signOut, scope=global) so the
 *      refresh token cannot be used again from anywhere.
 *   2. Expire every auth cookie, which ends the session for THIS app — the
 *      authoritative session is our own pcx_session cookie.
 *
 * Step 2 always runs, even when step 1 fails. A network blip talking to
 * Supabase must not leave the user holding a valid local session, and the
 * endpoint always reports 200: from the caller's perspective sign-out has
 * succeeded once the cookies are gone. `revoked` reports what actually happened
 * for observability without turning a partial failure into a blocked logout.
 */
export async function POST() {
    let revoked = false;

    try {
        const tokens = readSupabaseTokens();

        // No stored tokens means either a session created before this cookie
        // existed, or the dev mock sign-in — there is nothing to revoke.
        if (tokens) {
            revoked = await AuthService.signOut(tokens);
        }
    } catch (error) {
        // Never propagate: cookie clearing below is what actually signs the
        // user out, and it must happen regardless.
        console.error("[sign-out] Supabase revocation failed", error);
    }

    return clearAuthCookies(NextResponse.json({ ok: true, revoked }));
}
