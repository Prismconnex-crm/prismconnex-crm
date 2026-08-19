// Deletes the ids in scripts/.purge-ids.txt from the local SQLite backup.
//
// One sqlite3 session (no per-batch process spawn), ids loaded once into an
// indexed temp table, then DELETEs issued in chunks that each auto-commit — so
// progress is durable even if the run is interrupted. A single 200k-row DELETE
// wrapped in one transaction was rolled back when the previous run was killed.
//
// Re-runnable: already-deleted ids simply match nothing.

import { readFileSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQLITE_EXE = "D:\\sqlite3\\sqlite3.exe";
const SQLITE_DB = path.join(ROOT, "prisma", "dev.db");
const ID_FILE = path.join(ROOT, "scripts", ".purge-ids.txt");

const total = readFileSync(ID_FILE, "utf8").split("\n").filter((s) => s.trim()).length;
const CHUNK = 10000;
const importPath = ID_FILE.replace(/\\/g, "/");

// Build one script: load ids, then chunked deletes with progress markers.
// No BEGIN/COMMIT wrapper -> each DELETE is its own implicit transaction.
let sql = `
.timeout 300000
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TEMP TABLE del_ids(id TEXT PRIMARY KEY);
.mode csv
.import '${importPath}' del_ids
SELECT 'loaded ' || count(*) FROM del_ids;
`;
for (let off = 0; off < total; off += CHUNK) {
  sql += `DELETE FROM Company WHERE id IN (SELECT id FROM del_ids WHERE rowid > ${off} AND rowid <= ${off + CHUNK});\n`;
  sql += `SELECT 'progress ${Math.min(off + CHUNK, total)}/${total}';\n`;
}
sql += `PRAGMA wal_checkpoint(TRUNCATE);\nSELECT 'checkpointed';\n`;

console.log(`[sqlite] purging ${total.toLocaleString()} ids in chunks of ${CHUNK.toLocaleString()}`);
const t0 = Date.now();

await new Promise((resolve, reject) => {
  const p = spawn(SQLITE_EXE, [SQLITE_DB]);
  p.stdout.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[sqlite] ${line} (${Math.round((Date.now() - t0) / 1000)}s)`);
  });
  p.stderr.on("data", (d) => process.stderr.write(`[sqlite:err] ${d}`));
  p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  p.stdin.write(sql);
  p.stdin.end();
});

console.log(`[sqlite] finished in ${Math.round((Date.now() - t0) / 1000)}s`);
