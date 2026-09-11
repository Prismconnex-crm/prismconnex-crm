import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The 90-second life of an email verification code.
 *
 * These run against the route handlers rather than the page, because the page's
 * countdown is only a display — every claim worth protecting ("an expired code
 * cannot verify", "a refresh does not extend it") is a claim about what the
 * server does with a request. AuthService is mocked so nothing here mails a real
 * code or touches Postgres; what is asserted is whether the request is forwarded
 * to Supabase at all, which is exactly where the expiry is enforced.
 */

const verifyMock = vi.fn();
const resendMock = vi.fn();

vi.mock("@/services/auth.service", () => ({
    AuthService: {
        verify: (...args: unknown[]) => verifyMock(...args),
        resendVerification: (...args: unknown[]) => resendMock(...args),
    },
}));

const EMAIL = "founder@example.com";
const CODE = "123456";
const START = new Date("2026-09-08T10:00:00.000Z");

async function loadModules() {
    const window = await import("@/lib/auth/verification-window");
    const verifyRoute = await import("@/app/api/auth/verify/route");
    const resendRoute = await import("@/app/api/auth/resend-verification/route");
    return { window, verifyRoute, resendRoute };
}

function postRequest(url: string, body: unknown) {
    return new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as never;
}

const verifyRequest = (body: unknown) => postRequest("http://localhost/api/auth/verify", body);
const resendRequest = (body: unknown) =>
    postRequest("http://localhost/api/auth/resend-verification", body);

/** The GET handler reads req.nextUrl, so this one needs a real NextRequest. */
function statusRequest(email: string) {
    return new NextRequest(
        `http://localhost/api/auth/resend-verification?email=${encodeURIComponent(email)}`
    );
}

beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);

    verifyMock.mockReset().mockResolvedValue({});
    resendMock.mockReset().mockResolvedValue(undefined);

    const { window } = await loadModules();
    window.resetVerificationWindows();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("the window itself", () => {
    it("gives a freshly sent code exactly 90 seconds", async () => {
        const { window } = await loadModules();
        const key = window.verificationKey(EMAIL);

        expect(window.recordCodeSent(key)).toBe(90);
        expect(window.getSecondsUntilExpiry(key)).toBe(90);
        expect(window.isCodeStillValid(key)).toBe(true);
    });

    it("counts down to 0 and then reports the code as dead", async () => {
        const { window } = await loadModules();
        const key = window.verificationKey(EMAIL);
        window.recordCodeSent(key);

        vi.advanceTimersByTime(1_000);
        expect(window.getSecondsUntilExpiry(key)).toBe(89);

        vi.advanceTimersByTime(88_000);
        expect(window.getSecondsUntilExpiry(key)).toBe(1);

        vi.advanceTimersByTime(1_000);
        expect(window.getSecondsUntilExpiry(key)).toBe(0);
        expect(window.isCodeStillValid(key)).toBe(false);
    });

    it("treats an address it has no record for as expired, not as fresh", async () => {
        const { window } = await loadModules();

        expect(window.isCodeStillValid(window.verificationKey("stranger@example.com"))).toBe(false);
    });

    it("does not hand out a second window for a differently cased address", async () => {
        const { window } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));

        expect(window.getSecondsUntilExpiry(window.verificationKey(" FOUNDER@EXAMPLE.com "))).toBe(
            90
        );
    });
});

describe("POST /api/auth/verify", () => {
    it("forwards a code that is still inside its 90 seconds", async () => {
        const { window, verifyRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));

        vi.advanceTimersByTime(89_000);

        const response = await verifyRoute.POST(verifyRequest({ email: EMAIL, code: CODE }));

        expect(response.status).toBe(200);
        expect(verifyMock).toHaveBeenCalledWith(EMAIL, CODE);
    });

    it("rejects an expired code and never asks Supabase about it", async () => {
        const { window, verifyRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));

        vi.advanceTimersByTime(90_000);

        const response = await verifyRoute.POST(verifyRequest({ email: EMAIL, code: CODE }));
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error.message).toBe(window.EXPIRED_CODE_MESSAGE);
        expect(json.error.message).toContain("Please request a new code");
        // The point of the whole feature: a stale code is not spendable.
        expect(verifyMock).not.toHaveBeenCalled();
    });

    it("says 'expired', not 'wrong code', so the user stops retyping it", async () => {
        const { window, verifyRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));
        vi.advanceTimersByTime(120_000);

        const json = await (
            await verifyRoute.POST(verifyRequest({ email: EMAIL, code: CODE }))
        ).json();

        expect(json.error.message.toLowerCase()).toContain("expired");
    });

    it("releases the window once a code has been spent", async () => {
        const { window, verifyRoute } = await loadModules();
        const key = window.verificationKey(EMAIL);
        window.recordCodeSent(key);

        await verifyRoute.POST(verifyRequest({ email: EMAIL, code: CODE }));

        expect(window.getSecondsUntilExpiry(key)).toBe(0);
    });
});

