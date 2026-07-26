// Migrates the ~34.6M-row SQLite Company dataset (prisma/dev.db) into the
// Supabase Postgres "DiscoveryCompany" table via batched COPY FROM STDIN.
//
// Usage:  node scripts/migrate-companies-supabase.mjs [batchRows] [maxBatches]
//   batchRows  - rowid window size per COPY batch (default 50000)
//   maxBatches - stop after N batches (for testing; default unlimited)
//
// Resumable: progress is checkpointed to scripts/.migrate-checkpoint.json
// after every committed batch ({ lastRowid, migrated }). Each batch is one
// atomic COPY transaction, so a crash never leaves partial rows; rerunning
// picks up from the last committed rowid window.
//
// Drop the secondary indexes before a full run and recreate them afterwards
// (scripts/finalize-discovery-indexes.mjs) - COPY into an unindexed table is
// several times faster.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SQLITE_EXE = "D:\\sqlite3\\sqlite3.exe";
const DB_PATH = path.join(ROOT, "prisma", "dev.db");
const CHECKPOINT = path.join(__dirname, ".migrate-checkpoint.json");

const BATCH = Number(process.argv[2] || 50000);
const MAX_BATCHES = Number(process.argv[3] || Infinity);

const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const COLS =
  'rowid, id, name, category, description, domain, website, founded, ' +
  '"employeeRange", headquarters, region, "revenueRange", "engagementScore", ' +
  '"trustSignals", tags, email, phone, highlights, insights';
const PG_COLS =
  '"rowCursor", id, name, category, description, domain, website, founded, ' +
  '"employeeRange", headquarters, region, "revenueRange", "engagementScore", ' +
  '"trustSignals", tags, email, phone, highlights, insights';

function sqliteScalar(sql) {
  return new Promise((resolve, reject) => {
    const p = spawn(SQLITE_EXE, ["-readonly", DB_PATH, sql]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err || `sqlite3 exit ${code}`))
    );
  });
}

function copyBatch(client, fromRowid, toRowid) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT ${COLS} FROM Company WHERE rowid > ${fromRowid} AND rowid <= ${toRowid} ORDER BY rowid;`;
    const reader = spawn(SQLITE_EXE, ["-readonly", "-csv", DB_PATH, sql]);
    const writer = client.query(
      copyFrom(`COPY "DiscoveryCompany" (${PG_COLS}) FROM STDIN WITH (FORMAT csv)`)
    );
    let sqliteErr = "";
    reader.stderr.on("data", (d) => (sqliteErr += d));
    reader.on("error", reject);
    reader.on("close", (code) => {
      if (code !== 0) {
        writer.destroy();
        reject(new Error(`sqlite3 exit ${code}: ${sqliteErr}`));
      }
    });
    writer.on("error", (e) => {
      reader.kill();
      reject(e);
    });
    writer.on("finish", () => resolve(writer.rowCount));
    reader.stdout.pipe(writer);
  });
}

const maxRowid = Number(await sqliteScalar("SELECT max(rowid) FROM Company;"));

let cp = { lastRowid: 0, migrated: 0 };
if (existsSync(CHECKPOINT)) cp = JSON.parse(readFileSync(CHECKPOINT, "utf8"));
if (!cp.lastRowid) throw new Error("Checkpoint missing lastRowid - seed it before running.");

console.log(
  `[migrate] resume from rowid ${cp.lastRowid} (migrated so far: ${cp.migrated}), ` +
    `target max rowid ${maxRowid}, batch window ${BATCH}`
);

async function freshClient() {
  const c = new pg.Client({ connectionString: DIRECT_URL });
  await c.connect();
  await c.query("SET statement_timeout = 0");
  // swallow idle-connection errors so a dropped socket doesn't crash the
  // process before the retry loop can reconnect
  c.on("error", (e) => console.error("[migrate] client error:", e.message));
  return c;
}

async function connectWithRetry() {
  for (let i = 1; ; i++) {
    try {
      return await freshClient();
    } catch (e) {
      if (i >= 30) throw e;
      console.error(`[migrate] connect failed (attempt ${i}/30): ${e.message} - retrying in 10s`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

let client = await connectWithRetry();

const t0 = Date.now();
let sessionRows = 0;
let batches = 0;
const MAX_RETRIES = 90;
let consecutiveFailures = 0;

try {
  while (cp.lastRowid < maxRowid && batches < MAX_BATCHES) {
    const to = Math.min(cp.lastRowid + BATCH, maxRowid);
    const bStart = Date.now();
    let n;
    try {
      n = await copyBatch(client, cp.lastRowid, to);
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures++;
      console.error(
        `[migrate] batch failed (${consecutiveFailures}/${MAX_RETRIES}): ${e.message} - reconnecting in 60s`
      );
      if (consecutiveFailures >= MAX_RETRIES) throw e;
      try { await client.end(); } catch {}
      await new Promise((r) => setTimeout(r, 60000));
      client = await connectWithRetry();
      continue; // COPY is atomic per batch - checkpoint untouched, retry same window
    }
    cp.lastRowid = to;
    cp.migrated += n;
    sessionRows += n;
    batches++;
    writeFileSync(CHECKPOINT, JSON.stringify(cp));
    const rate = Math.round(n / ((Date.now() - bStart) / 1000));
    const overall = Math.round(sessionRows / ((Date.now() - t0) / 1000));
    const pct = ((cp.lastRowid / maxRowid) * 100).toFixed(2);
    const etaMin = Math.round((maxRowid - cp.lastRowid) / Math.max(overall, 1) / 60);
    console.log(
      `[migrate] rowid<=${cp.lastRowid} +${n} rows (batch ${rate}/s, session ${overall}/s) ` +
        `total ${cp.migrated} ${pct}% ETA ~${etaMin}min`
    );
  }
  console.log(`[migrate] DONE. migrated=${cp.migrated}, lastRowid=${cp.lastRowid}`);
} finally {
  await client.end();
}
