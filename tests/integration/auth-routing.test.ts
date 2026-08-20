import { describe, expect, it } from "vitest";
import { resolveAuthRedirect, TRADE_SHOW_TICKET_SIGN_IN_HREF } from "@/lib/auth/routing";

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

describe("auth landing routing", () => {
  // /auth/sign-in and /auth/sign-up both render AuthLanding, and its Login /
  // Sign Up tabs switch between the two forms in-page. A tab switch is a
  // history.replaceState, not a navigation, so middleware never re-runs — which
  // means a guard covering only /auth/sign-in can be stepped around by opening
  // /auth/sign-up and clicking Login.
  it("redirects a signed-in user away from the sign-up route", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/auth/sign-up",
        locale: "en-US",
        session: true,
        onboarded: false,
        forceSignIn: false,
      })
    ).toBe("/app/dashboard");
  });

  it("allows the forced sign-in escape hatch on the sign-up route too", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/auth/sign-up",
        locale: "en-US",
        session: true,
        onboarded: false,
        forceSignIn: true,
      })
    ).toBeNull();
  });

  it("leaves signed-out visitors on the sign-up route", () => {
    expect(
      resolveAuthRedirect({
        pathnameWithoutLocale: "/auth/sign-up",
        locale: "en-US",
        session: false,
        onboarded: false,
        forceSignIn: false,
      })
    ).toBeNull();
  });

  // The recovery and verify routes must stay reachable with a session: a user
  // who is still signed in on this device can legitimately be completing a
  // reset link or an email confirmation.
  it("does not capture the recovery or verify routes", () => {
    for (const pathnameWithoutLocale of [
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify",
    ]) {
      expect(
        resolveAuthRedirect({
          pathnameWithoutLocale,
          locale: "en-US",
          session: true,
          onboarded: false,
          forceSignIn: false,
        })
      ).toBeNull();
    }
  });
});
