import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { authDebug, authDebugError, maskToken } from "@/lib/auth/auth-debug";

/**
 * Sets the new password using the token from the recovery email —
 * `supabase.auth.updateUser({ password })` over the REST API.
 *
 * The client sends whichever token its link carried (see
 * lib/auth/recovery-link.ts); the service turns both into an access token and
 * issues the same PUT /auth/v1/user either way.
 *
 * No session cookie is set here, deliberately, matching /api/auth/verify: the
 * flow ends by sending the user to /auth/sign-in to log in with the new
 * password, and middleware.ts redirects an already-signed-in visitor off that
 * page to the dashboard. Signing them in here would skip the sign-in step the
 * UI promises — and confirming the new password actually works is the point.
 */
const resetPasswordSchema = z
    .object({
        // Mirrors the sign-up rule in app/api/auth/sign-up/route.ts so a password
        // set here is never one that sign-up would have rejected.
        password: z.string().min(8),
        tokenHash: z.string().trim().min(1).optional(),
        accessToken: z.string().trim().min(1).optional(),
        code: z.string().trim().min(1).optional(),
    })
    .refine((data) => Boolean(data.tokenHash || data.accessToken || data.code), {
        message: "A password reset token is required",
        path: ["tokenHash"],
    });

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(resetPasswordSchema, body);

        authDebug("step 1/2: received a password update request", {
            // Which link shape the browser found decides whether an exchange is
            // needed first, and is the first thing to check when a valid-looking
            // link is rejected.
            linkShape: data.tokenHash
                ? "token_hash (query param)"
                : data.code
                  ? "code (PKCE query param)"
                  : "access_token (URL fragment)",
            tokenHash: maskToken(data.tokenHash),
            accessToken: maskToken(data.accessToken),
            code: maskToken(data.code),
        });

        await AuthService.resetPasswordFromLink(
            { tokenHash: data.tokenHash, accessToken: data.accessToken, code: data.code },
            data.password
        );

        authDebug("step 2/2: password updated successfully");

        return jsonOk({
            success: true,
            message: "Your password has been updated. Please sign in with your new password.",
        });
    } catch (error) {
        authDebugError("updating the password", error);
        return jsonError(error);
    }
}
