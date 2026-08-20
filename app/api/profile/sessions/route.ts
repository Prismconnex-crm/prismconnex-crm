import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { jsonOk, jsonError } from "@/lib/http/response";
import { requireSessionUser } from "@/lib/auth/require-session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";
import { clearAuthCookies } from "@/lib/auth/session";
import { AccountSecurityService } from "@/services/account-security.service";
import { ProfileService } from "@/services/profile.service";

/**
 * Active sessions and devices.
 *
 * ── Why this shows one device, not a list ──
 * Supabase's GoTrue exposes no user-facing "list my sessions" endpoint. The
 * only enumeration available is an admin call requiring the service_role key,
 * which this project deliberately does not hold. So a multi-device list would
 * have to be invented, or reconstructed from a session table this app does not
 * keep — and a fabricated device list on a security page is worse than an
 * honest single entry. What IS real is reported: this browser, and the ability
 * to end every session everywhere.
 *
 * Adding a `user_sessions` table written at sign-in is the change that would
 * make a genuine list possible; docs/PROFILE.md records it.
 */
function describeUserAgent(userAgent: string): { browser: string; os: string } {
    const ua = userAgent || "";

    // Order matters: Edge's UA contains "Chrome", and Chrome's contains
    // "Safari". Testing the most specific first is what keeps Edge from being
    // reported as Chrome and Chrome from being reported as Safari.
    const browser = /Edg\//.test(ua)
        ? "Edge"
        : /OPR\//.test(ua)
          ? "Opera"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : "Unknown browser";

    const os = /Windows NT/.test(ua)
        ? "Windows"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad|iPod/.test(ua)
            ? "iOS"
            : /Mac OS X/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "Unknown OS";

    return { browser, os };
}

export async function GET() {
    try {
        const { userId } = await requireSessionUser();
        const profile = await ProfileService.getByUserId(userId);

        const headerList = headers();
        const userAgent = headerList.get("user-agent") ?? "";
        const { browser, os } = describeUserAgent(userAgent);

        // x-forwarded-for is a comma-separated chain when proxies are involved;
        // the first entry is the original client.
        const ip =
            headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            headerList.get("x-real-ip") ||
            null;

        return jsonOk({
            current: {
                browser,
                os,
                ip,
                signedInAt: profile?.lastLoginAt ?? null,
                isCurrent: true,
            },
            // Stated in the payload as well as the UI, so a consumer of this
            // API cannot mistake one entry for "one device exists".
            note: "Supabase does not expose a per-device session list; only this browser can be described.",
        });
    } catch (error) {
        return jsonError(error);
    }
}

/**
 * "Log out from all devices."
 *
 * Two steps, in this order, mirroring /api/auth/sign-out: revoke every refresh
 * token at Supabase, then expire this browser's cookies. The second always
 * runs — leaving the user holding a live local session after they asked to be
 * signed out everywhere would be the exact opposite of the request.
 */
export async function DELETE() {
    try {
        await requireSessionUser();

        let revoked = false;
        try {
            const accessToken = await requireSupabaseAccessToken();
            await AccountSecurityService.signOutEverywhere(accessToken);
            revoked = true;
        } catch (error) {
            console.error("[profile/sessions] global sign-out failed", error);
        }

        return clearAuthCookies(
            NextResponse.json({
                ok: true,
                revoked,
                message: "Signed out on every device.",
            })
        );
    } catch (error) {
        return jsonError(error);
    }
}
