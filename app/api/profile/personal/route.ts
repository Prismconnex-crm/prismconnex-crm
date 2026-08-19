import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { UpdatePersonalInfoSchema } from "@/models/profile";
import { ProfileService } from "@/services/profile.service";
import { readSupabaseTokens } from "@/lib/auth/session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";

/**
 * Saves the Personal Information card.
 *
 * The email is the only field that does not simply become a column write — see
 * ProfileService.updatePersonalInfo. The access token is resolved lazily and
 * only when it is actually needed, so a session without Supabase tokens (the
 * demo user) can still edit every other field instead of being blocked
 * wholesale by a 401 it cannot act on.
 */
export async function PATCH(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const data = validateBody(UpdatePersonalInfoSchema, await request.json());

        const accessToken = readSupabaseTokens()
            ? await requireSupabaseAccessToken()
            : null;

        const { profile, emailChangePending } = await ProfileService.updatePersonalInfo(
            userId,
            data,
            { accessToken }
        );

        return jsonOk({
            profile,
            emailChangePending,
            message: emailChangePending
                ? "Saved. Check your new inbox for a confirmation link — your email address changes once you confirm it."
                : "Personal information updated.",
        });
    } catch (error) {
        return jsonError(error);
    }
}
