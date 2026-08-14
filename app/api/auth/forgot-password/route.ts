import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { ApiError } from "@/lib/http/errors";
import {
    authDebug,
    authDebugError,
    canExposeAuthErrors,
    maskEmail,
} from "@/lib/auth/auth-debug";

/**
 * Sends the password-reset email — POST /auth/v1/recover, the wire equivalent of
 * `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
 *
 * Nothing called this before: AuthService.requestPasswordReset and
 * gotrue.sendRecoveryEmail both existed but had no caller anywhere in the repo,
 * so no reset email was ever sent. This route is the missing caller.
 */
const forgotPasswordSchema = z.object({
    email: z.string().trim().pipe(z.email()),
});

const SENT_MESSAGE = "If an account exists for that address, a reset link is on its way.";

export async function POST(req: NextRequest) {
    // Parsing is kept outside the tolerant block below so a malformed body or a
    // non-email string still comes back as a real 400 the form can render. Only
    // the *send* is answered optimistically.
    let email: string;
    try {
        const body = await req.json();
        email = validateBody(forgotPasswordSchema, body).email.toLowerCase();
    } catch (error) {
        return jsonError(error);
    }

    // Must be absolute, and must appear in Supabase → Authentication → URL
    // Configuration → Redirect URLs. APP_URL wins over the request origin so
    // the link is still right behind a proxy or tunnel, where the incoming
    // origin is not the URL registered with Supabase.
    const origin = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const redirectTo = `${origin}/auth/reset-password`;

    // The port matters and is easy to get wrong: `next dev` silently moves to
    // 3001/3002 when 3000 is taken, but the emailed link is built from APP_URL,
    // so it would open a different server than the one being tested.
    if (req.nextUrl.origin !== origin) {
        authDebug("WARNING: APP_URL does not match the origin serving this request", {
            appUrl: origin,
            requestOrigin: req.nextUrl.origin,
            consequence: `the emailed link will point at ${origin}, not ${req.nextUrl.origin}`,
        });
    }

    try {
        authDebug("step 1/2: requesting recovery email", { email: maskEmail(email), redirectTo });

        await AuthService.requestPasswordReset(email, redirectTo);

        authDebug("step 2/2: done — Supabase accepted the request");
    } catch (error) {
        authDebugError("sending the recovery email", error);

        // Supabase's built-in mailer is capped at a few messages per hour per
        // project; that 429 is worth showing verbatim because it is actionable
        // and reveals nothing about whether the account exists.
        if (error instanceof ApiError && error.statusCode === 429) {
            return jsonError(error);
        }

        // Outside production the real error is returned, because a generic
        // "check your inbox" in response to a failed send makes the flow
        // impossible to debug from the UI — no email arrives and nothing says
        // why. In production the generic answer stands: distinguishing "sent"
        // from "no such user" would turn this into an account-existence oracle,
        // the same reasoning as the shared message in AuthService.signIn.
        if (canExposeAuthErrors()) {
            return jsonError(error);
        }

        console.error("[forgot-password]", error);
    }

    return jsonOk({ success: true, message: SENT_MESSAGE });
}
