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

        expect(fetchMock).toHaveBeenCalledTimes(2);

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

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const { url, init } = lastCall();
        expect(url).toBe(`${SUPABASE_URL}/auth/v1/user`);
        expect(init.method).toBe("PUT");
        expect(init.headers).toMatchObject({ Authorization: "Bearer frag-token" });
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
