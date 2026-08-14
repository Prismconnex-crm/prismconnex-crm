import { describe, expect, it } from "vitest";
import { createRecoveryLinkReader, parseRecoveryLink } from "@/lib/auth/recovery-link";

/**
 * Supabase hands the recovery token back in one of two shapes depending on the
 * project's email template, and the reset page has to cope with both:
 *
 *   default template  ({{ .ConfirmationURL }})
 *     -> GoTrue verifies server-side and 302s to us with the session in the
 *        URL *fragment*: #access_token=...&type=recovery
 *
 *   documented template ({{ .TokenHash }})
 *     -> the link lands on us directly with ?token_hash=...&type=recovery,
 *        and we verify it ourselves.
 *
 * Failures (expired/reused links) arrive in the fragment too, which is why a
 * plain "no token" check is not enough to tell the user what went wrong.
 */
describe("parseRecoveryLink", () => {
  it("reads the access token from the default-template fragment", () => {
    const result = parseRecoveryLink({
      search: "",
      hash: "#access_token=abc123&refresh_token=r1&expires_in=3600&token_type=bearer&type=recovery",
    });

    expect(result).toEqual({ kind: "access_token", accessToken: "abc123" });
  });

  it("reads the token hash from the documented query-param template", () => {
    const result = parseRecoveryLink({
      search: "?token_hash=pkce_9f8e7d&type=recovery",
      hash: "",
    });

    expect(result).toEqual({ kind: "token_hash", tokenHash: "pkce_9f8e7d" });
  });

  it("tolerates a leading '#'/'?' being absent", () => {
    expect(parseRecoveryLink({ search: "", hash: "access_token=abc" })).toEqual({
      kind: "access_token",
      accessToken: "abc",
    });
    expect(parseRecoveryLink({ search: "token_hash=xyz", hash: "" })).toEqual({
      kind: "token_hash",
      tokenHash: "xyz",
    });
  });

  it("prefers the fragment token when both are somehow present", () => {
    const result = parseRecoveryLink({
      search: "?token_hash=xyz",
      hash: "#access_token=abc&type=recovery",
    });

    expect(result).toEqual({ kind: "access_token", accessToken: "abc" });
  });

  it("surfaces an expired link as an error, not as a missing token", () => {
    const result = parseRecoveryLink({
      search: "",
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    });

    expect(result).toEqual({
      kind: "error",
      code: "otp_expired",
      description: "Email link is invalid or has expired",
    });
  });

  it("decodes %20-escaped error descriptions", () => {
    const result = parseRecoveryLink({
      search: "?error=access_denied&error_description=Email%20link%20is%20invalid",
      hash: "",
    });

    expect(result).toEqual({
      kind: "error",
      code: "access_denied",
      description: "Email link is invalid",
    });
  });

  it("falls back to the error code when no description is supplied", () => {
    const result = parseRecoveryLink({ search: "", hash: "#error_code=otp_expired" });

    expect(result).toEqual({ kind: "error", code: "otp_expired", description: null });
  });

  it("reports a bare visit to the page as missing", () => {
    expect(parseRecoveryLink({ search: "", hash: "" })).toEqual({ kind: "missing" });
    expect(parseRecoveryLink({ search: "?", hash: "#" })).toEqual({ kind: "missing" });
  });

  it("ignores an empty-string token rather than treating it as valid", () => {
    expect(parseRecoveryLink({ search: "?token_hash=", hash: "#access_token=" })).toEqual({
      kind: "missing",
    });
  });
});

/**
 * The reset page reads the URL and scrubs the credential out of the address bar
 * in the same step. That made the read destructive: a second read saw a bare
 * pathname and reported `missing`, which the UI renders as "Invalid reset link".
 *
 * React StrictMode guarantees that second read in development — the App Router
 * turns it on whenever next.config.mjs omits `reactStrictMode`, and it runs
 * mount effects twice on purpose. So every valid recovery link failed locally.
 */
describe("createRecoveryLinkReader", () => {
  const LANDED = {
    search: "",
    hash: "#access_token=abc123&refresh_token=r1&type=recovery",
  };
  /** What window.location looks like after history.replaceState scrubs it. */
  const SCRUBBED = { search: "", hash: "" };

  it("keeps returning the token after the URL has been scrubbed", () => {
    const read = createRecoveryLinkReader();

    expect(read(LANDED)).toEqual({ kind: "access_token", accessToken: "abc123" });
    // The StrictMode second pass. Before the fix this returned { kind: "missing" }.
    expect(read(SCRUBBED)).toEqual({ kind: "access_token", accessToken: "abc123" });
  });

  it("stays idempotent across any number of re-reads", () => {
    const read = createRecoveryLinkReader();
    read({ search: "?token_hash=pkce_9f8e7d&type=recovery", hash: "" });

    for (let i = 0; i < 5; i += 1) {
      expect(read(SCRUBBED)).toEqual({ kind: "token_hash", tokenHash: "pkce_9f8e7d" });
    }
  });

  it("still reports a genuinely bare visit as missing", () => {
    const read = createRecoveryLinkReader();

    expect(read(SCRUBBED)).toEqual({ kind: "missing" });
  });

  it("gives each mounted page its own reader", () => {
    const first = createRecoveryLinkReader();
    first(LANDED);

    // A new visit must not inherit the previous page's token.
    expect(createRecoveryLinkReader()(SCRUBBED)).toEqual({ kind: "missing" });
  });
});

describe("parseRecoveryLink — PKCE", () => {
  it("recognises the ?code= shape instead of calling it missing", () => {
    expect(parseRecoveryLink({ search: "?code=9c1f4b2e-aaaa", hash: "" })).toEqual({
      kind: "code",
      code: "9c1f4b2e-aaaa",
    });
  });

  it("prefers token_hash over code when a link carries both", () => {
    expect(parseRecoveryLink({ search: "?token_hash=pkce_abc&code=9c1f", hash: "" })).toEqual({
      kind: "token_hash",
      tokenHash: "pkce_abc",
    });
  });
});
