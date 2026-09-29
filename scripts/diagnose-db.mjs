#!/usr/bin/env node
/**
 * Read-only diagnosis of "The database is unavailable. Please try again shortly."
 *
 *   node scripts/diagnose-db.mjs
 *
 * That banner is shown on sign-in for exactly one condition: Prisma could not
 * open a connection to Postgres. It is NOT an authentication failure — the
 * Supabase password grant has either already succeeded or already produced its
 * own "Invalid email or password". This script walks the same path the sign-in
 * route walks, and reports the first hop that actually breaks:
 *
 *   1. environment      — is DATABASE_URL present and well-formed
 *   2. connect          — can Prisma open a connection at all
 *   3. login queries    — the exact reads/writes /api/auth/sign-in performs
 *   4. connection load  — how close the instance is to max_connections
 *
 * NOTHING SECRET IS PRINTED. Connection URLs are reported host-only, keys by
 * their JWT `role` claim and length, email addresses masked. The only write is
 * the same `lastLoginAt` touch that a real sign-in performs.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Minimal .env reader — the app is not booted, so Next.js has not loaded it. */
function readEnvFile(path) {
    try {
        return Object.fromEntries(
            readFileSync(path, "utf8")
                .split(/\r?\n/)
                .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(line))
                .map((line) => {
                    const eq = line.indexOf("=");
                    return [
                        line.slice(0, eq).trim(),
                        line.slice(eq + 1).trim().replace(/^["']|["']$/g, ""),
                    ];
                })
        );
    } catch {
        return {};
    }
}

const env = { ...readEnvFile(".env"), ...process.env };

// Prisma reads process.env, not this object. Next.js loads .env for us when the
// app boots; a bare `node` process does not, and without this the script would
// report "Environment variable not found: DATABASE_URL" against a perfectly
// healthy database — diagnosing itself instead of the app.
for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
}

const ok = (s) => `  OK    ${s}`;
const warn = (s) => `  WARN  ${s}`;
const bad = (s) => `  FAIL  ${s}`;
const info = (s) => `        ${s}`;

