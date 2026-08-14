// Backfills `domain` for real (curated) companies that are missing one, so the
// Companies/People logo component can resolve an official logo for them.
//
// Why only curated rows: logos are derived from the company's live website. The
// generated seed rows have fabricated domains — most do not exist, and the few
// that happen to be registered belong to unrelated businesses, so fetching a
// logo for those would show a stranger's brand next to a fake company name.
// Those keep the initials badge, which is the honest fallback.
//
// Source: Clearbit's free company autocomplete endpoint (no API key). A result
// is only accepted when its name closely matches ours, to avoid mis-assigning a
// well-known brand's domain to a similarly named company.
//
// Usage: node scripts/backfill-company-domains.mjs [--limit N] [--dry-run]

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(args[limitArg + 1]) : Infinity;
const DELAY_MS = 200; // be polite to the free endpoint

// Normalise for comparison: lowercase, drop punctuation and common suffixes.
const STOPWORDS = /\b(inc|corp|corporation|co|ltd|limited|llc|plc|group|holdings|the|company|private|pvt|sa|nv|ag|gmbh)\b/g;
function normalise(name) {
  return name
    .toLowerCase()
    .replace(/[.,&']/g, " ")
    .replace(STOPWORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function lookupDomain(name) {
  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) return null;

  const want = normalise(name);
  const wantKey = want.replace(/[^a-z0-9]/g, "");

  // A wrong logo is worse than none, so accept only on strong evidence:
  //   a) the suggestion's name matches ours exactly (after normalising), or
  //   b) the domain's root is essentially our name (e.g. "6sense" -> 6sense.com).
  // Loose "contains" matching is deliberately NOT used: it mapped "0x" to x.com
  // (Twitter/X) and "1Komma5" to komma.kr in testing.
  for (const item of list) {
    if (!item?.domain || !item?.name) continue;

    const got = normalise(item.name);
    if (got && got === want) return item.domain;

    const root = item.domain.split(".")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!root || !wantKey) continue;
    if (root === wantKey) return item.domain;
    if (wantKey.length >= 5 && root.startsWith(wantKey)) return item.domain;
    if (root.length >= 5 && wantKey.startsWith(root)) return item.domain;
  }
  return null;
}

// The Supabase pooler drops long-lived connections, so reconnect on demand.
// Re-running is safe: only rows still missing a domain are selected.
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

const { rows } = await dbQuery(`
  SELECT id, name FROM "DiscoveryCompany"
  WHERE id LIKE '%-%' AND (domain IS NULL OR domain = '')
  ORDER BY name`);

const targets = rows.slice(0, LIMIT);
console.log(`[domains] ${rows.length} curated companies missing a domain; processing ${targets.length}${DRY_RUN ? " (dry run)" : ""}`);

let matched = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < targets.length; i++) {
  const { id, name } = targets[i];
  try {
    const domain = await lookupDomain(name);
    if (domain) {
      matched++;
      if (!DRY_RUN) {
        await dbQuery(`UPDATE "DiscoveryCompany" SET domain = $1 WHERE id = $2`, [domain, id]);
      }
      console.log(`  [${i + 1}/${targets.length}] ${name} -> ${domain}`);
    } else {
      skipped++;
      console.log(`  [${i + 1}/${targets.length}] ${name} -> no confident match`);
    }
  } catch (e) {
    failed++;
    console.error(`  [${i + 1}/${targets.length}] ${name} -> lookup failed: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\n[domains] done. matched=${matched} skipped=${skipped} failed=${failed}`);
await client.end();
