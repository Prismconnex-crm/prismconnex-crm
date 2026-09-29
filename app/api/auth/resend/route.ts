import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";

const resendSchema = z.object({
    email: z.string().trim().pipe(z.email()),
});

/**
 * Issues a fresh signup OTP, restarting the 90-second window.
 *
 * Unlike /api/auth/forgot-password this does NOT hide whether the address
 * exists. It is only reachable from /auth/verify, which the user lands on
 * immediately after signing up with the address in question — there is nothing
 * to enumerate that they have not just been told, and swallowing the error would
 * leave "Resend" looking successful while sending nothing.
 *
 * Two different 429s can come back, and both are meant to be shown:
 *   - ours, from the per-address cooldown, which names the exact wait;
 *   - Supabase's, when the project-wide mail quota is spent (see
 *     lib/supabase/gotrue.ts), which says to configure custom SMTP.
 * Neither is buried — a silent failure here looks identical to a delivered
 * email that never arrives, which is the bug this whole flow started as.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(resendSchema, body);

        const { expiresInSeconds, cooldownSeconds } = await AuthService.resendSignUpOtp(
            data.email
        );

        return jsonOk({
            success: true,
            expiresInSeconds,
            cooldownSeconds,
            message: "A new verification code has been sent to your email.",
        });
    } catch (error) {
        return jsonError(error);
    }
}
