import { PrismaClient } from "@prisma/client";
import { classifyDbConnectionError, redactConnectionUrl } from "./connection-errors";

/**
 * How many extra attempts a *connection* failure gets before it reaches the
 * caller. Two retries covers the common transient cases — a pooler dropping an
 * idle connection (P1017), a moment of pool exhaustion (P2024) — without
 * turning a genuinely down database into a long hang.
 */
const CONNECTION_RETRIES = 2;

/** Backoff between attempts. Short: a sign-in is waiting on this. */
const RETRY_DELAY_MS = 150;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

  // Retry connection failures, and ONLY connection failures.
  //
  // The classification is what makes this safe: it returns `retryable` only for
  // faults where no query was executed — the connection was never opened, or
  // was never handed out of the pool — so a retry cannot duplicate a write. A
  // wrong password (P1000) or a missing database (P1003) is not retried,
  // because repeating them just delays the real error.
  //
  // This is what turns the transient blip that produced "The database is
  // unavailable" on sign-in into a request that simply succeeds.
  return client.$extends({
    query: {
      async $allOperations({ args, query, model, operation }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            const failure = classifyDbConnectionError(error);

            if (!failure?.retryable || attempt >= CONNECTION_RETRIES) throw error;

            console.warn("[DB] retrying after a connection failure", {
              target: `${model ?? "raw"}.${operation}`,
              prismaCode: failure.code,
              attempt: attempt + 1,
              of: CONNECTION_RETRIES,
            });

            await sleep(RETRY_DELAY_MS * (attempt + 1));
          }
        }
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var prisma: ExtendedPrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaUrl: string | undefined;
}

// Ensure global.prisma is set in dev.
//
// The client is cached on `global` so hot reloads don't open a new pool each
// time — but `next dev` also hot-reloads `.env`, and a cached client keeps the
// connection string it was created with. Editing DATABASE_URL while the dev
// server runs (e.g. switching from local Postgres to Supabase) then left every
// query failing against the old database, surfacing as a 500 on sign-in and
// sign-up until a manual restart. Rebuild the client when the URL changes.
if (process.env.NODE_ENV !== "production") {
  if (!global.prisma || global.prismaUrl !== process.env.DATABASE_URL) {
    void global.prisma?.$disconnect().catch(() => {});
    global.prisma = createPrismaClient();
    global.prismaUrl = process.env.DATABASE_URL;

    // Names the database this process is actually pointed at, once per client.
    // "Which database am I talking to" is the first question every connection
    // failure raises, and the answer is otherwise locked inside a string that
    // must never be logged in full.
    console.info("[DB] client ready ->", redactConnectionUrl(process.env.DATABASE_URL));
  }
}

const client = global.prisma || createPrismaClient();

export const prisma = client;
