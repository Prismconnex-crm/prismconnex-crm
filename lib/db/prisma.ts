import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });
}

// Lightweight PRAGMAs that won't fail on large databases
const sqliteReadPragmas = [
  "PRAGMA journal_mode=WAL",
  "PRAGMA synchronous=NORMAL",
  "PRAGMA temp_store=MEMORY",
  "PRAGMA cache_size=-64000",  // 64MB cache (safe for any machine)
];

let pragmasApplied = false;

function usesSQLite() {
  return (process.env.DATABASE_URL ?? "").startsWith("file:");
}

// Ensure global.prisma is set in dev
if (process.env.NODE_ENV !== "production") {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
}

const client = global.prisma || createPrismaClient();

export async function ensureSQLiteReadPragmas(target: PrismaClient = client) {
  if (!usesSQLite() || pragmasApplied) {
    return;
  }

  try {
    for (const pragma of sqliteReadPragmas) {
      await target.$queryRawUnsafe(pragma);
    }
    pragmasApplied = true;
  } catch (error) {
    // Don't throw — PRAGMAs are optimizations, not requirements.
    // The database will still work without them.
    console.warn("SQLite PRAGMAs skipped (non-fatal):", (error as Error).message?.slice(0, 100));
    pragmasApplied = true; // Don't retry every request
  }
}

// Apply PRAGMAs at startup (fire-and-forget, non-blocking)
void ensureSQLiteReadPragmas().catch(() => {});

export const prisma = client;
