import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Wire-level tests for sign-out scope.
 *
 * The Sign Out modal offers two choices — this device, or all devices — and the
 * entire difference between them is one query parameter on GoTrue's
 * POST /auth/v1/logout. Nothing in the response distinguishes them: Supabase
 * answers 204 either way, so a scope sent as the wrong value looks like a
 * successful sign-out and only shows up later, as a phone that is still logged
 * in (or one that was logged out when it should not have been). That is
 * invisible from the UI, which is why it is pinned here.
 *
 * `fetch` is stubbed with a factory rather than a fixed Response, because a
 * single Response instance can only be read once and both calls below consume
 * a body.
 */

const SUPABASE_URL = "https://test-project.supabase.co";
const ANON_KEY = "test-anon-key";

const STORED = { access_token: "stored-token", refresh_token: "stored-refresh" };

let fetchMock: ReturnType<typeof vi.fn>;

function ok(body: unknown = {}) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

/** Every request made, as `{ url, init }` — the logout call is the last one. */
function calls() {
    return fetchMock.mock.calls.map(([url, init]) => ({
        url: String(url),
        init: init as RequestInit,
    }));
}

function lastCall() {
    const all = calls();
    return all[all.length - 1];
}

beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = ANON_KEY;

    // The refresh grant answers first with a fresh pair; everything after it
    // (the logout itself) just needs to be a 200.
    fetchMock = vi
        .fn()
        .mockImplementationOnce(async () =>
            ok({ access_token: "fresh-token", refresh_token: "fresh-refresh" })
        )
        .mockImplementation(async () => ok());

    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("gotrue.signOut", () => {
    it("defaults to the global scope, matching supabase-js", async () => {
        const { signOut } = await import("@/lib/supabase/gotrue");

        await signOut("some-token");

        expect(lastCall().url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=global`);
    });

    it("asks for the local scope when only this device should be signed out", async () => {
        const { signOut } = await import("@/lib/supabase/gotrue");

        await signOut("some-token", "local");

        expect(lastCall().url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=local`);
    });
});

describe("AuthService.signOut", () => {
    it('sends scope=local for "Sign out from this device"', async () => {
        const { AuthService } = await import("@/services/auth.service");

        await expect(AuthService.signOut(STORED, "local")).resolves.toBe(true);

        expect(lastCall().url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=local`);
    });

    it('sends scope=global for "Sign out from all devices"', async () => {
        const { AuthService } = await import("@/services/auth.service");

        await expect(AuthService.signOut(STORED, "global")).resolves.toBe(true);

        expect(lastCall().url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=global`);
    });

    it("still defaults to global, so callers that pass nothing are unchanged", async () => {
        const { AuthService } = await import("@/services/auth.service");

        await AuthService.signOut(STORED);

        expect(lastCall().url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=global`);
    });

    it("revokes with the refreshed token, not the stored one", async () => {
        const { AuthService } = await import("@/services/auth.service");

        await AuthService.signOut(STORED, "local");

        // Supabase access tokens last an hour and the app session lasts eight,
        // so by logout time the stored token is usually expired and GoTrue
        // would reject it. The refresh grant runs first for exactly that
        // reason; it rotates within the same session, so scope=local still
        // targets the session the user is sitting in.
        const [refresh, logout] = calls();

        expect(refresh.url).toBe(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`);
        expect(logout.init.headers).toMatchObject({
            Authorization: "Bearer fresh-token",
        });
    });

    it("falls back to the stored access token when the refresh fails", async () => {
        // A refresh token that was already spent or revoked: the logout must
        // still be attempted, because the stored access token can be live for
        // the first hour of the session.
        fetchMock.mockReset();
        fetchMock
            .mockImplementationOnce(
                async () => new Response(JSON.stringify({ msg: "invalid" }), { status: 400 })
            )
            .mockImplementation(async () => ok());

        const { AuthService } = await import("@/services/auth.service");

        await expect(AuthService.signOut(STORED, "global")).resolves.toBe(true);

        expect(lastCall().url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=global`);
        expect(lastCall().init.headers).toMatchObject({
            Authorization: "Bearer stored-token",
        });
    });

    it("reports false rather than throwing when the session is already gone", async () => {
        fetchMock.mockReset();
        fetchMock.mockImplementation(
            async () => new Response(JSON.stringify({ msg: "invalid" }), { status: 401 })
        );

        const { AuthService } = await import("@/services/auth.service");

        // Not an error: the desired end state — no live Supabase session — is
        // already true. The route clears cookies regardless.
        await expect(AuthService.signOut(STORED, "global")).resolves.toBe(false);
    });
});

describe("isSignOutScope", () => {
    it("accepts only the two scopes GoTrue understands", async () => {
        const { isSignOutScope } = await import("@/services/auth.service");

        expect(isSignOutScope("local")).toBe(true);
        expect(isSignOutScope("global")).toBe(true);
    });

    it("rejects anything else, so an unknown body cannot reach GoTrue", async () => {
        const { isSignOutScope } = await import("@/services/auth.service");

        // The route falls back to "global" for each of these. Passing an
        // arbitrary string through would make ?scope= a caller-controlled
        // parameter on a security endpoint.
        for (const value of ["GLOBAL", "others", "", null, undefined, 1, {}]) {
            expect(isSignOutScope(value)).toBe(false);
        }
    });
});
