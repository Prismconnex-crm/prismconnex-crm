import { InternalServerError } from "@/lib/http/errors";

/**
 * Single source of truth for the Supabase project settings.
 *
 * Both Auth (gotrue.ts) and Storage (storage.ts) call Supabase over plain REST
 * from the SERVER only — there is no browser Supabase client in this app — so
 * the variables are deliberately unprefixed: `SUPABASE_URL` and
 * `SUPABASE_ANON_KEY`. Next.js loads them from `.env.local` (preferred, git
 * ignored) or `.env`. Never add a `NEXT_PUBLIC_` prefix to a Supabase key, and
 * never put the service_role / secret key here: the anon key is all the app
 * needs, and a service_role key would bypass every RLS policy.
 *
 * The check runs per call rather than at import so a missing value fails the
 * request that needs Supabase with a readable message instead of crashing
 * every page that happens to import an auth module.
 */

export type SupabaseConfig = { url: string; anonKey: string };

export type SupabaseConfigResult =
    | { ok: true; config: SupabaseConfig }
    | { ok: false; problems: string[] };

const ENV_HINT = "Set it in .env.local (or .env) and restart the dev server.";

/** Reads the `role` claim of a legacy JWT-format key without verifying it. */
function jwtRole(key: string): string | undefined {
    const payload = key.split(".")[1];
    if (!payload) return undefined;
    try {
        const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return typeof json?.role === "string" ? json.role : undefined;
    } catch {
        return undefined;
    }
}

/** Pure — takes the environment as an argument so it can be tested directly. */
export function readSupabaseConfig(
    source: Record<string, string | undefined> = process.env
): SupabaseConfigResult {
    const problems: string[] = [];
    const rawUrl = source.SUPABASE_URL?.trim() ?? "";
    const anonKey = source.SUPABASE_ANON_KEY?.trim() ?? "";

    if (!rawUrl) {
        problems.push(`SUPABASE_URL is not set. ${ENV_HINT}`);
    } else {
        try {
            const parsed = new URL(rawUrl);
            if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
                problems.push("SUPABASE_URL must start with https:// (e.g. https://<project-ref>.supabase.co).");
            }
        } catch {
            problems.push("SUPABASE_URL is not a valid URL (expected https://<project-ref>.supabase.co).");
        }
    }

    if (!anonKey) {
        problems.push(`SUPABASE_ANON_KEY is not set. ${ENV_HINT}`);
    } else if (anonKey.startsWith("sb_secret_") || jwtRole(anonKey) === "service_role") {
        problems.push(
            "SUPABASE_ANON_KEY holds a service_role/secret key. Use the anon (public) key from " +
                "Supabase -> Project Settings -> API Keys; the secret key must never be used by this app."
        );
    }

    const leaked = Object.keys(source).filter(
        (name) => /^NEXT_PUBLIC_.*SUPABASE/.test(name) && /SERVICE|SECRET/.test(name) && source[name]
    );
    if (leaked.length) {
        problems.push(
            `${leaked.join(", ")} would be bundled into browser code. Remove it — ` +
                "Supabase secret keys must never have a NEXT_PUBLIC_ prefix."
        );
    }

    if (problems.length) return { ok: false, problems };
    return { ok: true, config: { url: rawUrl.replace(/\/+$/, ""), anonKey } };
}

let warned = false;

/** Returns the config or throws a 500 whose message names exactly what is wrong. */
export function getSupabaseConfig(service: "Auth" | "Storage" = "Auth"): SupabaseConfig {
    const result = readSupabaseConfig();
    if (result.ok) return result.config;

    if (!warned) {
        warned = true;
        console.error(`[supabase] configuration problem:\n  - ${result.problems.join("\n  - ")}`);
    }
    throw new InternalServerError(
        `Supabase ${service} is not configured: ${result.problems.join(" ")}`
    );
}

export function isSupabaseConfigured(): boolean {
    return readSupabaseConfig().ok;
}
