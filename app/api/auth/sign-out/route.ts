import { NextResponse } from "next/server";
import { AuthService, isSignOutScope, type SignOutScope } from "@/services/auth.service";
import { clearAuthCookies, readSupabaseTokens } from "@/lib/auth/session";

/**
 * Reads the requested scope from the body.
 *
 * Defaults to "global" for anything unreadable or unrecognised, which keeps the
 * pre-existing contract intact: this route was global-only, and a caller that
 * posts no body at all must keep getting exactly what it used to. Falling back
 * to "local" instead would silently downgrade those callers and leave sessions
 * alive on other devices.
 */
async function readScope(request: Request): Promise<SignOutScope> {
    try {
        const body = (await request.json()) as unknown;
        const scope = (body as { scope?: unknown } | null)?.scope;
        return isSignOutScope(scope) ? scope : "global";
    } catch {
        // No body, or not JSON — both mean "the caller did not choose".
        return "global";
    }
}

/**
 * Signs the user out.
 *
 * Two independent steps, in this order:
 *   1. Revoke the Supabase session (supabase.auth.signOut) so the refresh token
 *      cannot be used again. `scope` decides how far that reaches:
 *        - "local"  → only this device's session ("Sign out from this device")
 *        - "global" → every session the user holds ("Sign out from all devices")
 *   2. Expire every auth cookie, which ends the session for THIS app — the
 *      authoritative session is our own pcx_session cookie.
 *
 * Step 2 always runs at either scope, including "local": the browser making
 * this request IS the device being signed out, so its cookies must go either
 * way. A network blip talking to Supabase must not leave the user holding a
 * valid local session, and the endpoint always reports 200: from the caller's
 * perspective sign-out has succeeded once the cookies are gone. `revoked`
 * reports what actually happened for observability without turning a partial
 * failure into a blocked logout.
 */
export async function POST(request: Request) {
    const scope = await readScope(request);
    let revoked = false;

    try {
        const tokens = readSupabaseTokens();

        // No stored tokens means either a session created before this cookie
        // existed, or the dev mock sign-in — there is nothing to revoke.
        if (tokens) {
            revoked = await AuthService.signOut(tokens, scope);
        }
    } catch (error) {
        // Never propagate: cookie clearing below is what actually signs the
        // user out, and it must happen regardless.
        console.error("[sign-out] Supabase revocation failed", error);
    }

    return clearAuthCookies(NextResponse.json({ ok: true, revoked, scope }));
}
