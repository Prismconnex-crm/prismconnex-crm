import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { clientIp } from "@/lib/auth/otp-guard";

const verifySchema = z.object({
    email: z.string().trim().pipe(z.email()),
    // Supabase emails 6 digits by default; the length is configurable up to 10.
    code: z.string().trim().regex(/^\d{6,10}$/, "Enter the numeric code from the email"),
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
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(verifySchema, body);

        await AuthService.verify(data.email, data.code, clientIp(req.headers));

        return jsonOk({ success: true, message: "Email verified successfully." });
    } catch (error) {
        return jsonError(error);
    }
}