describe("POST /api/auth/resend-verification", () => {
    it("refuses while the current code is still alive, and says how long is left", async () => {
        const { window, resendRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));

        vi.advanceTimersByTime(30_000);

        const response = await resendRoute.POST(resendRequest({ email: EMAIL }));
        const json = await response.json();

        expect(response.status).toBe(429);
        expect(json.error.details.retryAfterSeconds).toBe(60);
        expect(resendMock).not.toHaveBeenCalled();
    });

    it("sends a new code once the old one has expired, and restarts the 90 seconds", async () => {
        const { window, resendRoute } = await loadModules();
        const key = window.verificationKey(EMAIL);
        window.recordCodeSent(key);

        vi.advanceTimersByTime(90_000);
        expect(window.getSecondsUntilExpiry(key)).toBe(0);

        const response = await resendRoute.POST(resendRequest({ email: EMAIL }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.expiresInSeconds).toBe(90);
        expect(resendMock).toHaveBeenCalledWith(EMAIL);
        expect(window.getSecondsUntilExpiry(key)).toBe(90);
    });

    it("makes the code from a resend verifiable again", async () => {
        const { window, resendRoute, verifyRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));
        vi.advanceTimersByTime(90_000);

        await resendRoute.POST(resendRequest({ email: EMAIL }));
        const response = await verifyRoute.POST(verifyRequest({ email: EMAIL, code: CODE }));

        expect(response.status).toBe(200);
        expect(verifyMock).toHaveBeenCalledWith(EMAIL, CODE);
    });

    it("does not leave the address locked when the send itself fails", async () => {
        const { window, resendRoute } = await loadModules();
        const key = window.verificationKey(EMAIL);
        resendMock.mockRejectedValueOnce(new Error("SMTP down"));

        await resendRoute.POST(resendRequest({ email: EMAIL }));

        expect(window.getSecondsUntilExpiry(key)).toBe(0);
    });
});

describe("GET /api/auth/resend-verification", () => {
    it("reports the true remaining time, so a refresh cannot extend the code", async () => {
        const { window, resendRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));

        vi.advanceTimersByTime(40_000);

        // Three "page loads" in a row: the number keeps falling.
        const first = await (await resendRoute.GET(statusRequest(EMAIL))).json();
        vi.advanceTimersByTime(10_000);
        const second = await (await resendRoute.GET(statusRequest(EMAIL))).json();
        vi.advanceTimersByTime(40_000);
        const third = await (await resendRoute.GET(statusRequest(EMAIL))).json();

        expect(first.expiresInSeconds).toBe(50);
        expect(second.expiresInSeconds).toBe(40);
        expect(third.expiresInSeconds).toBe(0);
    });

    it("reports 0 for an address with nothing outstanding", async () => {
        const { resendRoute } = await loadModules();

        const json = await (await resendRoute.GET(statusRequest("nobody@example.com"))).json();

        expect(json.expiresInSeconds).toBe(0);
    });
});

describe("bypass attempts", () => {
    it("cannot be beaten by reloading the page and posting again", async () => {
        const { window, verifyRoute, resendRoute } = await loadModules();
        window.recordCodeSent(window.verificationKey(EMAIL));

        vi.advanceTimersByTime(95_000);

        // A "refresh" is just another status read; it does not reset anything.
        const status = await (await resendRoute.GET(statusRequest(EMAIL))).json();
        expect(status.expiresInSeconds).toBe(0);

        const response = await verifyRoute.POST(verifyRequest({ email: EMAIL, code: CODE }));

        expect(response.status).toBe(400);
        expect(verifyMock).not.toHaveBeenCalled();
    });

    it("cannot be beaten by posting straight at the API without ever loading the page", async () => {
        const { verifyRoute } = await loadModules();

        const response = await verifyRoute.POST(
            verifyRequest({ email: "never-signed-up@example.com", code: CODE })
        );

        expect(response.status).toBe(400);
        expect(verifyMock).not.toHaveBeenCalled();
    });
});
