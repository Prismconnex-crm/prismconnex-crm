import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Wire-level tests for the password reset flow.
 *
 * `fetch` is stubbed so these assert the exact requests the app makes to
 * Supabase Auth without sending real mail — the project's built-in mailer is
 * capped at a few messages an hour, so a test that actually sent one would be
 * self-limiting.
 *
 * What is being protected here is mostly the shape of the outbound calls: the
 * flow was previously broken not because a request was malformed but because
 * none was ever made, and the `redirect_to` in particular is invisible from the
 * response (Supabase silently substitutes its Site URL when the value is not in
 * the dashboard allow-list).
 */

const SUPABASE_URL = "https://test-project.supabase.co";
const ANON_KEY = "test-anon-key";

/**
 * Prisma is mocked because completing a reset also writes to the database.
 *
 * resetPasswordFromLink() ends with revokeIssuedSessions() (lib/auth/session-
 * revocation.ts), which lazily imports the client and runs user.updateMany to
 * stamp sessionsValidFrom. Stubbing fetch does not cover that: the call went
 * over the network to the shared Supabase instance, which made this file slow,
 * dependent on a reachable database, and a refactor away from writing to real
 * accounts. The stamp itself is covered by session-revocation.test.ts.
 *
 * Mirrors the mock in companies-filter-api.test.ts.
 */
const mocks = vi.hoisted(() => ({
    updateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: {
            updateMany: mocks.updateMany,
        },
    },
}));

let fetchMock: ReturnType<typeof vi.fn>;

/** Minimal GoTrue-shaped success response. */
function ok(body: unknown = {}) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

function lastCall() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: String(url), init: init as RequestInit };
}

beforeEach(() => {
    vi.resetModules();
    mocks.updateMany.mockReset();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = ANON_KEY;

    fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("sending the reset email", () => {
    it("POSTs to /recover with the redirect_to the reset page actually lives at", async () => {
        const { sendRecoveryEmail } = await import("@/lib/supabase/gotrue");

        await sendRecoveryEmail("user@example.com", "http://localhost:3000/auth/reset-password");

        const { url, init } = lastCall();

        expect(url).toBe(
            `${SUPABASE_URL}/auth/v1/recover` +
                `?redirect_to=${encodeURIComponent("http://localhost:3000/auth/reset-password")}`
        );
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ email: "user@example.com" });
    });

    it("percent-encodes the redirect so a query string cannot escape the parameter", async () => {
        const { sendRecoveryEmail } = await import("@/lib/supabase/gotrue");

        await sendRecoveryEmail("user@example.com", "https://app.example.com/auth/reset-password");

        expect(lastCall().url).toContain(
            "redirect_to=https%3A%2F%2Fapp.example.com%2Fauth%2Freset-password"
        );
    });
});

describe("completing the reset from the emailed link", () => {
    it("exchanges a token_hash, then PUTs the new password with the returned session", async () => {
        fetchMock
            .mockResolvedValueOnce(ok({ access_token: "session-token", user: { id: "u1" } }))
            .mockResolvedValueOnce(ok({ id: "u1" }));

        const { AuthService } = await import("@/services/auth.service");
        await AuthService.resetPasswordFromLink({ tokenHash: "hash-abc" }, "NewPassw0rd!");

        // Three: the token exchange, the password update, and the global logout
        // that ends every session the old password could still reach.
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const [verifyUrl, verifyInit] = fetchMock.mock.calls[0];
        expect(String(verifyUrl)).toBe(`${SUPABASE_URL}/auth/v1/verify`);
        expect(JSON.parse(String((verifyInit as RequestInit).body))).toEqual({
            type: "recovery",
            token_hash: "hash-abc",
        });

        const [userUrl, userInit] = fetchMock.mock.calls[1];
        expect(String(userUrl)).toBe(`${SUPABASE_URL}/auth/v1/user`);
        expect((userInit as RequestInit).method).toBe("PUT");
        expect(JSON.parse(String((userInit as RequestInit).body))).toEqual({
            password: "NewPassw0rd!",
        });
        // The session from the exchange must authorise the update, not the anon key.
        expect((userInit as RequestInit).headers).toMatchObject({
            Authorization: "Bearer session-token",
        });
    });

    it("skips the exchange when the link already yielded an access token", async () => {
        const { AuthService } = await import("@/services/auth.service");
        await AuthService.resetPasswordFromLink({ accessToken: "frag-token" }, "NewPassw0rd!");

        // Two: the update, then the global logout appended after it — so the
        // update is no longer the last call and has to be read by index.
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const [userUrl, userInit] = fetchMock.mock.calls[0];
        expect(String(userUrl)).toBe(`${SUPABASE_URL}/auth/v1/user`);
        expect((userInit as RequestInit).method).toBe("PUT");
        expect((userInit as RequestInit).headers).toMatchObject({
            Authorization: "Bearer frag-token",
        });
    });

    it("reports an expired link as expired, not as 'Invalid email or password'", async () => {
        // GoTrue answers a spent recovery token with 401; the shared request()
        // helper maps every 401 to the sign-in wording, which is meaningless on
        // a reset page. AuthService is expected to translate it.
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ msg: "Token has expired or is invalid" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            })
        );

        const { AuthService } = await import("@/services/auth.service");

        await expect(
            AuthService.resetPasswordFromLink({ tokenHash: "spent" }, "NewPassw0rd!")
        ).rejects.toThrow(/expired or has already been used/i);
    });

    it("refuses to call Supabase at all when no token is present", async () => {
        const { AuthService } = await import("@/services/auth.service");

        await expect(
            AuthService.resetPasswordFromLink({}, "NewPassw0rd!")
        ).rejects.toThrow(/invalid/i);

        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("ending other sessions after a reset", () => {
  // A reset is normally requested precisely because someone else knows the old
  // password. Changing it is only half the remedy: without an explicit global
  // logout the intruder keeps a working refresh token.
  it("revokes every Supabase session once the new password is set", async () => {
    const { AuthService } = await import("@/services/auth.service");
    await AuthService.resetPasswordFromLink({ accessToken: "frag-token" }, "NewPassw0rd!");

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Order matters: revoking before the update would invalidate the very
    // token the PUT needs to authorise itself.
    const [userUrl] = fetchMock.mock.calls[0];
    expect(String(userUrl)).toBe(`${SUPABASE_URL}/auth/v1/user`);

    const { url, init } = lastCall();
    expect(url).toBe(`${SUPABASE_URL}/auth/v1/logout?scope=global`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer frag-token" });
  });

  it("still completes the reset when revocation fails", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ id: "u1" }))
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));

    const { AuthService } = await import("@/services/auth.service");

    // The password is already changed by this point and the link is spent, so
    // surfacing this failure would report a reset that did work as broken and
    // leave the user nothing to retry with.
    await expect(
      AuthService.resetPasswordFromLink({ accessToken: "frag-token" }, "NewPassw0rd!")
    ).resolves.toMatchObject({ supabaseSessionsRevoked: false });
  });
});
