// Deletes a capped number of generated ("fake") company rows from BOTH the
// Supabase discovery table and the local SQLite backup, keeping the two in sync.
//
// Safety: only rows whose id is a cuid (no hyphen) are eligible — those are the
// ones produced by the volume seed scripts. Curated real companies use slug ids
// (fortune-*, unicorn-cbi-*, samsung-*, fidensgen-*, ...) and can never match.
//
// Note: these rows are not present in Apollo/Cognism/HubSpot or any other
// provider because they are not real businesses — their domains do not resolve.
//
// Usage: node scripts/delete-synthetic-companies.mjs [--count N] [--dry-run]

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
const ID_FILE = path.join(ROOT, "scripts", ".deleted-synthetic-ids.txt");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const countArg = args.indexOf("--count");
const COUNT = countArg !== -1 ? Number(args[countArg + 1]) : 100000;
const BATCH = 5000;

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
      console.error(`[db] connect failed (${i}/10): ${e.message} - retry in 8s`);
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
      console.error(`[db] query failed (${i}/6): ${e.message} - reconnecting`);
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

// Pick the target rows up front and persist their ids, so the same set can be
// applied to SQLite (and re-applied if a run is interrupted).
const picked = await dbQuery(
  `SELECT id FROM "DiscoveryCompany"
   WHERE id NOT LIKE '%-%'
   ORDER BY "rowCursor"
   LIMIT $1`,
  [COUNT]
);
const ids = picked.rows.map((r) => r.id);
console.log(`[pick] selected ${ids.length.toLocaleString()} generated rows`);
if (ids.length === 0) { await client.end(); process.exit(0); }

writeFileSync(ID_FILE, ids.join("\n"), "utf8");
console.log(`[pick] ids saved to ${ID_FILE}`);

if (DRY_RUN) {
  console.log("[dry-run] nothing deleted");
  await client.end();
  process.exit(0);
}

// ── Supabase ──────────────────────────────────────────────────────────────
let removed = 0;
for (let i = 0; i < ids.length; i += BATCH) {
  const chunk = ids.slice(i, i + BATCH);
  const res = await dbQuery(
    `DELETE FROM "DiscoveryCompany" WHERE id = ANY($1::text[])`,
    [chunk]
  );
  removed += res.rowCount;
  console.log(`[supabase] deleted ${removed.toLocaleString()} / ${ids.length.toLocaleString()}`);
}

const after = await dbQuery(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE id LIKE '%-%')::int AS curated,
         count(*) FILTER (WHERE id NOT LIKE '%-%')::int AS generated
  FROM "DiscoveryCompany"`);
console.log("[after] ", after.rows[0]);
await client.end();

// ── Local SQLite backup ───────────────────────────────────────────────────
// Applied by id so both stores drop exactly the same companies.
function runSqlite(sql) {
  return new Promise((resolve, reject) => {
    const p = spawn(SQLITE_EXE, [SQLITE_DB]);
    let err = "";
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || `exit ${code}`))));
    p.stdin.write(sql);
    p.stdin.end();
  });
}

const sqliteBefore = await runSqlite("SELECT count(*) FROM Company;");
console.log(`[sqlite] before: ${Number(sqliteBefore).toLocaleString()}`);

let sqliteRemoved = 0;
for (let i = 0; i < ids.length; i += BATCH) {
  const chunk = ids.slice(i, i + BATCH);
  const values = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
  await runSqlite(`BEGIN; DELETE FROM Company WHERE id IN (${values}); COMMIT;`);
  sqliteRemoved += chunk.length;
  console.log(`[sqlite] processed ${sqliteRemoved.toLocaleString()} / ${ids.length.toLocaleString()}`);
}

const sqliteAfter = await runSqlite("SELECT count(*) FROM Company;");
console.log(`[sqlite] after: ${Number(sqliteAfter).toLocaleString()}`);

// Keep the WAL from ballooning next to the large database file.
await runSqlite("PRAGMA wal_checkpoint(TRUNCATE);");
console.log("[sqlite] WAL checkpointed");
console.log("DONE");