function heading(text) {
    console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

function maskEmail(email) {
    const [local = "", domain = ""] = String(email ?? "").split("@");
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 0))}@${domain}`;
}

/** Host, port and database only — never the password. */
function redact(url) {
    if (!url) return "<not set>";
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
    } catch {
        return "<unparseable>";
    }
}

function keyRole(key) {
    try {
        const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
        return { role: payload.role, ref: payload.ref };
    } catch {
        return { role: "<unreadable JWT>", ref: null };
    }
}

// ─── 1. environment ──────────────────────────────────────────────────

heading("1. Environment");

const databaseUrl = env.DATABASE_URL ?? "";
const directUrl = env.DIRECT_URL ?? "";

if (!databaseUrl) {
    console.log(bad("DATABASE_URL is not set — Prisma cannot connect to anything."));
    console.log(info("This alone produces the 'database is unavailable' banner."));
    process.exit(1);
}

console.log(ok(`DATABASE_URL  ${redact(databaseUrl)}`));
console.log(directUrl ? ok(`DIRECT_URL    ${redact(directUrl)}`) : warn("DIRECT_URL is not set"));

let poolParams = {};
try {
    poolParams = Object.fromEntries(new URL(databaseUrl).searchParams);
} catch {
    console.log(bad("DATABASE_URL is not a parseable URL."));
}

const port = (() => {
    try {
        return new URL(databaseUrl).port;
    } catch {
        return "";
    }
})();

// Supabase's transaction pooler (6543) multiplexes, and Prisma must be told so
// or it will try to use prepared statements the pooler cannot honour.
if (port === "6543" && poolParams.pgbouncer !== "true") {
    console.log(bad("port 6543 is the transaction pooler but `pgbouncer=true` is missing"));
    console.log(info("Prisma will emit prepared statements the pooler cannot serve."));
} else if (port === "6543") {
    console.log(ok("transaction pooler with pgbouncer=true"));
}

if (poolParams.connection_limit) {
    console.log(info(`connection_limit=${poolParams.connection_limit} per process`));
    console.log(
        info("Each `next dev` process holds its own pool of this size — see section 4.")
    );
}

// The anon/service_role mix-up is invisible in a .env file and changes the
// security model completely, so it is checked here rather than assumed.
if (env.SUPABASE_ANON_KEY) {
    const { role, ref } = keyRole(env.SUPABASE_ANON_KEY);
    if (role === "service_role") {
        console.log(bad(`SUPABASE_ANON_KEY holds a SERVICE_ROLE key (role="${role}")`));
        console.log(info("That key bypasses every RLS policy. Replace it with the anon key"));
        console.log(info("from Project Settings → API → Project API keys → anon/public."));
    } else {
        console.log(ok(`SUPABASE_ANON_KEY role="${role}" ref="${ref}"`));
    }
}

// ─── 2. connect ──────────────────────────────────────────────────────

heading("2. Can Prisma connect?");

let PrismaClient;
try {
    ({ PrismaClient } = require("@prisma/client"));
} catch {
    console.log(bad("@prisma/client is not generated. Run: npx prisma generate"));
    process.exit(1);
}

const prisma = new PrismaClient({ log: ["error"] });

/** Reports a failure the way lib/db/connection-errors.ts classifies it. */
function reportError(error) {
    const code = error?.errorCode ?? error?.code ?? null;
    console.log(bad(`${error?.name ?? "Error"}${code ? ` (${code})` : ""}`));
    console.log(info(String(error?.message ?? "").split("\n")[0]));

    const hints = {
        P1000: "Wrong database password. Reset it under Project Settings → Database.",
        P1001: "Host unreachable — is the Supabase project paused, or the network down?",
        P1002: "Host reachable but timed out answering.",
        P1003: "That database does not exist. On Supabase it is `postgres`.",
        P1017: "The server closed the connection — common after an idle period.",
        P2024: "Pool exhausted. Lower connection_limit or run fewer dev servers.",
    };
    if (code && hints[code]) console.log(info(hints[code]));
}

const started = Date.now();
try {
    await prisma.$queryRawUnsafe("select 1");
    console.log(ok(`connected in ${Date.now() - started}ms`));
} catch (error) {
    reportError(error);
    console.log("\nThe chain stops here: nothing past this point can run.");
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
}

// ─── 3. the queries sign-in actually runs ────────────────────────────

heading("3. Sign-in's own queries");

async function step(label, fn) {
    const t = Date.now();
    try {
        const result = await fn();
        console.log(ok(`${label} (${Date.now() - t}ms)${result === undefined ? "" : ` → ${result}`}`));
        return true;
    } catch (error) {
        console.log(bad(`${label} (${Date.now() - t}ms)`));
        reportError(error);
        return false;
    }
}

await step("profiles is readable", async () => `${await prisma.profile.count()} row(s)`);
await step("users is readable", async () => `${await prisma.user.count()} row(s)`);

const sample = await prisma.profile
    .findFirst({ select: { id: true, email: true, accountStatus: true } })
    .catch(() => null);

if (!sample) {
    console.log(warn("no profile rows — sign in once, or check the on_auth_user_created trigger"));
} else {
    console.log(info(`sample profile ${maskEmail(sample.email)} (${sample.accountStatus})`));

    await step("ensureProfileForSession → findUnique", async () =>
        (await prisma.profile.findUnique({ where: { id: sample.id } })) ? "found" : "MISSING"
    );

    await step("recordLogin → update lastLoginAt", async () => {
        await prisma.profile.update({
            where: { id: sample.id },
            data: { lastLoginAt: new Date() },
        });
        return "written";
    });

    await step("resolveOnboardingState → user lookup", async () => {
        const byAuthId = await prisma.user.findUnique({
            where: { supabaseUserId: sample.id },
            include: { memberships: true },
        });
        const byEmail = byAuthId
            ? null
            : await prisma.user.findUnique({
                  where: { email: sample.email },
                  include: { memberships: true },
              });
        const user = byAuthId ?? byEmail;
        return user
            ? `workspace membership(s): ${user.memberships.length}`
            : "no CRM User row → this account is sent to /onboarding (not an error)";
    });
}

// ─── 4. connection load ──────────────────────────────────────────────

heading("4. Connection headroom");

try {
    const direct = directUrl
        ? new PrismaClient({ datasources: { db: { url: directUrl } }, log: ["error"] })
        : prisma;

    const [{ max_connections: max }] = await direct.$queryRawUnsafe("show max_connections");
    const [{ total }] = await direct.$queryRawUnsafe(
        "select count(*)::int as total from pg_stat_activity"
    );

    console.log(info(`${total} of ${max} backend connections in use`));

    if (Number(total) / Number(max) > 0.8) {
        console.log(bad("the instance is near its connection ceiling"));
        console.log(info("This is what intermittently produces P1001/P2024 on sign-in."));
    } else {
        console.log(ok("comfortable headroom"));
    }

    if (poolParams.connection_limit) {
        console.log(
            info(
                `each dev server reserves up to ${poolParams.connection_limit} — run ONE ` +
                    "`next dev` at a time, not several."
            )
        );
    }

    if (direct !== prisma) await direct.$disconnect().catch(() => {});
} catch (error) {
    console.log(warn("could not read connection stats (harmless)"));
    console.log(info(String(error?.message ?? "").split("\n")[0]));
}

await prisma.$disconnect().catch(() => {});
console.log("\nDone.\n");
