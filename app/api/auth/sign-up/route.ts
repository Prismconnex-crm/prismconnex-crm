import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";
import { recordCodeSent, verificationKey } from "@/lib/auth/verification-window";

/**
 * Server-side contract, and the source of truth for validation. The client
 * mirrors it in models/auth.ts purely to render inline field errors.
 *
 * The name is kept as three discrete fields (rather than the single `name`
 * string the Cognito version accepted) because public.profiles stores
 * first/middle/last separately. `phone` was previously absent here, which is
 * why it was silently dropped from every signup.
 */
const signUpSchema = z.object({
    firstName: z.string().trim().min(1),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1),
    email: z.string().trim().pipe(z.email()),
    phone: z.string().trim().optional(),
    password: z.string().min(8),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(signUpSchema, body);

        // Creates the Supabase Auth user (password stored only there); the
        // on_auth_user_created trigger creates the matching profiles row.
        const result = await AuthService.signUp(data);

        // Signup is the first thing that mails a code, so the 90-second clock
        // starts here rather than on the verify page. Without this the code
        // would arrive already outside its window and /api/auth/verify would
        // reject it, since an address with no record on file counts as expired.
        if (result.emailConfirmationRequired) {
            recordCodeSent(verificationKey(data.email));
        }

        return jsonOk(
            {
                success: true,
                emailConfirmationRequired: result.emailConfirmationRequired,
                profile: result.profile,
                message: result.emailConfirmationRequired
                    ? "User created, please verify your email."
                    : "User created.",
            },
            201
        );
    } catch (error) {
        return jsonError(error);
    }
}
