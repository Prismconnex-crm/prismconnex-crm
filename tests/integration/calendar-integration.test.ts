import { describe, expect, it } from "vitest";

/**
 * Calendar integration (Integrations page → Calendar).
 *
 * The page used to be a static mockup: the Calendar pill and tile had no click
 * handler and "Connected" was hardcoded. These tests pin the pieces that make
 * the real flow correct without touching a provider or a database:
 *   - which env vars each provider needs (so the UI can name what is missing),
 *   - the authorize URLs (scopes, PKCE, offline access, tenant per variant),
 *   - scope checks (a user can untick the calendar box at Google's consent),
 *   - the closed error vocabulary the callback hands back to the page,
 *   - token encryption at rest.
 */

const FULL_ENV = {
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
    MICROSOFT_CLIENT_ID: "ms-id",
    MICROSOFT_CLIENT_SECRET: "ms-secret",
    INTEGRATIONS_ENCRYPTION_KEY: "k".repeat(40),
};

describe("calendar providers", () => {
    it("offers Google, Microsoft 365 and Outlook", async () => {
        const { CALENDAR_PROVIDERS, isCalendarProvider } = await import(
            "@/lib/integrations/calendar/providers"
        );
        expect(CALENDAR_PROVIDERS).toEqual(["google", "microsoft365", "outlook"]);
        expect(isCalendarProvider("outlook")).toBe(true);
        expect(isCalendarProvider("yahoo")).toBe(false);
    });

    it("maps Microsoft 365 and Outlook onto one Microsoft OAuth app", async () => {
        const { oauthAppFor } = await import("@/lib/integrations/calendar/providers");
        expect(oauthAppFor("google")).toBe("google");
        expect(oauthAppFor("microsoft365")).toBe("microsoft");
        expect(oauthAppFor("outlook")).toBe("microsoft");
    });

    it("names exactly the env vars that are missing, never their values", async () => {
        const { missingCalendarEnv } = await import("@/lib/integrations/calendar/providers");
        expect(missingCalendarEnv("google", FULL_ENV)).toEqual([]);
        expect(missingCalendarEnv("google", {})).toEqual([
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "INTEGRATIONS_ENCRYPTION_KEY",
        ]);
        expect(
            missingCalendarEnv("outlook", { ...FULL_ENV, MICROSOFT_CLIENT_SECRET: "  " })
        ).toEqual(["MICROSOFT_CLIENT_SECRET"]);
    });

    it("treats a too-short encryption key as missing", async () => {
        const { missingCalendarEnv } = await import("@/lib/integrations/calendar/providers");
        expect(
            missingCalendarEnv("google", { ...FULL_ENV, INTEGRATIONS_ENCRYPTION_KEY: "short" })
        ).toEqual(["INTEGRATIONS_ENCRYPTION_KEY"]);
    });

    it("derives redirect URIs from the origin unless overridden", async () => {
        const { calendarRedirectUri } = await import("@/lib/integrations/calendar/providers");
        expect(calendarRedirectUri("google", "http://localhost:3000/", {})).toBe(
            "http://localhost:3000/api/integrations/calendar/callback/google"
        );
        expect(calendarRedirectUri("microsoft", "http://localhost:3000", {})).toBe(
            "http://localhost:3000/api/integrations/calendar/callback/microsoft"
        );
        expect(
            calendarRedirectUri("microsoft", "http://localhost:3000", {
                MICROSOFT_CALENDAR_REDIRECT_URI: "https://crm.example.com/cb",
            })
        ).toBe("https://crm.example.com/cb");
    });
});

describe("buildCalendarAuthorizeUrl", () => {
    const base = {
        clientId: "client-123",
        redirectUri: "http://localhost:3000/api/integrations/calendar/callback/google",
        state: "state-abc",
        codeChallenge: "challenge-xyz",
    };

    it("asks Google for offline calendar access with PKCE", async () => {
        const { buildCalendarAuthorizeUrl } = await import("@/lib/integrations/calendar/providers");
        const url = new URL(buildCalendarAuthorizeUrl({ ...base, provider: "google" }));

        expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        expect(url.searchParams.get("client_id")).toBe("client-123");
        expect(url.searchParams.get("response_type")).toBe("code");
        expect(url.searchParams.get("access_type")).toBe("offline");
        expect(url.searchParams.get("prompt")).toBe("consent");
        expect(url.searchParams.get("state")).toBe("state-abc");
        expect(url.searchParams.get("code_challenge")).toBe("challenge-xyz");
        expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        expect(url.searchParams.get("scope")).toContain(
            "https://www.googleapis.com/auth/calendar.events"
        );
    });

    it("sends Microsoft 365 to the work/school tenant and Outlook to the personal one", async () => {
        const { buildCalendarAuthorizeUrl } = await import("@/lib/integrations/calendar/providers");
        const m365 = new URL(buildCalendarAuthorizeUrl({ ...base, provider: "microsoft365" }));
        const outlook = new URL(buildCalendarAuthorizeUrl({ ...base, provider: "outlook" }));

        expect(m365.pathname).toBe("/organizations/oauth2/v2.0/authorize");
        expect(outlook.pathname).toBe("/consumers/oauth2/v2.0/authorize");

        for (const url of [m365, outlook]) {
            expect(url.host).toBe("login.microsoftonline.com");
            const scope = url.searchParams.get("scope") ?? "";
            expect(scope).toContain("offline_access");
            expect(scope).toContain("Calendars.ReadWrite");
            expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        }
    });
});

