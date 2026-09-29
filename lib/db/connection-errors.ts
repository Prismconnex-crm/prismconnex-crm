/**
 * Classification of "Prisma could not talk to Postgres" failures.
 *
 * Deliberately matches on `error.name` and the attached code rather than using
 * `instanceof Prisma.*`, so this module never pulls `@prisma/client` into its
 * importers — `lib/http/response.ts` is imported by every API route, including
 * ones that must stay free of the query engine.
 *
 * Why this exists at all: sign-in surfaced "The database is unavailable" with
 * no further detail, and the branch that produced it threw Prisma's error code
 * away. That code is the entire diagnosis — P1000 (the password in DATABASE_URL
 * is wrong) and P1001 (the host is unreachable, or the Supabase project is
 * paused) are completely different faults with completely different fixes, and
 * from the log line alone they were indistinguishable.
 */

export type DbConnectionFailure = {
    /** Prisma's code (P1001, P2024, …), or null when Prisma attached none. */
    code: string | null;
    /** What to check first. Written for whoever is reading the server log. */
    hint: string;
    /**
     * Whether retrying can plausibly succeed.
     *
     * True only where NO query was executed — the connection was never opened,
     * or was never handed out of the pool — so a retry cannot duplicate a
     * write. A wrong password or a missing database is false: retrying those
     * just burns the request.
     */
    retryable: boolean;
};

/** Per-code guidance. Codes absent here fall back to the generic entry below. */
const HINTS: Record<string, { hint: string; retryable: boolean }> = {
    P1000: {
        hint:
            "Postgres rejected the credentials in DATABASE_URL. The database password is " +
            "not the Supabase account password — reset it under Project Settings → " +
            "Database → Database password, and URL-encode any special characters.",
        retryable: false,
    },
    P1001: {
        hint:
            "The database host is unreachable. Check that the Supabase project is not " +
            "paused (free projects pause after inactivity), that the host and port in " +
            "DATABASE_URL are right, and that the network/DNS is up.",
        retryable: true,
    },
    P1002: {
        hint:
            "The database host accepted the connection but timed out before answering. " +
            "Usually a slow or saturated instance — retry, then check Supabase health.",
        retryable: true,
    },
    P1003: {
        hint: "The database named in DATABASE_URL does not exist. On Supabase it is `postgres`.",
        retryable: false,
    },
    P1008: { hint: "The database operation timed out.", retryable: true },
    P1010: {
        hint: "The database user was denied access. Check the role in DATABASE_URL.",
        retryable: false,
    },
    P1011: {
        hint: "TLS negotiation with the database failed. Check any sslmode override in DATABASE_URL.",
        retryable: true,
    },
    P1017: {
        hint:
            "The database closed the connection. Common with a pooler after an idle " +
            "period; the connection is reopened on retry.",
        retryable: true,
    },
    P2024: {
        hint:
            "Timed out taking a connection from the pool — the pool is exhausted. Lower " +
            "`connection_limit` in DATABASE_URL, or reduce the number of processes " +
            "sharing the database (each `next dev` holds its own pool).",
        retryable: true,
    },
};

const GENERIC = {
    hint:
        "Prisma could not open a database connection. Check DATABASE_URL and that the " +
        "database is reachable.",
    retryable: true,
};

function readCode(error: object): string | null {
    // Initialization errors carry `errorCode`; known request errors carry `code`.
    const e = error as { errorCode?: unknown; code?: unknown };
    if (typeof e.errorCode === "string" && e.errorCode) return e.errorCode;
    if (typeof e.code === "string" && e.code) return e.code;
    return null;
}

/**
 * Returns a classification when `error` is a database *connection* failure, and
 * null for anything else — including other Prisma errors, which must keep their
 * own handling (a P2002 unique violation is a 400-class bug, not an outage).
 */
export function classifyDbConnectionError(error: unknown): DbConnectionFailure | null {
    if (!error || typeof error !== "object") return null;

    const name = (error as { name?: unknown }).name;
    const code = readCode(error);

    // Any initialization error is by definition a failure to connect.
    if (name === "PrismaClientInitializationError") {
        // Prisma reports a missing connection string as an initialization
        // error with no code, which is indistinguishable from "the host is
        // down" unless the message is read. They need opposite responses, so
        // this case is separated before the code lookup.
        const message = String((error as { message?: unknown }).message ?? "");
        if (/Environment variable not found/i.test(message)) {
            const variable = /Environment variable not found: (\w+)/i.exec(message)?.[1];
            return {
                code,
                hint:
                    `${variable ?? "DATABASE_URL"} is not set in this process. Add it to .env ` +
                    "(Next.js loads that at boot), and restart the dev server — an already " +
                    "running one keeps the environment it started with.",
                retryable: false,
            };
        }

        const known = code ? HINTS[code] : undefined;
        return { code, hint: (known ?? GENERIC).hint, retryable: (known ?? GENERIC).retryable };
    }

    // The one request-time error that is really a connection failure: the pool
    // had nothing to give out. No query ran, so it belongs in the same bucket.
    if (name === "PrismaClientKnownRequestError" && code === "P2024") {
        return { code, hint: HINTS.P2024.hint, retryable: HINTS.P2024.retryable };
    }

    return null;
}

/**
 * A connection URL with the password removed, safe to print.
 *
 * "Which database am I actually talking to" is the first question in any
 * connection failure, and the answer lives in a string that must never reach a
 * log. Host, port and database name are enough to answer it.
 */
export function redactConnectionUrl(url: string | undefined | null): string {
    if (!url) return "<not set>";

    try {
        const parsed = new URL(url);
        const database = parsed.pathname.replace(/^\//, "");
        const port = parsed.port ? `:${parsed.port}` : "";
        return `${parsed.protocol}//${parsed.hostname}${port}/${database}`;
    } catch {
        // Malformed URLs still must not leak the password, so fall back to
        // reporting nothing but the shape.
        return "<unparseable DATABASE_URL>";
    }
}
