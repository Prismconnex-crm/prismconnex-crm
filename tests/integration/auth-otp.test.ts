import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signup OTP, resend and sign-in error paths, at the wire level.
 *
 * Supabase owns the code itself (generation, expiry, single use); what this
 * app owns is how each GoTrue answer is interpreted and the per-email limits
 * in lib/auth/otp-guard.ts. Every response body below is the shape the live
 * project returned when probed, so a GoTrue change that renames a field shows
 * up here rather than as a confusing UI message.
 *
 * ProfileService and the confirmation_sent_at read are mocked so nothing
 * reaches Postgres. With no issue time on record the 90 s expiry and the DB
 * resend cooldown stand aside (see signup-otp-expiry.test.ts), which leaves
 * the otp-guard limits as the thing under test here.
 */

vi.mock("@/services/profile.service", () => ({
    ProfileService: {
        ensureProfile: vi.fn(async (user: { id: string; email?: string }) => ({
            id: user.id,
            email: user.email,
        })),
        ensureProfileForSession: vi.fn(async (user: { id: string; email?: string }) => ({
            id: user.id,
            email: user.email,
        })),
        resolveIdentifierToEmail: vi.fn(async (identifier: string) => identifier),
    },
}));

vi.mock("@/repositories/signup-otp.repository", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/repositories/signup-otp.repository")>();
    return {
        SignUpOtpRepository: {
            ...actual.SignUpOtpRepository,
            findConfirmationSentAt: vi.fn(async () => null),
        },
    };
});

const SUPABASE_URL = "https://test-project.supabase.co";
const EMAIL = "new.user@example.com";
const IP = "203.0.113.7";

let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

const SESSION = {
    access_token: "a",
    refresh_token: "r",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "11111111-1111-4111-8111-111111111111", email: EMAIL },
};

