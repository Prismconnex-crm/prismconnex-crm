import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the one shared reader for SUPABASE_URL / SUPABASE_ANON_KEY.
 *
 * These exist because of a real misconfiguration that cost a debugging session:
 * `.env` carried `SUPABASE_ANON_KEY=""` — present, parseable, and empty — while
 * the real key sat on a line reading `SUPERBASE_ANON_KEY : "..."`, which dotenv
 * cannot parse at all (misspelt, and `:` where `=` belongs). Sign-in then failed
 * with "Set SUPABASE_URL and SUPABASE_ANON_KEY in .env" even though SUPABASE_URL
 * was set correctly, which sent the search in the wrong direction.
 *
 * So the message must name only what is actually missing, and an empty or
 * whitespace-only value must count as missing rather than being passed through
 * to GoTrue as a blank bearer token.
 */

async function load() {
    return import("@/lib/supabase/config");
}

beforeEach(() => {
    vi.resetModules();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
});

describe("readSupabaseConfig", () => {
    it("names only the missing variable when the other one is set", async () => {
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = "";

        const { readSupabaseConfig } = await load();

        expect(() => readSupabaseConfig("Auth")).toThrowError(/SUPABASE_ANON_KEY/);
        expect(() => readSupabaseConfig("Auth")).not.toThrowError(/SUPABASE_URL/);
    });

    it("names the URL when it is the missing one", async () => {
        process.env.SUPABASE_ANON_KEY = "anon-key";

        const { readSupabaseConfig } = await load();

        expect(() => readSupabaseConfig("Auth")).toThrowError(/SUPABASE_URL/);
        expect(() => readSupabaseConfig("Auth")).not.toThrowError(/SUPABASE_ANON_KEY/);
    });

    it("names both when both are missing", async () => {
        const { readSupabaseConfig } = await load();

        expect(() => readSupabaseConfig("Auth")).toThrowError(/SUPABASE_URL/);
        expect(() => readSupabaseConfig("Auth")).toThrowError(/SUPABASE_ANON_KEY/);
    });

    it("treats a whitespace-only value as missing", async () => {
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = "   ";

        const { readSupabaseConfig } = await load();

        expect(() => readSupabaseConfig("Auth")).toThrowError(/SUPABASE_ANON_KEY/);
    });

    it("carries the calling feature into the message", async () => {
        const { readSupabaseConfig } = await load();

        expect(() => readSupabaseConfig("Storage")).toThrowError(/Supabase Storage is not configured/);
    });

    it("trims surrounding whitespace and strips a trailing slash from the URL", async () => {
        process.env.SUPABASE_URL = "  https://project-ref.supabase.co/  ";
        process.env.SUPABASE_ANON_KEY = "  anon-key  ";

        const { readSupabaseConfig } = await load();

        expect(readSupabaseConfig("Auth")).toEqual({
            url: "https://project-ref.supabase.co",
            anonKey: "anon-key",
        });
    });

    it("rejects a service_role key, which must never reach the browser-facing flows", async () => {
        // A service_role JWT bypasses row-level security. It is a plausible
        // paste into this slot — both keys sit side by side in the Supabase
        // dashboard — and nothing downstream would notice, so the check is here.
        // Payload: {"role":"service_role"}
        const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = `header.${payload}.signature`;

        const { readSupabaseConfig } = await load();

        expect(() => readSupabaseConfig("Auth")).toThrowError(/service_role/);
    });

    it("accepts a normal anon key", async () => {
        const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = `header.${payload}.signature`;

        const { readSupabaseConfig } = await load();

        expect(readSupabaseConfig("Auth").anonKey).toBe(`header.${payload}.signature`);
    });

    it("accepts an opaque non-JWT key rather than guessing", async () => {
        // Supabase's newer publishable keys are not JWTs. Only a decodable
        // service_role claim is rejected; anything unparseable is left alone.
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = "sb_publishable_abc123";

        const { readSupabaseConfig } = await load();

        expect(readSupabaseConfig("Auth").anonKey).toBe("sb_publishable_abc123");
    });
});

describe("isSupabaseConfigured", () => {
    it("is false for an empty value, matching the reader's definition of missing", async () => {
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = "  ";

        const { isSupabaseConfigured } = await load();

        expect(isSupabaseConfigured()).toBe(false);
    });

    it("is true when both are set", async () => {
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_ANON_KEY = "anon-key";

        const { isSupabaseConfigured } = await load();

        expect(isSupabaseConfigured()).toBe(true);
    });
});
