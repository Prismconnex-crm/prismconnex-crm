import { jsonOk, jsonError } from "@/lib/http/response";
import { UnauthorizedError } from "@/lib/http/errors";
import { getSessionPayload } from "@/lib/auth/session";
import { ProfileService } from "@/services/profile.service";

/**
 * Returns the signed-in user's profile.
 *
 * `sub` is the Supabase Auth user id, which is also profiles.id.
 *
 * Responds 200 with `profile: null` rather than 404 when no row exists: the
 * seeded demo user (and any session created by /api/auth/mock-sign-in) has a
 * non-uuid `sub` and no profile, and should not start failing.
 */
export async function GET() {
    try {
        const payload = await getSessionPayload();
        if (!payload?.sub) throw new UnauthorizedError();

        const profile = await ProfileService.getByUserId(payload.sub as string);

        return jsonOk({ profile });
    } catch (error) {
        return jsonError(error);
    }
}
