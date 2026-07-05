import { PrismaClient } from "@/lib/generated/sqlite-client";

declare global {
  // eslint-disable-next-line no-var
  var sqliteCompanies: PrismaClient | undefined;
}

function createClient() {
  return new PrismaClient({ log: ["error"] });
}

// Lightweight PRAGMAs that won't fail on large databases
const sqliteReadPragmas = [
  "PRAGMA journal_mode=WAL",
  "PRAGMA synchronous=NORMAL",
  "PRAGMA temp_store=MEMORY",
  "PRAGMA cache_size=-64000", // 64MB cache (safe for any machine)
];

let pragmasApplied = false;

if (process.env.NODE_ENV !== "production") {
  if (!global.sqliteCompanies) {
    global.sqliteCompanies = createClient();
  }
}

const client = global.sqliteCompanies || createClient();

export async function ensureSQLiteReadPragmas(target: PrismaClient = client) {
  if (pragmasApplied) {
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

// Prisma client bound to the SQLite company dataset (prisma/dev.db)
export const prisma = client;
