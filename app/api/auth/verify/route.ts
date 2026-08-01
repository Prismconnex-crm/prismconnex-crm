import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";

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
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(verifySchema, body);

        await AuthService.verify(data.email, data.code);

        return jsonOk({ success: true, message: "Email verified successfully." });
    } catch (error) {
        return jsonError(error);
    }
}
