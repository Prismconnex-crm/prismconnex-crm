import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";
import { ChangePasswordSchema } from "@/models/profile";
import { AccountSecurityService } from "@/services/account-security.service";
import { ProfileService } from "@/services/profile.service";

/**
 * Changes the password.
 *
 * The email used to verify the current password comes from the PROFILE row,
 * not from the session claim and certainly not from the request: it is the
 * address Supabase actually knows, and it is re-read here so a pending
 * (unconfirmed) email change cannot be used to aim the verification at an
 * address the user has not proved they own.
 *
 * The new password never touches our database. It goes to Supabase, which
 * stores it in auth.users.encrypted_password.
 */
export async function POST(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const data = validateBody(ChangePasswordSchema, await request.json());

        const [profile, accessToken] = await Promise.all([
            ProfileService.requireByUserId(userId),
            requireSupabaseAccessToken(),
        ]);

        await AccountSecurityService.changePassword({
            email: profile.email,
            accessToken,
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
        });

        return jsonOk({
            message:
                "Password changed. Other devices stay signed in — use “Log out from all devices” if you want to end them.",
        });
    } catch (error) {
        return jsonError(error);
    }
}
