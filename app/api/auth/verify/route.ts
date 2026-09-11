import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { BadRequestError } from "@/lib/http/errors";
import {
    clearVerificationWindow,
    EXPIRED_CODE_MESSAGE,
    isCodeStillValid,
    verificationKey,
} from "@/lib/auth/verification-window";

const verifySchema = z.object({
    email: z.string().trim().pipe(z.email()),
    code: z.string().trim().min(6),
});

/**
 * Confirms a signup with the OTP Supabase emails.
 *
 * Supabase returns a session here, but we deliberately do NOT set the session
 * cookie: the verify page redirects to /auth/sign-in?verified=true, and
 * middleware.ts bounces an already-signed-in user off /auth/sign-in to the
 * dashboard. Setting a cookie would skip the sign-in step the UI expects.
 *
 * The response shape is unchanged from the Cognito version.
 *
 * ## The 90-second expiry
 *
 * This is where it is enforced, and it is enforced by refusing to forward the
 * code rather than by anything the browser does. A code older than 90 seconds
 * never reaches Supabase, so no amount of refreshing, clock-tampering or
 * hand-crafted POSTing can spend it — the countdown on the page is a display of
 * this check, not a substitute for it.
 *
 * Supabase's own OTP expiry (a project-wide dashboard setting, one hour by
 * default) still applies underneath and is the longer of the two; see
 * lib/auth/verification-window.ts for why the short window cannot live there.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(verifySchema, body);

        const key = verificationKey(data.email);

        // Checked before the Supabase call, so an expired code is rejected on
        // its own terms — a correct-but-stale code and a wrong code must not
        // produce the same message, or the user retypes a code that can never
        // work. An address with no record on file lands here too: freshness we
        // cannot prove is treated as expired rather than waved through.
        if (!isCodeStillValid(key)) {
            throw new BadRequestError(EXPIRED_CODE_MESSAGE);
        }

        await AuthService.verify(data.email, data.code);

        // Spent. Clearing it also releases the resend lock, so the address is
        // not left counting down on a page the user has already left.
        clearVerificationWindow(key);

        return jsonOk({ success: true, message: "Email verified successfully." });
    } catch (error) {
        return jsonError(error);
    }
}