describe("hasCalendarScope", () => {
    it("fails when the user unticked calendar access at Google", async () => {
        const { hasCalendarScope } = await import("@/lib/integrations/calendar/providers");
        expect(hasCalendarScope("google", "openid email")).toBe(false);
        expect(
            hasCalendarScope(
                "google",
                "openid https://www.googleapis.com/auth/calendar.events email"
            )
        ).toBe(true);
    });

    it("accepts Microsoft's resource-qualified scope names", async () => {
        const { hasCalendarScope } = await import("@/lib/integrations/calendar/providers");
        expect(
            hasCalendarScope("outlook", "https://graph.microsoft.com/Calendars.ReadWrite openid")
        ).toBe(true);
        expect(hasCalendarScope("microsoft365", "Calendars.ReadWrite User.Read")).toBe(true);
        expect(hasCalendarScope("microsoft365", "User.Read openid")).toBe(false);
    });
});

describe("calendar error vocabulary", () => {
    it("gives every code a user-facing message", async () => {
        const { CALENDAR_ERROR_CODES, calendarErrorMessage } = await import(
            "@/lib/integrations/calendar/errors"
        );
        for (const code of CALENDAR_ERROR_CODES) {
            expect(calendarErrorMessage(code).length).toBeGreaterThan(10);
        }
    });

    it("folds unknown or hostile codes into 'unknown'", async () => {
        const { resolveCalendarErrorCode } = await import("@/lib/integrations/calendar/errors");
        expect(resolveCalendarErrorCode("access_denied")).toBe("access_denied");
        expect(resolveCalendarErrorCode("<script>")).toBe("unknown");
        expect(resolveCalendarErrorCode(null)).toBe("unknown");
    });

    it("maps a cancelled consent screen to access_denied", async () => {
        const { providerErrorToCode } = await import("@/lib/integrations/calendar/errors");
        expect(providerErrorToCode("access_denied")).toBe("access_denied");
        expect(providerErrorToCode("consent_required")).toBe("access_denied");
        expect(providerErrorToCode("invalid_client")).toBe("provider_error");
    });
});

describe("parseCalendarReturn", () => {
    it("reads a successful connection", async () => {
        const { parseCalendarReturn } = await import("@/lib/integrations/calendar/errors");
        expect(parseCalendarReturn("?calendar_connected=outlook")).toEqual({
            kind: "connected",
            provider: "outlook",
        });
    });

    it("reads a failure and ignores an unknown provider", async () => {
        const { parseCalendarReturn } = await import("@/lib/integrations/calendar/errors");
        expect(parseCalendarReturn("?calendar_error=access_denied&provider=evil")).toEqual({
            kind: "error",
            code: "access_denied",
            provider: null,
        });
        expect(parseCalendarReturn("?foo=bar")).toBeNull();
    });
});

describe("token encryption", () => {
    it("round-trips and never stores plaintext", async () => {
        const { encryptSecret, decryptSecret } = await import("@/lib/integrations/token-crypto");
        const key = "k".repeat(40);
        const sealed = encryptSecret("ya29.super-secret-token", key);

        expect(sealed).not.toContain("super-secret");
        expect(decryptSecret(sealed, key)).toBe("ya29.super-secret-token");
        // Fresh IV each time.
        expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
    });

    it("rejects tampering and the wrong key", async () => {
        const { encryptSecret, decryptSecret } = await import("@/lib/integrations/token-crypto");
        const key = "k".repeat(40);
        const sealed = encryptSecret("token", key);
        const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");

        expect(() => decryptSecret(tampered, key)).toThrow();
        expect(() => decryptSecret(sealed, "z".repeat(40))).toThrow();
    });
});

describe("readIdTokenClaims", () => {
    it("pulls the account email from an id_token", async () => {
        const { readIdTokenClaims } = await import("@/lib/integrations/calendar/providers");
        const payload = Buffer.from(
            JSON.stringify({ email: "a@b.com", preferred_username: "x@y.com" })
        ).toString("base64url");
        expect(readIdTokenClaims(`h.${payload}.s`)).toMatchObject({ email: "a@b.com" });
        expect(readIdTokenClaims("garbage")).toEqual({});
        expect(readIdTokenClaims(undefined)).toEqual({});
    });
});
