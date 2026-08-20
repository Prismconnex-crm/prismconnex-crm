import { jsonOk, jsonError } from "@/lib/http/response";
import { requireSessionUser } from "@/lib/auth/require-session";
import { ProfileService } from "@/services/profile.service";
import { resolveTenant } from "@/lib/auth/tenant";
import { readSupabaseTokens } from "@/lib/auth/session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";
import { getUser } from "@/lib/supabase/gotrue";

// This route reads the session cookie, so it can never be statically rendered.
// Declaring it keeps `next build` from attempting the static pass and logging a
// dynamic-server-usage error for a route that is working as intended.
export const dynamic = "force-dynamic";

/**
 * Email verification state, read from Supabase rather than inferred.
 *
 * The pcx_session cookie carries no such claim, and guessing "signed in
 * therefore verified" would be wrong for any project with email confirmation
 * switched off — precisely the configuration where the badge matters most.
 * Returns null (rendered as "Unknown") when there is no Supabase token to ask
 * with, which is honest about not knowing instead of asserting a green tick.
 */
async function readEmailVerified(): Promise<boolean | null> {
    if (!readSupabaseTokens()) return null;

    try {
        const user = await getUser(await requireSupabaseAccessToken());
        return Boolean(user.email_confirmed_at);
    } catch {
        return null;
    }
}

/**
 * The signed-in user's profile, plus the account facts the Profile page shows
 * that do not live on the profiles row.
 *
 * Still responds 200 with `profile: null` rather than 404 when no row exists:
 * the seeded demo user (and any session from /api/auth/mock-sign-in) has a
 * non-uuid `sub` and no profile, and must not start failing. The Profile page
 * renders an explanatory empty state for exactly that case.
 *
 * `account` carries what the Account Information card needs:
 *   role          — from the workspace membership (resolveTenant)
 *   emailVerified — from the session, set at sign-in
 *   hasSupabaseSession — whether pcx_sb holds tokens, i.e. whether the
 *                        security actions (password, 2FA, avatar) can work at
 *                        all. The UI disables them with a reason rather than
 *                        letting the user click into a 401.
 */
export async function GET() {
    try {
        const { userId } = await requireSessionUser();

        const [profile, tenant, emailVerified] = await Promise.all([
            ProfileService.getByUserId(userId),
            resolveTenant(),
            readEmailVerified(),
        ]);

        return jsonOk({
            profile,
            account: {
                role: tenant?.role ?? null,
                workspaceId: tenant?.workspaceId ?? null,
                emailVerified,
                hasSupabaseSession: Boolean(readSupabaseTokens()),
            },
        });
    } catch (error) {
        return jsonError(error);
    }
}
