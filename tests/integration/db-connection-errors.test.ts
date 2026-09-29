import { describe, it, expect, vi, afterEach } from "vitest";
import {
    classifyDbConnectionError,
    redactConnectionUrl,
} from "@/lib/db/connection-errors";
import { jsonError } from "@/lib/http/response";
import { UnauthorizedError } from "@/lib/http/errors";

/**
 * Cover for "The database is unavailable. Please try again shortly."
 *
 * That message is produced by jsonError() for exactly one condition — Prisma
 * failing to open a connection — but the branch that produced it discarded
 * Prisma's error code, which is the only thing that separates "the password in
 * DATABASE_URL is wrong" (P1000) from "the host is unreachable or the Supabase
 * project is paused" (P1001) from "the pool is exhausted" (P2024). Losing that
 * is what made the failure undiagnosable from the logs, so these tests pin the
 * classification down.
 */

/** A stand-in for Prisma's error classes — matched by name, never instanceof. */
function prismaInitError(message: string, errorCode?: string) {
    const error = new Error(message);
    error.name = "PrismaClientInitializationError";
    if (errorCode) (error as Error & { errorCode?: string }).errorCode = errorCode;
    return error;
}

function prismaKnownError(message: string, code: string) {
    const error = new Error(message);
    error.name = "PrismaClientKnownRequestError";
    (error as Error & { code?: string }).code = code;
    return error;
}

describe("classifyDbConnectionError", () => {
    it("recognises an initialization failure and keeps Prisma's code", () => {
        const result = classifyDbConnectionError(
            prismaInitError("Can't reach database server", "P1001")
        );

        expect(result).not.toBeNull();
        expect(result?.code).toBe("P1001");
    });

    it("gives a different hint for bad credentials than for an unreachable host", () => {
        const auth = classifyDbConnectionError(prismaInitError("auth failed", "P1000"));
        const unreachable = classifyDbConnectionError(prismaInitError("no route", "P1001"));

        expect(auth?.hint).not.toBe(unreachable?.hint);
        // The two failures an operator confuses most often must name their own fix.
        expect(auth?.hint).toMatch(/password|credential/i);
        expect(unreachable?.hint).toMatch(/paused|unreachable|host/i);
    });

    it("classifies a pool timeout (P2024), which is a connection failure too", () => {
        const result = classifyDbConnectionError(
            prismaKnownError("Timed out fetching a new connection", "P2024")
        );

        expect(result).not.toBeNull();
        expect(result?.code).toBe("P2024");
        expect(result?.hint).toMatch(/connection_limit|pool/i);
    });

    it("names a missing DATABASE_URL as its own fault, not an unreachable host", () => {
        // Prisma reports this as an initialization error with NO code, so
        // without the message check it reads as "the database is down" — and
        // sends whoever is debugging to check a server that was never the
        // problem. It is also not retryable: the variable will not appear.
        const result = classifyDbConnectionError(
            prismaInitError("error: Environment variable not found: DATABASE_URL.")
        );

        expect(result).not.toBeNull();
        expect(result?.retryable).toBe(false);
        expect(result?.hint).toMatch(/DATABASE_URL/);
        expect(result?.hint).toMatch(/\.env/);
    });

    it("still classifies an initialization error that carries no code", () => {
        const result = classifyDbConnectionError(prismaInitError("something went wrong"));

        expect(result).not.toBeNull();
        expect(result?.code).toBeNull();
    });

    it("leaves unrelated Prisma errors alone so they keep their own status", () => {
        // P2002 is a unique-constraint violation — a 400-class bug, not an outage.
        expect(classifyDbConnectionError(prismaKnownError("unique", "P2002"))).toBeNull();
        expect(classifyDbConnectionError(new Error("boom"))).toBeNull();
        expect(classifyDbConnectionError(null)).toBeNull();
    });

    it("treats a retryable failure as retryable and a credential failure as not", () => {
        // Nothing ran, so a retry is safe; a wrong password will never recover.
        expect(classifyDbConnectionError(prismaInitError("x", "P1001"))?.retryable).toBe(true);
        expect(classifyDbConnectionError(prismaKnownError("x", "P2024"))?.retryable).toBe(true);
        expect(classifyDbConnectionError(prismaInitError("x", "P1000"))?.retryable).toBe(false);
    });
});

describe("redactConnectionUrl", () => {
    it("keeps the host and port but never the password", () => {
        const redacted = redactConnectionUrl(
            "postgresql://postgres.abcdef:sup3rs3cret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
        );

        expect(redacted).toContain("aws-1-ap-south-1.pooler.supabase.com:6543");
        expect(redacted).not.toContain("sup3rs3cret");
    });

    it("does not leak the password when the URL is malformed", () => {
        const redacted = redactConnectionUrl("postgres://user:hunter2@@@not a url");

        expect(redacted).not.toContain("hunter2");
    });

    it("reports a missing URL rather than throwing", () => {
        expect(redactConnectionUrl(undefined)).toMatch(/not set/i);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("jsonError on a database connection failure", () => {
    function initError(code: string) {
        const error = new Error("connection failed");
        error.name = "PrismaClientInitializationError";
        (error as Error & { errorCode?: string }).errorCode = code;
        return error;
    }

    it("answers 503, not 500 — the request is retryable, not broken", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        const response = jsonError(initError("P1001"));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.error.code).toBe("DatabaseUnavailable");
    });

    it("logs Prisma's code and the host, and never the password", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const original = process.env.DATABASE_URL;
        process.env.DATABASE_URL =
            "postgresql://postgres.abc:sup3rs3cret@db.example.supabase.com:6543/postgres";

        try {
            jsonError(initError("P1001"));

            const logged = spy.mock.calls.map((call) => JSON.stringify(call)).join(" ");
            expect(logged).toContain("P1001");
            expect(logged).toContain("db.example.supabase.com");
            expect(logged).not.toContain("sup3rs3cret");
        } finally {
            // Leaving a fake URL behind would silently repoint any later test
            // that constructs a Prisma client.
            process.env.DATABASE_URL = original;
        }
    });

    it("does not dress a genuine auth failure up as a database outage", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        const response = jsonError(new UnauthorizedError("Invalid email or password"));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error.message).toBe("Invalid email or password");
    });
});
