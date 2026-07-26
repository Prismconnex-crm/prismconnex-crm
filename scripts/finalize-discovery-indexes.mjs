// Recreates the DiscoveryCompany secondary indexes after a bulk COPY load
// (they are dropped for load speed - see migrate-companies-supabase.mjs).
// Index names must match prisma/migrations/20260720174624_add_discovery_company
// exactly so the live DB stays in sync with the Prisma schema.
//
// Usage:  node scripts/finalize-discovery-indexes.mjs [--drop]
//   --drop  drop the secondary indexes instead of creating them (pre-load step)

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const drop = process.argv.includes("--drop");

// Mirror the live index set (and prisma/migrations). The single-column
// category/filters/headquarters indexes were intentionally dropped — see
// scripts/add-country-filter-index.mjs and the 20260725 migration.
const INDEXES = [
  ['DiscoveryCompany_id_key', 'CREATE UNIQUE INDEX "DiscoveryCompany_id_key" ON "DiscoveryCompany"("id")'],
  ['idx_discovery_employee', 'CREATE INDEX "idx_discovery_employee" ON "DiscoveryCompany"("employeeRange")'],
  ['idx_discovery_region', 'CREATE INDEX "idx_discovery_region" ON "DiscoveryCompany"("region")'],
  ['idx_discovery_name_lower_pattern', 'CREATE INDEX "idx_discovery_name_lower_pattern" ON "DiscoveryCompany" (lower("name") text_pattern_ops)'],
  ['idx_discovery_cat_region_cursor', 'CREATE INDEX "idx_discovery_cat_region_cursor" ON "DiscoveryCompany" ("category", "region", "rowCursor" DESC)'],
  ['idx_discovery_cat_region_country_emp', `CREATE INDEX "idx_discovery_cat_region_country_emp" ON "DiscoveryCompany" ("category", "region", (trim(split_part("headquarters", ',', -1))), "employeeRange")`],
];

const client = new pg.Client({ connectionString: DIRECT_URL });
await client.connect();
await client.query("SET statement_timeout = 0");

try {
  for (const [name, createSql] of INDEXES) {
    const t0 = Date.now();
    if (drop) {
      await client.query(`DROP INDEX IF EXISTS "${name}"`);
      console.log(`[indexes] dropped ${name}`);
    } else {
      await client.query(`DROP INDEX IF EXISTS "${name}"`); // idempotent rebuild
      await client.query(createSql);
      console.log(`[indexes] created ${name} in ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }
  if (!drop) {
    console.log("[indexes] running ANALYZE...");
    await client.query('ANALYZE "DiscoveryCompany"');
    console.log("[indexes] done");
  }
} finally {
  await client.end();
}
