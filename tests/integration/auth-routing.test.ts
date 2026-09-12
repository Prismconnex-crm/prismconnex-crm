import { describe, expect, it } from "vitest";
import {
  EXPIRED_SESSION_SIGN_IN_HREF,
  hasExpiredSessionFlag,
  resolveAuthRedirect,
  shouldForceSignIn,
  TRADE_SHOW_TICKET_SIGN_IN_HREF,
} from "@/lib/auth/routing";

describe("trade show ticket auth routing", () => {
  it("keeps the forced sign-in target stable for trade show ticket CTAs", () => {
    expect(TRADE_SHOW_TICKET_SIGN_IN_HREF).toBe("/auth/sign-in?forceSignIn=1");
  });

  it("keeps signed-in users on the default sign-in route redirected to the dashboard", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/auth/sign-in",
        locale: "en-US",
        session: true,
        onboarded: false,
        forceSignIn: false,
      })
    ).toBe("/app/dashboard");
  });

  it("allows the forced sign-in route to render even when a session exists", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/auth/sign-in",
        locale: "en-US",
        session: true,
        onboarded: false,
        forceSignIn: true,
      })
    ).toBeNull();
  });
});

/**
 * A stale pcx_session cookie used to deadlock the app: middleware saw a cookie
 * and sent /auth/sign-in to /app/dashboard, while the server guard verified the
 * same cookie, failed, and sent it back — ERR_TOO_MANY_REDIRECTS on every page,
 * with no route left that could clear the cookie.
 */
describe("rejected session recovery", () => {
  it("keeps the guards' sign-in target stable", () => {
    expect(EXPIRED_SESSION_SIGN_IN_HREF).toBe("/auth/sign-in?sessionExpired=1");
  });

  it("treats the expired flag as a reason to render the form", () => {
    const params = new URLSearchParams("sessionExpired=1");

    expect(hasExpiredSessionFlag(params)).toBe(true);
    expect(shouldForceSignIn(params)).toBe(true);
  });

  it("does not mistake the ticket CTA for a rejected session", () => {
    const params = new URLSearchParams("forceSignIn=1");

    expect(shouldForceSignIn(params)).toBe(true);
    expect(hasExpiredSessionFlag(params)).toBe(false);
  });

  it("breaks the loop: the guards' target renders while the cookie is still set", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/auth/sign-in",
        locale: "en-US",
        session: true,
        onboarded: false,
        forceSignIn: shouldForceSignIn(new URLSearchParams("sessionExpired=1")),
      })
    ).toBeNull();
  });

  it("still redirects a signed-out visitor away from the app", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/app/dashboard",
        locale: "en-US",
        session: false,
        onboarded: false,
        forceSignIn: false,
      })
    ).toBe("/auth/sign-in");
  });
});
