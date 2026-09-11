import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { ApiError } from "@/lib/http/errors";
import {
    clearVerificationWindow,
    getSecondsUntilExpiry,
    recordCodeSent,
    verificationKey,
    VERIFICATION_CODE_TTL_SECONDS,
} from "@/lib/auth/verification-window";
import {
    authDebug,
    authDebugError,
    canExposeAuthErrors,
    maskEmail,
} from "@/lib/auth/auth-debug";

/**
 * Issues a fresh verification code, and reports how long the current one has
 * left.
 *
 * Resending is refused while a code is still alive — the same instant the code
 * expires is the instant a new one may be requested, so the countdown on
 * /auth/verify and the resend button are two views of one server-side fact
 * rather than two timers that could drift apart.
 *
 * Neither response says whether the address has an account awaiting
 * confirmation: like /api/auth/forgot-password, answering differently per case
 * would turn this into an account-existence oracle.
 */
const emailSchema = z.object({
    email: z.string().trim().pipe(z.email()),
});

const SENT_MESSAGE = "If that address is awaiting confirmation, a new code is on its way.";

/**
 * How long the outstanding code has left, so a page load shows the true
 * remaining time instead of whatever the browser last remembered.
 *
 * This is what makes refreshing pointless: the number comes from the server, and
 * a client that ignores it still has to get past the same check in
 * /api/auth/verify. It discloses only whether a code was issued for this address
 * in the last 90 seconds — which a resend attempt already reveals through its
 * 429 — so it is not a new disclosure.
 */
export async function GET(req: NextRequest) {
    try {
        const { email } = validateQuery(emailSchema, {
            email: req.nextUrl.searchParams.get("email") ?? "",
        });

        return jsonOk({
            expiresInSeconds: getSecondsUntilExpiry(verificationKey(email)),
            ttlSeconds: VERIFICATION_CODE_TTL_SECONDS,
        });
    } catch (error) {
        return jsonError(error);
    }
}

export async function POST(req: NextRequest) {
    // Parsed outside the tolerant block below so a malformed body still comes
    // back as a real 400 the form can render.
    let email: string;
    try {
        const body = await req.json();
        email = validateBody(emailSchema, body).email.toLowerCase();
    } catch (error) {
        return jsonError(error);
    }

    const key = verificationKey(email);
    const remaining = getSecondsUntilExpiry(key);

    if (remaining > 0) {
        authDebug("resend refused: the current code has not expired yet", {
            email: maskEmail(email),
            retryAfterSeconds: remaining,
        });

        return jsonError(
            new ApiError(`Please wait ${remaining}s before requesting another code.`, 429, {
                retryAfterSeconds: remaining,
            })
        );
    }

    // The window opens before the send, not after: two clicks racing each other
    // would otherwise both pass the check above and mail two codes.
    recordCodeSent(key);

    try {
        authDebug("resending verification code", { email: maskEmail(email) });

        await AuthService.resendVerification(email);

        authDebug("done — Supabase accepted the resend request");
    } catch (error) {
        authDebugError("resending the verification code", error);

        // Supabase's own per-project email cap. Worth showing verbatim: it is
        // actionable and reveals nothing about whether the account exists. The
        // window stays open in this one case — mail may well have gone out.
        if (error instanceof ApiError && error.statusCode === 429) {
            return jsonError(error);
        }

        // Nothing was sent, so the window opened above would only lock the user
        // out of retrying a failure that was not theirs.
        clearVerificationWindow(key);

        // Outside production the real error is returned — a generic "check your
        // inbox" after a failed send makes the flow impossible to debug from the
        // UI, since no email arrives and nothing says why.
        if (canExposeAuthErrors()) {
            return jsonError(error);
        }

        console.error("[resend-verification]", error);
    }

    return jsonOk({
        success: true,
        message: SENT_MESSAGE,
        expiresInSeconds: VERIFICATION_CODE_TTL_SECONDS,
    });
}
