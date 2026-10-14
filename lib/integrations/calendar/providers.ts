/**
 * Calendar providers for the Integrations page.
 *
 * Isomorphic and dependency-free: the client imports this for labels and the
 * provider list, the server for URLs and scope checks. Nothing here reads a
 * secret's value — `missingCalendarEnv` only reports which names are absent.
 *
 * WHY NOT REUSE SUPABASE'S GOOGLE/MICROSOFT SIGN-IN
 * Sign-in (/api/auth/oauth/[provider]) goes through Supabase Auth, which asks
 * only for identity scopes and never hands the app a refreshable provider
 * token. Calendar access needs its own consent (calendar scopes, offline
 * access) against the app's own OAuth client, so this is authorization for API
 * access layered next to sign-in — not a second login system. The same Google
 * Cloud / Entra app registrations can be reused; they just need the redirect
 * URIs below added.
 *
 * Microsoft 365 and Outlook are one Microsoft OAuth app with two tenants:
 * `organizations` (work/school accounts) and `consumers` (outlook.com /
 * hotmail.com personal accounts).
 */

export const CALENDAR_PROVIDERS = ["google", "microsoft365", "outlook"] as const;
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];

/** The OAuth client registration a provider uses. */
export type CalendarOAuthApp = "google" | "microsoft";

export const CALENDAR_OAUTH_APPS: readonly CalendarOAuthApp[] = ["google", "microsoft"];

export const CALENDAR_PROVIDER_META: Record<
    CalendarProvider,
    { label: string; description: string; accountHint: string }
> = {
    google: {
        label: "Google Calendar",
        description: "Gmail and Google Workspace calendars",
        accountHint: "Google account",
    },
    microsoft365: {
        label: "Microsoft 365",
        description: "Work or school Microsoft accounts",
        accountHint: "work or school account",
    },
    outlook: {
        label: "Outlook",
        description: "Personal Outlook.com, Hotmail and Live accounts",
        accountHint: "personal Microsoft account",
    },
};

export function isCalendarProvider(value: unknown): value is CalendarProvider {
    return typeof value === "string" && (CALENDAR_PROVIDERS as readonly string[]).includes(value);
}

export function isCalendarOAuthApp(value: unknown): value is CalendarOAuthApp {
    return value === "google" || value === "microsoft";
}

export function oauthAppFor(provider: CalendarProvider): CalendarOAuthApp {
    return provider === "google" ? "google" : "microsoft";
}

/** Tokens are encrypted with a key derived from this; shorter is refused. */
export const MIN_ENCRYPTION_KEY_LENGTH = 32;

type Env = Record<string, string | undefined>;

function present(value: string | undefined) {
    return Boolean(value && value.trim());
}

/** Names (never values) of the env vars this provider still needs. */
export function missingCalendarEnv(provider: CalendarProvider, env: Env = process.env): string[] {
    const prefix = oauthAppFor(provider) === "google" ? "GOOGLE" : "MICROSOFT";
    const missing: string[] = [];

    if (!present(env[`${prefix}_CLIENT_ID`])) missing.push(`${prefix}_CLIENT_ID`);
    if (!present(env[`${prefix}_CLIENT_SECRET`])) missing.push(`${prefix}_CLIENT_SECRET`);

    const key = env.INTEGRATIONS_ENCRYPTION_KEY?.trim() ?? "";
    if (key.length < MIN_ENCRYPTION_KEY_LENGTH) missing.push("INTEGRATIONS_ENCRYPTION_KEY");

    return missing;
}

/**
 * The callback URL registered with the provider. One per OAuth app — Microsoft
 * 365 and Outlook share it, the variant travels in the encrypted state cookie.
 */
export function calendarRedirectUri(app: CalendarOAuthApp, origin: string, env: Env = process.env) {
    const override =
        app === "google" ? env.GOOGLE_CALENDAR_REDIRECT_URI : env.MICROSOFT_CALENDAR_REDIRECT_URI;
    if (present(override)) return override!.trim();

    return `${origin.replace(/\/$/, "")}/api/integrations/calendar/callback/${app}`;
}

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
// calendar.events alone cannot list the user's calendars (calendarList.list).
const GOOGLE_CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const GOOGLE_SCOPES = ["openid", "email", GOOGLE_CALENDAR_SCOPE, GOOGLE_CALENDAR_LIST_SCOPE];

const MICROSOFT_CALENDAR_SCOPE = "Calendars.ReadWrite";
const MICROSOFT_SCOPES = ["openid", "email", "profile", "offline_access", "User.Read", MICROSOFT_CALENDAR_SCOPE];

export function microsoftTenantFor(provider: CalendarProvider) {
    return provider === "outlook" ? "consumers" : "organizations";
}

export function calendarTokenEndpoint(provider: CalendarProvider) {
    return provider === "google"
        ? "https://oauth2.googleapis.com/token"
        : `https://login.microsoftonline.com/${microsoftTenantFor(provider)}/oauth2/v2.0/token`;
}

export function calendarScopesFor(provider: CalendarProvider) {
    return (provider === "google" ? GOOGLE_SCOPES : MICROSOFT_SCOPES).join(" ");
}

export function buildCalendarAuthorizeUrl(params: {
    provider: CalendarProvider;
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
}) {
    const { provider } = params;
    const url =
        provider === "google"
            ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
            : new URL(
                  `https://login.microsoftonline.com/${microsoftTenantFor(provider)}/oauth2/v2.0/authorize`
              );

    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", calendarScopesFor(provider));
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    if (provider === "google") {
        // offline + consent is what makes Google return a refresh token every
        // time, including on a reconnect.
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("include_granted_scopes", "true");
    } else {
        url.searchParams.set("response_mode", "query");
        url.searchParams.set("prompt", "select_account");
    }

    return url.toString();
}

/**
 * Whether the granted scopes include calendar access. Google's consent screen
 * lets the user untick individual scopes, and Microsoft reports scopes either
 * bare or resource-qualified (https://graph.microsoft.com/Calendars.ReadWrite).
 */
export function hasCalendarScope(provider: CalendarProvider, granted: string | undefined | null) {
    const scopes = (granted ?? "").split(/\s+/).filter(Boolean);
    if (provider === "google") return scopes.includes(GOOGLE_CALENDAR_SCOPE);

    return scopes.some((scope) => {
        const bare = scope.split("/").pop()?.toLowerCase();
        return bare === "calendars.readwrite";
    });
}

/**
 * Claims from an id_token. Not signature-checked: the token came straight from
 * the provider's token endpoint over TLS in this same request (OIDC Core
 * 3.1.3.7 allows this), and it is only used to label the connected account.
 */
export function readIdTokenClaims(idToken: string | undefined): {
    email?: string;
    preferred_username?: string;
    name?: string;
} {
    if (!idToken) return {};
    const part = idToken.split(".")[1];
    if (!part) return {};

    try {
        const json =
            typeof atob === "function" && typeof Buffer === "undefined"
                ? atob(part.replace(/-/g, "+").replace(/_/g, "/"))
                : Buffer.from(part, "base64url").toString("utf8");
        const claims = JSON.parse(json);
        return claims && typeof claims === "object" ? claims : {};
    } catch {
        return {};
    }
}
