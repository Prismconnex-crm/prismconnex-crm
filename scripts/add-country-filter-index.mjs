// Reworks the country dimension of the Companies filter workflow.
//
// `headquarters` is stored as "City, Country" (occasionally "City, State,
// Country"), so the country is the last comma-segment. The old route matched it
// with `headquarters LIKE '%, France'` - a leading-wildcard LIKE that can never
// use an index, forcing a full scan (40s+ / timeout).
//
// This builds an expression index on the extracted country, positioned inside
// the (category, region, ..., employeeRange) filter chain so the whole
// progressive workflow (Category -> Location -> Country -> Headcount) is served
// by index. The keys are all low-cardinality, so B-tree deduplication keeps the
// index small (unlike the rowCursor-trailing ones). The matched set for a given
// country is tiny, so sorting it by rowCursor for the LIMIT is cheap.
//
// To make room on the (Supabase Pro) disk it first drops three indexes made
// redundant by idx_discovery_cat_region_cursor and by removing the LIKE:
//   - idx_discovery_headquarters : only served exact headquarters=, now unused
//   - idx_discovery_filters      : (category,employeeRange,region), superseded
//   - idx_discovery_category     : category-only is handled by a PK backward scan

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const COUNTRY_EXPR = `trim(split_part(headquarters, ',', -1))`;

const client = new pg.Client({ connectionString: DIRECT_URL });
await client.connect();
await client.query("SET statement_timeout = 0");

try {
  for (const name of ["idx_discovery_headquarters", "idx_discovery_filters", "idx_discovery_category"]) {
    const t0 = Date.now();
    await client.query(`DROP INDEX IF EXISTS "${name}"`);
    console.log(`[country-idx] dropped ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }

  const t1 = Date.now();
  await client.query(
    `CREATE INDEX IF NOT EXISTS "idx_discovery_cat_region_country_emp"
     ON "DiscoveryCompany" ("category", "region", (${COUNTRY_EXPR}), "employeeRange")`
  );
  console.log(`[country-idx] created idx_discovery_cat_region_country_emp (${Math.round((Date.now() - t1) / 1000)}s)`);

  console.log("[country-idx] ANALYZE...");
  await client.query('ANALYZE "DiscoveryCompany"');
  console.log("[country-idx] done");
} finally {
  await client.end();
}
