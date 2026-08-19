import { UnauthorizedError } from "@/lib/http/errors";
import { getSessionPayload } from "@/lib/auth/session";

export type SessionUser = {
    /** Supabase Auth user id (auth.users.id), which is also profiles.id. */
    userId: string;
    email: string;
};

/**
 * The signed-in user, or a 401.
 *
 * Every Profile route starts here, and it is the whole of the "a user can only
 * see and edit their own profile" guarantee: the id comes from the verified
 * pcx_session cookie and is passed to the service directly, so no request body
 * or query string can point an operation at somebody else's row. There is
 * deliberately no `userId` parameter anywhere in the Profile API surface.
 *
 * Throws UnauthorizedError (mapped to 401 by jsonError) rather than the plain
 * `Error("Unauthorized")` some older routes use — that one lands as a 500, as
 * CLAUDE.md's Gotchas section notes.
 */
export async function requireSessionUser(): Promise<SessionUser> {
    const payload = await getSessionPayload();
    if (!payload?.sub) throw new UnauthorizedError();

    return {
        userId: payload.sub as string,
        email: (payload.email as string) ?? "",
    };
}