const BAD_OTP = { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" };

/** Paths requested so far, e.g. "/auth/v1/verify". */
function paths() {
    return fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
}

beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function load() {
    const guard = await import("@/lib/auth/otp-guard");
    guard.resetOtpGuardForTests();
    const { SignUpOtpRepository } = await import("@/repositories/signup-otp.repository");
    vi.mocked(SignUpOtpRepository.findConfirmationSentAt).mockReset();
    const { AuthService } = await import("@/services/auth.service");
    return { AuthService, guard };
}

const SIGN_UP = { email: EMAIL, password: "a-long-password", firstName: "New", lastName: "User" };

describe("sign-up", () => {
    it("returns a pending (unconfirmed) user and asks for verification — no session is issued", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(
            respond(200, { id: SESSION.user.id, email: EMAIL, identities: [{ id: "x" }] })
        );

        const result = await AuthService.signUp(SIGN_UP, IP);

        expect(result.emailConfirmationRequired).toBe(true);
        expect(result.session).toBeNull();
    });

    it("rejects an already-registered email with 409 instead of a dead-end verify screen", async () => {
        const { AuthService } = await load();
        // Supabase's enumeration-protected answer: random id, no identities.
        fetchMock.mockResolvedValueOnce(
            respond(200, { id: "99999999-9999-4999-8999-999999999999", email: EMAIL, identities: [] })
        );

        await expect(AuthService.signUp(SIGN_UP, IP)).rejects.toMatchObject({
            statusCode: 409,
            name: "ConflictError",
        });
    });

    it("reports a failed email send as 503 with a clear message, not a bare 500", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(
            respond(500, { code: 500, error_code: "unexpected_failure", msg: "Error sending confirmation email" })
        );

        await expect(AuthService.signUp(SIGN_UP, IP)).rejects.toMatchObject({
            statusCode: 503,
            name: "EmailDeliveryError",
        });
    });

    it("validates input at the route before anything reaches Supabase", async () => {
        await load();
        const { POST } = await import("@/app/api/auth/sign-up/route");
        const req = new Request("http://localhost/api/auth/sign-up", {
            method: "POST",
            body: JSON.stringify({ ...SIGN_UP, email: "not-an-email", password: "short" }),
        });

        const res = await POST(req as never);

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("verify", () => {
    it("accepts a valid code", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(respond(200, SESSION));

        await expect(AuthService.verify(EMAIL, "123456", IP)).resolves.toMatchObject({
            session: { access_token: "a" },
        });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            type: "signup",
            email: EMAIL,
            token: "123456",
        });
    });

    it("rejects an invalid, expired or already-used code with one clear message", async () => {
        // GoTrue answers all three identically, so one test covers them.
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(respond(403, BAD_OTP));

        await expect(AuthService.verify(EMAIL, "000000", IP)).rejects.toMatchObject({
            statusCode: 400,
            name: "InvalidOtpError",
        });
    });

    it("locks an email out after 5 wrong codes without asking Supabase again", async () => {
        const { AuthService } = await load();
        fetchMock.mockImplementation(async () => respond(403, BAD_OTP));

        for (let i = 0; i < 5; i++) {
            await expect(AuthService.verify(EMAIL, "000000", IP)).rejects.toMatchObject({
                name: "InvalidOtpError",
            });
        }
        await expect(AuthService.verify(EMAIL, "123456", IP)).rejects.toMatchObject({
            statusCode: 429,
        });
        expect(fetchMock).toHaveBeenCalledTimes(5);

        // Case and whitespace do not open a fresh budget.
        await expect(AuthService.verify("  NEW.USER@example.com ", "123456", IP)).rejects.toMatchObject({
            statusCode: 429,
        });
    });

    it("refuses a code past the 90 s window without asking Supabase", async () => {
        const { AuthService } = await load();
        const { SignUpOtpRepository } = await import("@/repositories/signup-otp.repository");
        vi.mocked(SignUpOtpRepository.findConfirmationSentAt).mockResolvedValueOnce(
            new Date(Date.now() - 91_000)
        );

        await expect(AuthService.verify(EMAIL, "123456", IP)).rejects.toMatchObject({
            statusCode: 410,
            name: "OtpExpiredError",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("calls a rejected code inside the window incorrect, and counts it toward the lockout", async () => {
        const { AuthService } = await load();
        const { SignUpOtpRepository } = await import("@/repositories/signup-otp.repository");
        vi.mocked(SignUpOtpRepository.findConfirmationSentAt).mockResolvedValue(
            new Date(Date.now() - 10_000)
        );
        fetchMock.mockImplementation(async () => respond(403, BAD_OTP));

        for (let i = 0; i < 5; i++) {
            await expect(AuthService.verify(EMAIL, "000000", IP)).rejects.toMatchObject({
                statusCode: 400,
                name: "InvalidOtpError",
                message: "Incorrect verification code. Please check and try again.",
            });
        }
        await expect(AuthService.verify(EMAIL, "123456", IP)).rejects.toMatchObject({
            statusCode: 429,
        });
    });

    it("rejects a non-numeric code at the route", async () => {
        await load();
        const { POST } = await import("@/app/api/auth/verify/route");
        const req = new Request("http://localhost/api/auth/verify", {
            method: "POST",
            body: JSON.stringify({ email: EMAIL, code: "abcdef" }),
        });

        const res = await POST(req as never);

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("resend code", () => {
    it("asks Supabase for a fresh signup code", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(respond(200, {}));

        await AuthService.resendSignUpCode(EMAIL, IP);

        expect(paths()).toEqual(["/auth/v1/resend"]);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: "signup", email: EMAIL });
    });

    it("enforces a 60 s cooldown per address, shared with sign-up", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(
            respond(200, { id: SESSION.user.id, email: EMAIL, identities: [{ id: "x" }] })
        );

        await AuthService.signUp(SIGN_UP, IP);

        await expect(AuthService.resendSignUpCode(EMAIL, IP)).rejects.toMatchObject({
            statusCode: 429,
            retryAfterSeconds: 60,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("caps sends at 5 per address per hour", async () => {
        const { guard } = await load();
        const t0 = 1_000_000;
        for (let i = 0; i < 5; i++) guard.consumeOtpSend(EMAIL, IP, t0 + i * 61_000);

        expect(() => guard.consumeOtpSend(EMAIL, IP, t0 + 5 * 61_000)).toThrow(/Too many codes/);
        expect(() => guard.consumeOtpSend(EMAIL, IP, t0 + 61 * 60_000)).not.toThrow();
    });

    it("maps GoTrue's own per-user cooldown to a wait message", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(
            respond(429, {
                code: 429,
                error_code: "over_email_send_rate_limit",
                msg: "For security purposes, you can only request this after 42 seconds.",
            })
        );

        await expect(AuthService.resendSignUpCode(EMAIL, IP)).rejects.toMatchObject({
            statusCode: 429,
            message: "Please wait 42 seconds before requesting another code.",
        });
    });

    it("a new code clears earlier wrong-code lockout", async () => {
        const { guard } = await load();
        for (let i = 0; i < 5; i++) guard.recordVerifyFailure(EMAIL);
        expect(() => guard.assertCanVerify(EMAIL, IP)).toThrow();

        guard.consumeOtpSend(EMAIL, IP);

        expect(() => guard.assertCanVerify(EMAIL, IP)).not.toThrow();
    });
});

describe("sign-in", () => {
    it("signs in with correct credentials", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(respond(200, SESSION));

        await expect(AuthService.signIn(EMAIL, "a-long-password")).resolves.toMatchObject({
            session: { access_token: "a" },
        });
    });

    it("rejects a wrong password with 401", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(
            respond(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" })
        );

        await expect(AuthService.signIn(EMAIL, "wrong")).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid email or password",
        });
    });

    it("rejects an unknown email with the same message as a wrong password", async () => {
        const { AuthService } = await load();
        const { ProfileService } = await import("@/services/profile.service");
        vi.mocked(ProfileService.resolveIdentifierToEmail).mockResolvedValueOnce(null);

        await expect(AuthService.signIn("nobody@example.com", "x")).rejects.toMatchObject({
            statusCode: 401,
            message: "Invalid email or password",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("tells an unverified account to verify, with a code the form can route on", async () => {
        const { AuthService } = await load();
        fetchMock.mockResolvedValueOnce(
            respond(400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" })
        );

        await expect(AuthService.signIn(EMAIL, "a-long-password")).rejects.toMatchObject({
            statusCode: 401,
            name: "EmailNotConfirmedError",
        });
    });
});
