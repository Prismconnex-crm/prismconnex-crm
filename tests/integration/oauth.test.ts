import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

/**
 * Google / Microsoft sign-in via Supabase.
 *
 * The live failure this covers: both providers were disabled in the Supabase
 * dashboard, so GoTrue answered the authorize request with a plain
 *
 *   400 {"error_code":"validation_failed",
 *        "msg":"Unsupported provider: provider is not enabled"}
 *
 * Because /api/auth/oauth/[provider] 302s the browser straight at that URL, the
 * user was left staring at raw JSON on a supabase.co domain with no way back —
 * the app never regained control, so it could not say what was wrong.
 *
 * Two things are pinned here:
 *   1. the wire details that are easy to get silently wrong (the `azure` slug,
 *      the Azure `email` scope, the S256 challenge), and
 *   2. the error vocabulary the sign-in page renders, so a disabled provider
 *      surfaces as a sentence rather than as the generic "Failed to sign in".
 */

beforeAll(() => {
  // buildAuthorizeUrl() reads these at call time; the test never leaves the
  // process, so a placeholder project URL is enough.
  process.env.SUPABASE_URL = "https://example-project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key-for-tests";
});

describe("buildAuthorizeUrl", () => {
  it("sends Microsoft as the 'azure' provider slug, not 'microsoft'", async () => {
    const { buildAuthorizeUrl } = await import("@/lib/supabase/gotrue");

    const url = new URL(
      buildAuthorizeUrl({
        provider: "microsoft",
        redirectTo: "http://localhost:3000/auth/callback",
        codeChallenge: "challenge",
      })
    );

    expect(url.searchParams.get("provider")).toBe("azure");
  });

  it("requests the 'email' scope for Microsoft", async () => {
    const { buildAuthorizeUrl } = await import("@/lib/supabase/gotrue");

    // Entra ID can issue a token with no email claim under the default scopes.
    // GoTrue then fails the code exchange with "Error getting user email from
    // external provider" — but only *after* the user has consented, so it reads
    // as a broken callback rather than a missing scope.
    const url = new URL(
      buildAuthorizeUrl({
        provider: "microsoft",
        redirectTo: "http://localhost:3000/auth/callback",
        codeChallenge: "challenge",
      })
    );

    expect(url.searchParams.get("scopes")).toBe("email");
  });

  it("leaves Google on its default scopes", async () => {
    const { buildAuthorizeUrl } = await import("@/lib/supabase/gotrue");

    const url = new URL(
      buildAuthorizeUrl({
        provider: "google",
        redirectTo: "http://localhost:3000/auth/callback",
        codeChallenge: "challenge",
      })
    );

    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("scopes")).toBeNull();
  });

  it("points redirect_to at the app callback and uses S256 PKCE", async () => {
    const { buildAuthorizeUrl, createCodeVerifier, createCodeChallenge } = await import(
      "@/lib/supabase/gotrue"
    );

    const verifier = createCodeVerifier();
    const url = new URL(
      buildAuthorizeUrl({
        provider: "google",
        redirectTo: "http://localhost:3000/auth/callback",
        codeChallenge: createCodeChallenge(verifier),
      })
    );

    expect(url.origin).toBe("https://example-project.supabase.co");
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(verifier).digest("base64url")
    );
  });

  it("PKCE verifiers are unique and within the RFC 7636 length range", async () => {
    const { createCodeVerifier } = await import("@/lib/supabase/gotrue");

    const a = createCodeVerifier();
    const b = createCodeVerifier();

    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a.length).toBeLessThanOrEqual(128);
  });
});

describe("isProviderEnabled", () => {
  it("reports a provider that the dashboard has switched off", async () => {
    const { readEnabledProviders } = await import("@/lib/supabase/gotrue");

    // The shape GoTrue returns from GET /auth/v1/settings.
    const settings = { external: { email: true, google: false, azure: false } };

    expect(readEnabledProviders(settings, "google")).toBe(false);
    expect(readEnabledProviders(settings, "microsoft")).toBe(false);
  });

  it("reports a provider that the dashboard has switched on", async () => {
    const { readEnabledProviders } = await import("@/lib/supabase/gotrue");

    const settings = { external: { email: true, google: true, azure: true } };

    expect(readEnabledProviders(settings, "google")).toBe(true);
    expect(readEnabledProviders(settings, "microsoft")).toBe(true);
  });

  it("assumes enabled when the settings payload is unreadable", async () => {
    const { readEnabledProviders } = await import("@/lib/supabase/gotrue");

    // Fail open: the check is a diagnostic, so a settings outage or a GoTrue
    // version that renames the field must not block an otherwise working login.
    expect(readEnabledProviders({}, "google")).toBe(true);
    expect(readEnabledProviders(null, "google")).toBe(true);
  });
});

describe("resolveOAuthErrorCode", () => {
  it("keeps the codes our own routes emit", async () => {
    const { resolveOAuthErrorCode } = await import("@/lib/auth/oauth-errors");

    expect(resolveOAuthErrorCode("provider_disabled")).toBe("provider_disabled");
    expect(resolveOAuthErrorCode("expired_oauth_state")).toBe("expired_oauth_state");
    expect(resolveOAuthErrorCode("oauth_exchange_failed")).toBe("oauth_exchange_failed");
    expect(resolveOAuthErrorCode("missing_code")).toBe("missing_code");
    expect(resolveOAuthErrorCode("unsupported_provider")).toBe("unsupported_provider");
    expect(resolveOAuthErrorCode("provider_unavailable")).toBe("provider_unavailable");
  });

  it("keeps 'access_denied', which the provider itself sends on cancel", async () => {
    const { resolveOAuthErrorCode } = await import("@/lib/auth/oauth-errors");

    expect(resolveOAuthErrorCode("access_denied")).toBe("access_denied");
  });

  it("folds anything unrecognised into 'unknown' rather than echoing it", async () => {
    const { resolveOAuthErrorCode } = await import("@/lib/auth/oauth-errors");

    // The value lands in the URL, so it is attacker-controlled — it must never
    // be used to index a message table directly.
    expect(resolveOAuthErrorCode("server_error")).toBe("unknown");
    expect(resolveOAuthErrorCode("<img src=x onerror=alert(1)>")).toBe("unknown");
    expect(resolveOAuthErrorCode(null)).toBe("unknown");
  });
});

describe("sign-in message catalogue", () => {
  it("every locale can render every OAuth error code", async () => {
    const { OAUTH_ERROR_CODES } = await import("@/lib/auth/oauth-errors");
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    // Read rather than import(): a template-literal dynamic import makes Vite
    // warn and try to bundle the whole directory.
    //
    // next-intl throws on a missing key at render time, so an untranslated
    // locale would turn a helpful error into a crash on the sign-in page.
    const files = readdirSync("messages").filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const messages = JSON.parse(readFileSync(join("messages", file), "utf8"));
      const oauth = messages.auth?.signIn?.errors?.oauth;

      expect(oauth, `${file} is missing auth.signIn.errors.oauth`).toBeDefined();

      for (const code of [...OAUTH_ERROR_CODES, "unknown"]) {
        expect(
          typeof oauth[code] === "string" && oauth[code].length > 0,
          `${file} is missing auth.signIn.errors.oauth.${code}`
        ).toBe(true);
      }
    }
  });
});
