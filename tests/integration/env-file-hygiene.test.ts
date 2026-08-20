import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the `.env` file itself, not the code that reads it.
 *
 * tests/integration/supabase-config.test.ts already proves the reader treats an
 * empty value as missing and names only what is absent. That reader was correct
 * on 2026-08-20 and sign-in still failed: `.env` declared SUPABASE_ANON_KEY
 * twice — the real key near the top, then a stale placeholder block at the end
 * re-declaring it as "". dotenv is last-wins within a single file, so the blank
 * won and the reader was right to complain.
 *
 * No unit test of lib/supabase/config.ts can catch that, because the defect
 * lives in gitignored data rather than in code. These checks look at the file.
 *
 * `.env` is gitignored, so it is absent in CI — the suite skips rather than
 * fails there. It earns its keep on a developer machine, which is the only
 * place the mistake can be made.
 */

const ENV_PATH = path.join(__dirname, "..", "..", ".env");
const envExists = fs.existsSync(ENV_PATH);

/** Assignment lines only: `KEY=value`. Comments and blanks are ignored. */
function assignments(source: string): { key: string; value: string; line: number }[] {
    return source.split(/\r?\n/).flatMap((text, index) => {
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(text);
        return match ? [{ key: match[1], value: match[2], line: index + 1 }] : [];
    });
}

/** Last-wins, mirroring how dotenv resolves a repeated key within one file. */
function resolve(source: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const { key, value } of assignments(source)) out[key] = unquote(value);
    return out;
}

/** Strips one layer of matching quotes, the way dotenv does. */
function unquote(value: string): string {
    const trimmed = value.trim();
    const quoted = /^(["'])([\s\S]*)\1$/.exec(trimmed);
    return (quoted ? quoted[2] : trimmed).trim();
}

describe.skipIf(!envExists)(".env file hygiene", () => {
    const source = envExists ? fs.readFileSync(ENV_PATH, "utf8") : "";

    it("declares each variable exactly once", () => {
        const seen: Record<string, number[]> = {};
        for (const { key, line } of assignments(source)) {
            seen[key] = (seen[key] ?? []).concat(line);
        }

        const duplicated = Object.keys(seen)
            .filter((key) => seen[key].length > 1)
            .map((key) => `${key} (lines ${seen[key].join(", ")})`);

        // A duplicate is not merely untidy: the last one silently wins, so the
        // value a reader sees at the top of the file may not be the live one.
        expect(duplicated).toEqual([]);
    });

    it("gives the Supabase auth variables a non-empty value", () => {
        const resolved = resolve(source);

        for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
            expect(resolved[key], `${key} is missing from .env`).toBeDefined();
            expect(resolved[key], `${key} is present but empty in .env`).not.toBe("");
        }
    });

    it("does not hold a service_role key in SUPABASE_ANON_KEY", () => {
        const anonKey = resolve(source).SUPABASE_ANON_KEY ?? "";
        const parts = anonKey.split(".");
        if (parts.length !== 3) return; // opaque publishable key — nothing to decode

        let role: unknown = null;
        try {
            role = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))?.role;
        } catch {
            return;
        }

        // The two keys sit next to each other in the Supabase dashboard and a
        // service_role key bypasses row-level security entirely.
        expect(role).not.toBe("service_role");
    });
});
