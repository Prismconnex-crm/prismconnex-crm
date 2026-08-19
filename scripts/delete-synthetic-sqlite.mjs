// Applies the same synthetic-company deletion to the local SQLite backup that
// scripts/delete-synthetic-companies.mjs already applied to Supabase, using the
// exact id list that run saved. Safe to re-run: ids already gone simply match
// zero rows.
//
// Deliberately avoids SELECT count(*) on the 36M-row table (minutes per call);
// progress is tracked by batch instead. No VACUUM — reclaiming space would need
// ~25 GB of free disk and is not worth the risk.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQLITE_EXE = "D:\\sqlite3\\sqlite3.exe";
const SQLITE_DB = path.join(ROOT, "prisma", "dev.db");
const ID_FILE = path.join(ROOT, "scripts", ".deleted-synthetic-ids.txt");
const PROGRESS = path.join(ROOT, "scripts", ".sqlite-delete-progress.json");

if (!existsSync(ID_FILE)) throw new Error(`id list not found: ${ID_FILE}`);
const ids = readFileSync(ID_FILE, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
console.log(`[sqlite] ${ids.length.toLocaleString()} ids to remove`);

const BATCH = 2000;
let start = 0;
if (existsSync(PROGRESS)) {
  start = JSON.parse(readFileSync(PROGRESS, "utf8")).done ?? 0;
  console.log(`[sqlite] resuming from ${start.toLocaleString()}`);
}

function runSqlite(sql) {
  return new Promise((resolve, reject) => {
    const p = spawn(SQLITE_EXE, [SQLITE_DB]);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || `exit ${code}`))));
    p.stdin.write(sql);
    p.stdin.end();
  });
}

const t0 = Date.now();
for (let i = start; i < ids.length; i += BATCH) {
  const chunk = ids.slice(i, i + BATCH);
  const values = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
  await runSqlite(`PRAGMA journal_mode=WAL; BEGIN; DELETE FROM Company WHERE id IN (${values}); COMMIT;`);
  const done = Math.min(i + BATCH, ids.length);
  writeFileSync(PROGRESS, JSON.stringify({ done }), "utf8");
  const rate = done - start > 0 ? Math.round((done - start) / ((Date.now() - t0) / 1000)) : 0;
  console.log(`[sqlite] ${done.toLocaleString()} / ${ids.length.toLocaleString()} (${rate}/s)`);
}

await runSqlite("PRAGMA wal_checkpoint(TRUNCATE);");
console.log("[sqlite] WAL checkpointed");
console.log("DONE");
