import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig, readSupabaseConfig } from "@/lib/supabase/config";

const jwt = (role: string) =>
    ["e30", Buffer.from(JSON.stringify({ role, ref: "abc" })).toString("base64url"), "sig"].join(".");

describe("readSupabaseConfig", () => {
    it("accepts the anon key and strips a trailing slash from the URL", () => {
        const result = readSupabaseConfig({
            SUPABASE_URL: "https://abc.supabase.co/",
            SUPABASE_ANON_KEY: jwt("anon"),
        });
        expect(result).toEqual({
            ok: true,
            config: { url: "https://abc.supabase.co", anonKey: jwt("anon") },
        });
    });

    it("accepts the new publishable key format", () => {
        const result = readSupabaseConfig({
            SUPABASE_URL: "https://abc.supabase.co",
            SUPABASE_ANON_KEY: "sb_publishable_xyz",
        });
        expect(result.ok).toBe(true);
    });

    it("names each missing variable and points at .env.local", () => {
        const result = readSupabaseConfig({});
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.problems).toHaveLength(2);
        expect(result.problems[0]).toMatch(/SUPABASE_URL is not set.*\.env\.local/);
        expect(result.problems[1]).toMatch(/SUPABASE_ANON_KEY is not set/);
    });

    it("treats whitespace-only values as missing", () => {
        const result = readSupabaseConfig({ SUPABASE_URL: "  ", SUPABASE_ANON_KEY: " " });
        expect(result.ok).toBe(false);
    });

    it("rejects a malformed URL", () => {
        const result = readSupabaseConfig({ SUPABASE_URL: "abc.supabase.co", SUPABASE_ANON_KEY: "k" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.problems[0]).toMatch(/not a valid URL/);
    });

    it.each([jwt("service_role"), "sb_secret_abc"])("rejects a service_role/secret key (%s)", (key) => {
        const result = readSupabaseConfig({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: key });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.problems[0]).toMatch(/service_role\/secret key/);
    });

    it("flags a secret key exposed with a NEXT_PUBLIC_ prefix", () => {
        const result = readSupabaseConfig({
            SUPABASE_URL: "https://abc.supabase.co",
            SUPABASE_ANON_KEY: jwt("anon"),
            NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "x",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.problems[0]).toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
    });
});

describe("getSupabaseConfig", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("throws a 500 ApiError naming the missing variable", () => {
        vi.stubEnv("SUPABASE_URL", "");
        vi.stubEnv("SUPABASE_ANON_KEY", "");
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => getSupabaseConfig("Auth")).toThrow(/Supabase Auth is not configured: SUPABASE_URL is not set/);
        try {
            getSupabaseConfig("Storage");
        } catch (error) {
            expect((error as { statusCode?: number }).statusCode).toBe(500);
        }
    });
});
