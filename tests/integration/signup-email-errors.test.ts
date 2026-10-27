import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as gotrue from "@/lib/supabase/gotrue";
import { ApiError } from "@/lib/http/errors";

/**
 * How the GoTrue wrapper reports the two signup outcomes that are not plain
 * success. Both response bodies below are copied from the live project
 * (2026-10-23); fetch is stubbed so the suite never reaches Supabase.
 */
function stubFetch(status: number, body: unknown) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(body), { status }))
    );
}

async function caught(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    throw new Error("expected the call to throw");
}

describe("signup email failures", () => {
    beforeEach(() => {
        process.env.SUPABASE_URL = "https://example.supabase.co";
        process.env.SUPABASE_ANON_KEY = "anon-key-for-tests";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("turns GoTrue's mailer failure into a 503 that says the email could not be sent", async () => {
        stubFetch(500, {
            code: 500,
            error_code: "unexpected_failure",
            msg: "Error sending confirmation email",
        });

        const error = await caught(
            gotrue.signUp("new@example.com", "password123", { first_name: "A", last_name: "B" })
        );

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(503);
        expect((error as ApiError).name).toBe("EmailDeliveryError");
        expect((error as ApiError).message).toMatch(/couldn't send/i);
    });

    it("logs Supabase's error_id server-side so the failure can be found in the Auth logs", async () => {
        stubFetch(500, {
            code: 500,
            error_code: "unexpected_failure",
            msg: "Error sending confirmation email",
            error_id: "01a169e5-3109-7c7d-bbb0-845e0904eed3",
        });
        const log = vi.spyOn(console, "error").mockImplementation(() => {});

        const error = await caught(
            gotrue.signUp("new@example.com", "password123", { first_name: "A", last_name: "B" })
        );

        const logged = JSON.stringify(log.mock.calls);
        expect(logged).toContain("01a169e5-3109-7c7d-bbb0-845e0904eed3");
        expect(logged).toContain("unexpected_failure");
        // ...but none of it reaches the client.
        expect(JSON.stringify(error)).not.toContain("01a169e5");
        expect((error as ApiError).message).not.toMatch(/smtp|unexpected_failure/i);
        log.mockRestore();
    });

    it("reports the same failure on resend", async () => {
        stubFetch(500, {
            code: 500,
            error_code: "unexpected_failure",
            msg: "Error sending confirmation email",
        });

        const error = await caught(gotrue.resendSignUpOtp("new@example.com"));

        expect((error as ApiError).name).toBe("EmailDeliveryError");
    });

    it("refuses an address that already has a confirmed account", async () => {
        // GoTrue's enumeration protection: 200, a fabricated id, no identities,
        // and no email is sent.
        stubFetch(200, {
            id: "00000000-0000-0000-0000-000000000000",
            email: "existing@example.com",
            confirmation_sent_at: "2026-10-23T17:38:38Z",
            identities: [],
            user_metadata: {},
        });

        const error = await caught(
            gotrue.signUp("existing@example.com", "password123", { first_name: "A", last_name: "B" })
        );

        expect((error as ApiError).statusCode).toBe(409);
        expect((error as ApiError).name).toBe("ConflictError");
        expect((error as ApiError).message).toMatch(/already exists/i);
    });

    it("still accepts a genuinely new address", async () => {
        stubFetch(200, {
            id: "11111111-1111-1111-1111-111111111111",
            email: "new@example.com",
            confirmation_sent_at: "2026-10-23T17:38:38Z",
            identities: [{ id: "x", provider: "email" }],
        });

        const result = await gotrue.signUp("new@example.com", "password123", {
            first_name: "A",
            last_name: "B",
        });

        expect(result.session).toBeNull();
        expect(result.user.id).toBe("11111111-1111-1111-1111-111111111111");
    });
});
