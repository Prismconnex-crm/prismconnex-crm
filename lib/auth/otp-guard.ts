import { TooManyRequestsError } from "@/lib/http/errors";

/**
 * Attempt and send limits for the signup OTP.
 *
 * Supabase generates, stores, expires and single-uses the code, and it has its
 * own per-IP limits — but every request reaches it from this server's IP, so
 * those limits throttle all users together and never a single attacker. These
 * limits are keyed by the email (and the caller's IP) instead:
 *
 *   verify — 5 wrong codes per email per 15 minutes, then locked out for the
 *            rest of the window. A 6-digit code cannot be brute-forced at that
 *            rate before it expires. A correct code clears the counter.
 *   send   — signup and resend share one budget: 60 s between emails to the
 *            same address and 5 per hour, plus a per-IP cap so one client
 *            cannot spray codes at many addresses.
 *
 * Process-local, like lib/assistant/rate-limit.ts. With several server
 * instances each gets its own counters; move these to a shared store then.
 */

type Window = { count: number; resetAt: number };

class FixedWindowLimiter {
    private windows = new Map<string, Window>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number
    ) {}

    /** Seconds until `key` may act again, or 0 when it is under the limit. */
    retryAfter(key: string, now: number) {
        const w = this.windows.get(key);
        if (!w || w.resetAt <= now) return 0;
        return w.count >= this.limit ? Math.ceil((w.resetAt - now) / 1000) : 0;
    }

    hit(key: string, now: number) {
        const w = this.windows.get(key);
        if (!w || w.resetAt <= now) {
            this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
        } else {
            w.count += 1;
        }
    }

    clear(key: string) {
        this.windows.delete(key);
    }

    clearAll() {
        this.windows.clear();
    }
}

const MINUTE = 60_000;

export const OTP_LIMITS = {
    verifyFailuresPerEmail: 5,
    verifyAttemptsPerIp: 30,
    verifyWindowMs: 15 * MINUTE,
    sendCooldownMs: MINUTE,
    sendsPerEmailPerHour: 5,
    sendsPerIpPerHour: 15,
} as const;

const verifyFailures = new FixedWindowLimiter(
    OTP_LIMITS.verifyFailuresPerEmail,
    OTP_LIMITS.verifyWindowMs
);
const verifyByIp = new FixedWindowLimiter(OTP_LIMITS.verifyAttemptsPerIp, OTP_LIMITS.verifyWindowMs);
const sendCooldown = new FixedWindowLimiter(1, OTP_LIMITS.sendCooldownMs);
const sendsByEmail = new FixedWindowLimiter(OTP_LIMITS.sendsPerEmailPerHour, 60 * MINUTE);
const sendsByIp = new FixedWindowLimiter(OTP_LIMITS.sendsPerIpPerHour, 60 * MINUTE);

function emailKey(email: string) {
    return email.trim().toLowerCase();
}

/** Throws 429 if this email is locked out or this IP is verifying too fast. */
export function assertCanVerify(email: string, ip: string, now = Date.now()) {
    const locked = verifyFailures.retryAfter(emailKey(email), now);
    if (locked) {
        throw new TooManyRequestsError(
            `Too many incorrect codes. Try again in ${Math.ceil(locked / 60)} minute(s), or request a new code.`,
            locked
        );
    }

    const ipWait = verifyByIp.retryAfter(ip, now);
    if (ipWait) {
        throw new TooManyRequestsError("Too many verification attempts. Please wait and try again.", ipWait);
    }
    verifyByIp.hit(ip, now);
}

export function recordVerifyFailure(email: string, now = Date.now()) {
    verifyFailures.hit(emailKey(email), now);
}

export function recordVerifySuccess(email: string) {
    verifyFailures.clear(emailKey(email));
}

/**
 * Throws 429 if another code may not be emailed yet; otherwise spends one send.
 * Called before Supabase is asked, so a refused request costs no email.
 */
export function consumeOtpSend(email: string, ip: string, now = Date.now()) {
    const key = emailKey(email);

    const cooldown = sendCooldown.retryAfter(key, now);
    if (cooldown) {
        throw new TooManyRequestsError(
            `Please wait ${cooldown} seconds before requesting another code.`,
            cooldown
        );
    }

    const hourly = Math.max(sendsByEmail.retryAfter(key, now), sendsByIp.retryAfter(ip, now));
    if (hourly) {
        throw new TooManyRequestsError(
            `Too many codes requested. Try again in ${Math.ceil(hourly / 60)} minute(s).`,
            hourly
        );
    }

    sendCooldown.hit(key, now);
    sendsByEmail.hit(key, now);
    sendsByIp.hit(ip, now);

    // A new code invalidates the old one, so stale failures should not keep
    // the user locked out of trying the code they just received.
    verifyFailures.clear(key);
}

/** First hop of x-forwarded-for, else x-real-ip; "unknown" groups the rest. */
export function clientIp(headers: Headers) {
    return (
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip")?.trim() ||
        "unknown"
    );
}

export function resetOtpGuardForTests() {
    for (const limiter of [verifyFailures, verifyByIp, sendCooldown, sendsByEmail, sendsByIp]) {
        limiter.clearAll();
    }
}
