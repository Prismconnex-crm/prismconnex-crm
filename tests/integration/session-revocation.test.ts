import { describe, expect, it } from "vitest";
import { isSessionSuperseded } from "@/lib/auth/session-revocation";

/**
 * pcx_session is a stateless JWT, so a password reset cannot delete anything to
 * evict an intruder. It stamps User.sessionsValidFrom instead, and this
 * predicate is the whole of the resulting rule. Prisma is only imported lazily
 * inside the module's async helpers, so this needs no database.
 */

/** `iat` as jose writes it: whole seconds. */
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

describe("isSessionSuperseded", () => {
  it("accepts every token when the account has never been revoked", () => {
    // The overwhelmingly common case, and why this costs ordinary users nothing.
    expect(isSessionSuperseded(seconds(new Date()), null)).toBe(false);
    expect(isSessionSuperseded(seconds(new Date()), undefined)).toBe(false);
    // Even a token far older than any plausible session stays valid: nothing
    // has been revoked, and expiry is jwtVerify's job, not this function's.
    expect(isSessionSuperseded(0, null)).toBe(false);
  });

  it("rejects a token minted before the revocation", () => {
    const revokedAt = new Date("2026-08-19T12:00:00.000Z");
    const stolen = seconds(new Date("2026-08-19T11:59:59.000Z"));

    expect(isSessionSuperseded(stolen, revokedAt)).toBe(true);
  });

  it("keeps a token minted after the revocation", () => {
    const revokedAt = new Date("2026-08-19T12:00:00.000Z");
    const fresh = seconds(new Date("2026-08-19T12:00:01.000Z"));

    expect(isSessionSuperseded(fresh, revokedAt)).toBe(false);
  });

  it("keeps a token minted during the same second as the revocation", () => {
    // The stamp carries milliseconds; iat does not. Flooring the stamp rather
    // than rounding up is deliberate: the alternative logs out the very user
    // who just reset their password, if they sign in within the same second,
    // which reads as the reset having broken their account.
    const revokedAt = new Date("2026-08-19T12:00:00.750Z");
    const signedInSameSecond = seconds(new Date("2026-08-19T12:00:00.100Z"));

    expect(isSessionSuperseded(signedInSameSecond, revokedAt)).toBe(false);
  });

  it("rejects a token with no usable iat once a revocation exists", () => {
    const revokedAt = new Date("2026-08-19T12:00:00.000Z");

    // Every token signLocalSession mints carries iat, so its absence means a
    // token this app did not build. "Cannot prove it is newer" resolves to
    // reject — but only for an account that has actually revoked something.
    expect(isSessionSuperseded(undefined, revokedAt)).toBe(true);
    expect(isSessionSuperseded(Number.NaN, revokedAt)).toBe(true);
    expect(isSessionSuperseded(undefined, null)).toBe(false);
  });
});
