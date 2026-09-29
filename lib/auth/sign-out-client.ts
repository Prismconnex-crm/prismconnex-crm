"use client";

import { SIGNED_OUT_SIGN_IN_HREF } from "@/lib/auth/routing";
import type { SignOutScope } from "@/components/app-shell/sign-out-dialog";

/**
 * The one sign-out every button in the app goes through.
 *
 * There are three places a user can end their session — the topbar menu,
 * Settings › Security › "Sign out from all devices", and the Log Out item in
 * the workspace switcher — and they used to disagree: two posted to the API
 * and then did `router.replace("/login?signedOut=1")`, and the third did
 * nothing at all. One function means one destination and one failure story.
 *
 * ── Why a full document navigation, not router.replace ──
 * `router.replace()` is a soft navigation: the App Router keeps its client-side
 * RSC cache, which still holds the rendered /app tree of the user who just
 * signed out. The previous code chased that with `router.refresh()`, which is a
 * race — the refresh targets whatever the router still thinks the current URL
 * is. `window.location.replace()` tears the document down instead, so nothing
 * of the authenticated shell survives in memory for the Back button to paint,
 * and `replace` (not `assign`) drops the /app entry from history so Back skips
 * past it. The server guard in app/(app)/app/layout.tsx is the backstop, and
 * middleware marks /app responses `no-store` so the browser cannot restore one
 * from cache either.
 *
 * ── Why it throws instead of redirecting anyway ──
 * The auth cookies are httpOnly, so only the server can clear them: a request
 * that never landed has ended nothing, and redirecting regardless would claim a
 * sign-out that did not happen. Callers catch this and offer a retry.
 */
export async function signOutAndRedirect(scope: SignOutScope = "local"): Promise<void> {
    const res = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
        // A cached 200 would stand in for a sign-out that never ran.
        cache: "no-store",
    });

    if (!res.ok) {
        console.error("[sign-out] failed", { status: res.status, scope });
        throw new Error(
            scope === "global"
                ? "We could not sign you out from all devices. Please try again."
                : "We could not sign you out just now. Please try again."
        );
    }

    window.location.replace(SIGNED_OUT_SIGN_IN_HREF);
}
