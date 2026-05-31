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
