import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { clientIp } from "@/lib/auth/otp-guard";

const resendSchema = z.object({
    email: z.string().trim().pipe(z.email()),
});

/**
 * Re-sends the signup verification code. The answer is the same whether or not
 * the address has a pending signup, so it cannot be used to probe accounts.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(resendSchema, body);

        await AuthService.resendSignUpCode(data.email, clientIp(req.headers));

        return jsonOk({
            success: true,
            message: "If this email has a pending sign-up, a new code is on its way.",
        });
    } catch (error) {
        return jsonError(error);
    }
}
