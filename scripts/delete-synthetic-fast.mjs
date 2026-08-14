// Faster synthetic-company purge for BOTH stores.
//
// Supabase: batched DELETE ... WHERE id = ANY($1) with reconnect handling.
// SQLite:   ONE sqlite3 session — load the id list into a temp table via
//           .import, then a single indexed DELETE. The previous version spawned
//           sqlite3 once per 2,000 ids, which ran at ~15 rows/s; this does the
//           whole set in a single pass.
//
// Only cuid ids (no hyphen) are eligible, so curated real companies
// (fortune-*, unicorn-cbi-*, samsung-*, fidensgen-*, ...) can never be hit.
//
// Usage: node scripts/delete-synthetic-fast.mjs [--count N] [--skip-sqlite]

import { readFileSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const SQLITE_EXE = "D:\\sqlite3\\sqlite3.exe";
const SQLITE_DB = path.join(ROOT, "prisma", "dev.db");
const ID_FILE = path.join(ROOT, "scripts", ".purge-ids.txt");

const args = process.argv.slice(2);
const countArg = args.indexOf("--count");
const COUNT = countArg !== -1 ? Number(args[countArg + 1]) : 200000;
const SKIP_SQLITE = args.includes("--skip-sqlite");
const BATCH = 10000;

async function connect() {
  for (let i = 1; ; i++) {
    try {
      const c = new pg.Client({ connectionString: DIRECT_URL });
      await c.connect();
      await c.query("SET statement_timeout = 0");
      c.on("error", (e) => console.error(`[db] ${e.message}`));
      return c;
    } catch (e) {
      if (i >= 10) throw e;
      console.error(`[db] connect failed (${i}/10): ${e.message}`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
}

let client = await connect();
async function dbQuery(sql, params) {
  for (let i = 1; ; i++) {
    try {
      return await client.query(sql, params);
    } catch (e) {
      if (i >= 6) throw e;
      console.error(`[db] query retry ${i}/6: ${e.message}`);
      try { await client.end(); } catch {}
      await new Promise((r) => setTimeout(r, 5000));
      client = await connect();
    }
  }
}

const before = await dbQuery(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE id LIKE '%-%')::int AS curated,
         count(*) FILTER (WHERE id NOT LIKE '%-%')::int AS generated
  FROM "DiscoveryCompany"`);
console.log("[before]", before.rows[0]);

const picked = await dbQuery(
  `SELECT id FROM "DiscoveryCompany" WHERE id NOT LIKE '%-%' ORDER BY "rowCursor" LIMIT $1`,
  [COUNT]
);
const ids = picked.rows.map((r) => r.id);
console.log(`[pick] ${ids.length.toLocaleString()} generated rows`);
if (ids.length === 0) { await client.end(); process.exit(0); }
if (ids.some((id) => id.includes("-"))) throw new Error("ABORT: curated id in target set");

writeFileSync(ID_FILE, ids.join("\n") + "\n", "utf8");

// ── Supabase ──────────────────────────────────────────────────────────────
let removed = 0;
const t0 = Date.now();
for (let i = 0; i < ids.length; i += BATCH) {
  const res = await dbQuery(`DELETE FROM "DiscoveryCompany" WHERE id = ANY($1::text[])`, [ids.slice(i, i + BATCH)]);
  removed += res.rowCount;
  console.log(`[supabase] ${removed.toLocaleString()} / ${ids.length.toLocaleString()}`);
}
const after = await dbQuery(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE id LIKE '%-%')::int AS curated,
         count(*) FILTER (WHERE id NOT LIKE '%-%')::int AS generated
  FROM "DiscoveryCompany"`);
console.log("[after] ", after.rows[0], `(${Math.round((Date.now() - t0) / 1000)}s)`);
await client.end();

if (SKIP_SQLITE) { console.log("DONE (sqlite skipped)"); process.exit(0); }

// ── SQLite: single session, temp table + one DELETE ───────────────────────
const importPath = ID_FILE.replace(/\\/g, "/");
const script = `
.timeout 120000
PRAGMA journal_mode=WAL;
CREATE TEMP TABLE del_ids(id TEXT PRIMARY KEY);
.mode csv
.import '${importPath}' del_ids
SELECT 'loaded ' || count(*) FROM del_ids;
BEGIN;
DELETE FROM Company WHERE id IN (SELECT id FROM del_ids);
COMMIT;
SELECT 'remaining ' || count(*) FROM Company;
PRAGMA wal_checkpoint(TRUNCATE);
`;

console.log("[sqlite] deleting in one pass (this takes a few minutes)...");
const st = Date.now();
await new Promise((resolve, reject) => {
  const p = spawn(SQLITE_EXE, [SQLITE_DB]);
  p.stdout.on("data", (d) => process.stdout.write(`[sqlite] ${d}`));
  p.stderr.on("data", (d) => process.stderr.write(`[sqlite:err] ${d}`));
  p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`sqlite exit ${code}`))));
  p.stdin.write(script);
  p.stdin.end();
});
console.log(`[sqlite] done in ${Math.round((Date.now() - st) / 1000)}s`);
console.log("DONE");
