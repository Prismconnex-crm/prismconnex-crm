// Imports the Bett UK exhibitor directory into EventExhibitor.
//
// Source: https://uk.bettshow.com/solution-providers  (server-rendered, 40 per
// page, ?page=N pagination).
//
// robots.txt COMPLIANCE — checked 2026-08-08:
//   Disallow: /themes/, /sites/   (we touch neither)
//   Crawl-delay: 30               -> DELAY_MS below defaults to 30s
//   Request-rate: 1/10
// The crawl-delay makes this slow on purpose. Do not lower it.
//
// Only company-level fields published in the listing are captured. The personal
// contact columns (firstName/lastName/designation/email/personLinkedInUrl) are
// left NULL: this directory does not publish named contacts, and inventing them
// would be both wrong and a privacy problem.
//
// Usage:
//   node scripts/import-bett-exhibitors.mjs --event <eventSlug> [--dry-run]
//                                           [--max-pages N] [--delay-ms 30000]

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const DIRECT_URL = envText.match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const BASE = "https://uk.bettshow.com";
const LIST_PATH = "/solution-providers";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const SOURCE = "bettshow.com";

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
};
const DRY_RUN = args.includes("--dry-run");
const EVENT_SLUG = flag("--event");
const MAX_PAGES = Number(flag("--max-pages", "40"));
const DELAY_MS = Number(flag("--delay-ms", "30000")); // robots.txt Crawl-delay: 30

if (!EVENT_SLUG) {
  console.error("Missing --event <eventSlug>. Find it in the event URL, e.g. /app/events/<slug>.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  (s ?? "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function fetchPage(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === tries) throw e;
      await sleep(5000 * attempt);
    }
  }
}

/** Parses one listing page into company-level exhibitor records. */
function parseListing(html) {
  const out = [];
  // Each entry is an <li class="m-exhibitors-list__items__item ...">
  const blocks = html.split(/<li class="m-exhibitors-list__items__item /).slice(1);

  for (const block of blocks) {
    const href = (block.match(/href="(exhibitors\/[^"#?]+)"/) || [])[1];
    if (!href) continue;

    const name = decode(
      (block.match(/__header__title__link[^>]*>([\s\S]*?)<\/a>/) || [])[1] ??
        (block.match(/aria-label="([^"]+)"/) || [])[1]
    );
    if (!name) continue;

    // Prefer the <img src>, falling back to the background-image on the wrapper.
    // A handful of listings ship a malformed src where the site's own origin is
    // glued onto an already-absolute CDN URL
    // ("https://www.bettshow.comhttps://cdn.asp.events/..."), which resolves to
    // a dead host — strip the stray prefix.
    const logoRaw =
      (block.match(/<img src="([^"]+)"/) || [])[1] ??
      (block.match(/background-image:url\('([^']+)'\)/) || [])[1] ??
      null;
    const logoUrl = logoRaw ? logoRaw.replace(/^https?:\/\/[^/]+?(https?:\/\/)/, "$1") : null;

    const standRaw = decode((block.match(/__header__meta__stand"[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    const standNumber = standRaw ? standRaw.replace(/^stand:\s*/i, "").trim() || null : null;

    const categoriesBlock = (block.match(/__body__categories"[^>]*>([\s\S]*?)<\/div>/) || [])[1] ?? "";
    const categories = [...categoriesBlock.matchAll(/>([^<>]{2,60})</g)]
      .map((m) => decode(m[1]))
      .filter((c) => c && !/^stand:/i.test(c));

    out.push({
      companyName: name,
      logoUrl,
      sourceDetailUrl: `${BASE}${LIST_PATH.replace(/\/$/, "")}/${href}`.replace(/([^:]\/)\/+/g, "$1"),
      standNumber,
      categories: [...new Set(categories)].slice(0, 6),
      // Not published in the listing — left null rather than guessed.
      websiteUrl: null,
      country: null,
      phone: null,
      companyLinkedInUrl: null,
      description: null,
    });
  }
  return out;
}

console.log(`[bett] event=${EVENT_SLUG} delay=${DELAY_MS}ms (robots.txt Crawl-delay: 30)${DRY_RUN ? " DRY RUN" : ""}`);

const collected = [];
const seen = new Set();

for (let page = 1; page <= MAX_PAGES; page++) {
  const url = page === 1 ? `${BASE}${LIST_PATH}` : `${BASE}${LIST_PATH}?page=${page}`;
  const html = await fetchPage(url);
  if (!html) break;

  const rows = parseListing(html);
  if (rows.length === 0) {
    console.log(`[bett] page ${page}: 0 entries — end of directory`);
    break;
  }

  let added = 0;
  for (const row of rows) {
    if (seen.has(row.sourceDetailUrl)) continue;
    seen.add(row.sourceDetailUrl);
    collected.push(row);
    added++;
  }
  console.log(`[bett] page ${page}: +${added} (total ${collected.length})`);

  if (added === 0) break; // same page repeated — pagination exhausted
  if (page < MAX_PAGES) await sleep(DELAY_MS);
}

console.log(`\n[bett] scraped ${collected.length} exhibitors`);
const withStand = collected.filter((c) => c.standNumber).length;
const withLogo = collected.filter((c) => c.logoUrl).length;
console.log(`[bett] with stand number: ${withStand}   with logo: ${withLogo}`);

if (DRY_RUN) {
  console.log("\nsample:", JSON.stringify(collected.slice(0, 3), null, 2));
  console.log("[bett] dry run — nothing written");
  process.exit(0);
}

const client = new pg.Client({ connectionString: DIRECT_URL });
await client.connect();
await client.query("SET statement_timeout = 0");

let upserts = 0;
try {
  for (const row of collected) {
    await client.query(
      `INSERT INTO "EventExhibitor"
         ("id","eventSlug","companyName","logoUrl","sourceDetailUrl","websiteUrl",
          "standNumber","country","phone","companyLinkedInUrl","description",
          "categories","source","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       ON CONFLICT ("eventSlug","sourceDetailUrl") DO UPDATE SET
         "companyName" = EXCLUDED."companyName",
         "logoUrl"     = COALESCE(EXCLUDED."logoUrl", "EventExhibitor"."logoUrl"),
         "standNumber" = COALESCE(EXCLUDED."standNumber", "EventExhibitor"."standNumber"),
         "categories"  = EXCLUDED."categories",
         "updatedAt"   = NOW()`,
      [
        EVENT_SLUG, row.companyName, row.logoUrl, row.sourceDetailUrl, row.websiteUrl,
        row.standNumber, row.country, row.phone, row.companyLinkedInUrl, row.description,
        row.categories, SOURCE,
      ]
    );
    upserts++;
  }

  const { rows: [{ count }] } = await client.query(
    `SELECT count(*)::int AS count FROM "EventExhibitor" WHERE "eventSlug" = $1`,
    [EVENT_SLUG]
  );
  console.log(`[bett] upserted ${upserts}; ${count} exhibitors now stored for ${EVENT_SLUG}`);
} finally {
  await client.end();
}
