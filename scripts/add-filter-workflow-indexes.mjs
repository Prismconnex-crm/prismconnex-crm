// Adds composite indexes that make the Companies-page filter workflow fast.
//
// The left-side filters are applied progressively: Category -> Location(region)
// -> Country -> Employee Headcount, and the list is always ordered by
// "rowCursor" DESC (newest first) with a LIMIT for cursor pagination.
//
// Without an index whose columns match the equality filters and whose trailing
// column is "rowCursor" DESC, Postgres scans ~millions of category rows and
// sorts them (the dataset's recent high-rowCursor rows are region-skewed, so a
// region filter plows through the whole tail first). These two indexes let each
// workflow step become a pre-sorted index range scan that stops at LIMIT rows.
// Country is left as a `headquarters LIKE '%, X'` recheck on top of the already
// tiny, pre-sorted (category, region[, employeeRange]) scan - cheap, so it needs
// no column of its own.

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const INDEXES = [
  [
    "idx_discovery_cat_region_cursor",
    'CREATE INDEX IF NOT EXISTS "idx_discovery_cat_region_cursor" ON "DiscoveryCompany" ("category", "region", "rowCursor" DESC)',
  ],
  [
    "idx_discovery_cat_region_emp_cursor",
    'CREATE INDEX IF NOT EXISTS "idx_discovery_cat_region_emp_cursor" ON "DiscoveryCompany" ("category", "region", "employeeRange", "rowCursor" DESC)',
  ],
];

const client = new pg.Client({ connectionString: DIRECT_URL });
await client.connect();
await client.query("SET statement_timeout = 0");

try {
  for (const [name, sql] of INDEXES) {
    const t0 = Date.now();
    await client.query(sql);
    console.log(`[indexes] created ${name} in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  console.log("[indexes] ANALYZE...");
  await client.query('ANALYZE "DiscoveryCompany"');
  console.log("[indexes] done");
} finally {
  await client.end();
}
