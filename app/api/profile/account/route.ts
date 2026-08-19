import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";
import { clearAuthCookies, readSupabaseTokens } from "@/lib/auth/session";
import { ProfileService } from "@/services/profile.service";
import { AccountSecurityService } from "@/services/account-security.service";

/**
 * Deactivate or delete the signed-in user's own account.
 *
 * Both are terminal for the current session, so both revoke everywhere and
 * clear cookies — leaving the user logged in after deleting their account
 * would be absurd, and after deactivating it would let them keep using an
 * account marked inactive.
 *
 * ── What "delete" actually does ──
 * A SOFT delete: account_status becomes 'deleted', the discretionary personal
 * data is scrubbed off the row, every session is revoked, and sign-in is
 * refused afterwards. The auth.users row survives, because removing it needs
 * the service_role key which this project deliberately does not hold. The
 * confirmation modal states this in the same words rather than promising an
 * erasure that does not happen. docs/PROFILE.md records the exact change
 * needed for a true hard delete.
 */
const BodySchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("deactivate") }),
    z.object({ action: z.literal("reactivate") }),
    z.object({
        action: z.literal("delete"),
        // Re-checked server-side: the modal's type-to-confirm must not be
        // bypassable by calling this endpoint directly.
        confirmation: z.literal("DELETE", {
            message: "Type DELETE exactly to confirm",
        }),
    }),
]);

export async function POST(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const body = validateBody(BodySchema, await request.json());

        if (body.action === "reactivate") {
            const profile = await ProfileService.reactivate(userId);
            return NextResponse.json({
                profile,
                signedOut: false,
                message: "Account reactivated.",
            });
        }

        if (body.action === "deactivate") {
            await ProfileService.deactivate(userId);
        } else {
            await ProfileService.softDelete(userId);
        }

        // Revoke at Supabase before clearing cookies. Best-effort: a failure
        // here must not prevent the local session from ending, or the user is
        // left signed in to an account they just closed.
        if (readSupabaseTokens()) {
            try {
                const accessToken = await requireSupabaseAccessToken();
                await AccountSecurityService.signOutEverywhere(accessToken);
            } catch (error) {
                console.error("[profile/account] revoke failed", error);
            }
        }

        return clearAuthCookies(
            NextResponse.json({
                signedOut: true,
                message:
                    body.action === "delete"
                        ? "Your account has been deleted and you have been signed out."
                        : "Your account has been deactivated and you have been signed out.",
            })
        );
    } catch (error) {
        return jsonError(error);
    }
}
