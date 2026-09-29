import { describe, it, expect, afterEach } from "vitest";
import { AuthService } from "@/services/auth.service";
import { SignUpOtpRepository } from "@/repositories/signup-otp.repository";
import { RESEND_COOLDOWN_SECONDS, SIGNUP_OTP_TTL_SECONDS } from "@/models/auth";
import { BadRequestError, OtpExpiredError } from "@/lib/http/errors";

/**
 * The 90-second signup OTP window.
 *
 * Only `secondsRemaining` is exercised here — it is the pure half of the gate,
 * and the half that decides whether a code is refused. The DB read beside it
 * (`findConfirmationSentAt`) is a single-column SELECT against auth.users and
 * would need a live Supabase to test, which this suite deliberately never
 * touches (see the assistant adapter tests for the same policy).
 */
describe("signup OTP expiry window", () => {
    const sentAt = new Date("2026-09-18T12:00:00.000Z");
    const at = (offsetSeconds: number) =>
        new Date(sentAt.getTime() + offsetSeconds * 1000);

    it("is 90 seconds, matching the value the verify page counts down", () => {
        expect(SIGNUP_OTP_TTL_SECONDS).toBe(90);
        expect(SignUpOtpRepository.ttlSeconds).toBe(90);
    });

    it("leaves the full window immediately after the code is sent", () => {
        expect(SignUpOtpRepository.secondsRemaining(sentAt, sentAt)).toBe(90);
    });

    it("counts down while the code is still valid", () => {
        expect(SignUpOtpRepository.secondsRemaining(sentAt, at(30))).toBe(60);
        expect(SignUpOtpRepository.secondsRemaining(sentAt, at(89))).toBe(1);
    });

    it("reports 0 exactly at the 90-second boundary", () => {
        // 0 is the value AuthService.verify treats as expired, so the boundary
        // belongs to the rejecting side: a code is dead at t=90, not at t=91.
        expect(SignUpOtpRepository.secondsRemaining(sentAt, at(90))).toBe(0);
    });

    it("stays at 0 rather than going negative long after expiry", () => {
        expect(SignUpOtpRepository.secondsRemaining(sentAt, at(5000))).toBe(0);
    });

    it("returns null when no send time is known, so a valid code is never refused", () => {
        // null must NOT be confused with 0: the caller falls through to Supabase
        // in this case instead of rejecting the code itself.
        expect(SignUpOtpRepository.secondsRemaining(null)).toBeNull();
        expect(SignUpOtpRepository.secondsRemaining(null, at(5000))).toBeNull();
    });

    it("restarts the window when a resend produces a later timestamp", () => {
        const resentAt = at(120); // resent after the first code died
        expect(SignUpOtpRepository.secondsRemaining(sentAt, at(150))).toBe(0);
        expect(SignUpOtpRepository.secondsRemaining(resentAt, at(150))).toBe(60);
    });

    it("surfaces expiry as a 410 the verify page can branch on", () => {
        const error = new OtpExpiredError();

        // The page keys off `code` (jsonError serialises error.name) to swap the
        // form for the resend button, so both of these are load-bearing.
        expect(error.name).toBe("OtpExpiredError");
        expect(error.statusCode).toBe(410);
        expect(error.message).toBe("Verification code has expired.");
    });
});

describe("resend cooldown", () => {
    const sentAt = new Date("2026-09-18T12:00:00.000Z");
    const at = (offsetSeconds: number) =>
        new Date(sentAt.getTime() + offsetSeconds * 1000);

    it("never throttles the first send, when nothing is on record", () => {
        // null must mean "go ahead", not "wait": a user with no prior send would
        // otherwise be unable to get a code at all.
        expect(SignUpOtpRepository.cooldownRemaining(null)).toBe(0);
    });

    it("blocks an immediate repeat and names the wait", () => {
        expect(SignUpOtpRepository.cooldownRemaining(sentAt, sentAt)).toBe(60);
        expect(SignUpOtpRepository.cooldownRemaining(sentAt, at(15))).toBe(45);
        expect(SignUpOtpRepository.cooldownRemaining(sentAt, at(59))).toBe(1);
    });

    it("allows the resend once the cooldown elapses", () => {
        expect(SignUpOtpRepository.cooldownRemaining(sentAt, at(60))).toBe(0);
        expect(SignUpOtpRepository.cooldownRemaining(sentAt, at(600))).toBe(0);
    });

    it("has elapsed by the time the code expires, so it never blocks the real path", () => {
        // This is the property that matters: Resend is only offered at 90s, and
        // the cooldown must already be over then, or the button would appear
        // permanently broken.
        expect(RESEND_COOLDOWN_SECONDS).toBeLessThan(SIGNUP_OTP_TTL_SECONDS);
        expect(
            SignUpOtpRepository.cooldownRemaining(sentAt, at(SIGNUP_OTP_TTL_SECONDS))
        ).toBe(0);
    });
});

describe("AuthService.resendSignUpOtp cooldown gate", () => {
    // The blocking branch cannot be reached through the live API without
    // spending an email from Supabase's 2-per-hour built-in quota, so the one
    // DB read it depends on is stubbed. Everything else is the real code path —
    // and because the gate throws before gotrue is reached, no request leaves
    // the process, which is what the suite's no-network rule requires.
    const realRead = SignUpOtpRepository.findConfirmationSentAt;

    afterEach(() => {
        SignUpOtpRepository.findConfirmationSentAt = realRead;
    });

    it("refuses a resend inside the cooldown, naming the wait, without calling Supabase", async () => {
        SignUpOtpRepository.findConfirmationSentAt = async () =>
            new Date(Date.now() - 10_000); // sent 10s ago

        await expect(AuthService.resendSignUpOtp("someone@example.com")).rejects.toMatchObject({
            statusCode: 429,
            // ~50s left of the 60s cooldown; the exact second is not the point,
            // that a duration is quoted at all is.
            message: expect.stringMatching(/wait \d+ seconds before requesting another code/i),
        });
    });

    // The complementary case — cooldown elapsed, so the call proceeds to
    // Supabase — is deliberately NOT tested here: past the gate the real
    // gotrue.resendSignUpOtp fires, and a test that reaches the network is
    // flaky and rate-limit-dependent. `cooldownRemaining` covers the arithmetic
    // above, and the passthrough was confirmed against a running server, whose
    // trace showed "POST /resend (type=signup) -> supabase" for a send far
    // outside the window.
});

describe("expired and incorrect stay distinguishable", () => {
    it("uses different codes and statuses for the two rejections", () => {
        // GoTrue answers 403 otp_expired for BOTH a stale and a wrong code, so
        // this separation is the app's, and the page depends on it: only
        // OtpExpiredError may reveal the resend button. If these ever collide, a
        // user who mistyped would be told to wait for a new email instead.
        const expired = new OtpExpiredError();
        const incorrect = new BadRequestError(
            "Incorrect verification code. Please check and try again."
        );

        expect(expired.name).not.toBe(incorrect.name);
        expect(expired.statusCode).not.toBe(incorrect.statusCode);
        expect(incorrect.statusCode).toBe(400);
    });
});
