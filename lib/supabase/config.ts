import { InternalServerError } from "@/lib/http/errors";

/**
 * The single reader for SUPABASE_URL / SUPABASE_ANON_KEY.
 *
 * Both lib/supabase/gotrue.ts and lib/supabase/storage.ts previously carried a
 * byte-identical `config()`, so a fix to one silently missed the other. There is
 * no Supabase SDK client to share here — this project talks to GoTrue and
 * Storage over plain fetch — so the shared thing is the credential read.
 *
 * Server-only. Neither variable is NEXT_PUBLIC_, and neither should become one:
 * every call runs inside a route handler, so nothing needs them in the bundle.
 */

/** Trimmed, with unset and blank collapsing to "" so both read as missing. */
function read(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string {
    const value = process.env[name];
    return typeof value === "string" ? value.trim() : "";
}

export function isSupabaseConfigured(): boolean {
    return Boolean(read("SUPABASE_URL") && read("SUPABASE_ANON_KEY"));
}

/**
 * The `role` claim of a Supabase JWT, or null for anything not decodable.
 *
 * Deliberately forgiving: Supabase's newer publishable keys (`sb_publishable_…`)
 * are opaque rather than JWTs, so an undecodable key is accepted rather than
 * guessed at. Only a positively identified service_role claim is rejected.
 */
function jwtRole(key: string): string | null {
    const parts = key.split(".");
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return typeof payload?.role === "string" ? payload.role : null;
    } catch {
        return null;
    }
}

/**
 * Reads and validates the pair, or throws a message that says what to fix.
 *
 * `feature` names the caller ("Auth", "Storage") so the message points at the
 * flow the user was actually in.
 *
 * The message lists only the variables genuinely missing. The previous version
 * named both unconditionally, which is what made a real misconfiguration hard to
 * find: SUPABASE_URL was set correctly and only the key was blank, but the error
 * accused both.
 */
export function readSupabaseConfig(feature: string): { url: string; anonKey: string } {
    const url = read("SUPABASE_URL");
    const anonKey = read("SUPABASE_ANON_KEY");

    const missing: string[] = [];
    if (!url) missing.push("SUPABASE_URL");
    if (!anonKey) missing.push("SUPABASE_ANON_KEY");

    if (missing.length > 0) {
        throw new InternalServerError(
            `Supabase ${feature} is not configured. Set ${missing.join(" and ")} in .env. ` +
                `A present-but-empty value counts as unset, and each line must read NAME=value ` +
                `— a colon instead of an equals sign makes the whole line invisible to dotenv.`
        );
    }

    // A service_role key bypasses row-level security entirely. The two keys sit
    // next to each other in the Supabase dashboard, so pasting the wrong one is
    // an easy mistake, and nothing downstream would report it — GoTrue accepts
    // it happily. Failing loudly here is the only place it gets caught.
    if (jwtRole(anonKey) === "service_role") {
        throw new InternalServerError(
            `SUPABASE_ANON_KEY holds a service_role key, which bypasses row-level security ` +
                `and must never be used by request-path code. Use the anon/publishable key ` +
                `from Supabase → Project Settings → API.`
        );
    }

    return { url: url.replace(/\/$/, ""), anonKey };
}
