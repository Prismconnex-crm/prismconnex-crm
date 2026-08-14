// Enriches the BETT 2027 exhibitor rows in EventExhibitor from the detail sheet
// (data/bett-2027-exhibitors.json, produced by scripts/convert-bett-pdf.mjs).
//
// WHAT THIS FIXES
// The directory scrape (scripts/import-bett-exhibitors.mjs) captures name, logo
// and stand but no official website, so every row in the UI fell back to the
// same directory page. This pass fills websiteUrl, country, phone, LinkedIn and
// the named-contact columns from the sheet.
//
// No network access at all — the sheet is the only source.
//
// Matching: canonical name key (scripts/lib/exhibitor-name-key.mjs). A company
// listed twice on different stands gets the same enrichment applied to both
// listings. Sheet rows with no directory counterpart are inserted with a stable
// synthetic sourceDetailUrl so re-runs stay idempotent.
//
// Usage:
//   node scripts/import-bett-exhibitors-pdf.mjs --event <eventSlug> [--dry-run]
//   node scripts/import-bett-exhibitors-pdf.mjs --event <eventSlug> --in data/....json

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import pg from "pg";
import { exhibitorNameKey, decodeEntities } from "./lib/exhibitor-name-key.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRECT_URL = readFileSync(path.join(ROOT, ".env"), "utf8").match(/^DIRECT_URL="([^"]+)"/m)?.[1];
if (!DIRECT_URL) throw new Error("DIRECT_URL not found in .env");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
};
const EVENT_SLUG = flag("--event");
const IN = path.resolve(ROOT, flag("--in", "data/bett-2027-exhibitors.json"));
const DRY_RUN = args.includes("--dry-run");

const DIRECTORY_URL = "https://uk.bettshow.com/solution-providers";
const SOURCE = "bett-detail-sheet";

if (!EVENT_SLUG) {
  console.error("Missing --event <eventSlug>, e.g. bett-show-london-2027-01-20");
  process.exit(1);
}

const records = JSON.parse(readFileSync(IN, "utf8"));
console.log(`[bett-pdf-import] ${records.length.toLocaleString()} sheet records from ${path.basename(IN)}`);
if (DRY_RUN) console.log("[bett-pdf-import] DRY RUN — no writes");

const client = new pg.Client({ connectionString: DIRECT_URL });
await client.connect();

try {
  const { rows: existing } = await client.query(
    `SELECT id, "companyName", "nameKey", "standNumber", "websiteUrl", "sourceDetailUrl"
       FROM "EventExhibitor" WHERE "eventSlug" = $1`,
    [EVENT_SLUG]
  );
  console.log(`[bett-pdf-import] ${existing.length.toLocaleString()} rows already stored for ${EVENT_SLUG}`);

  // ── 1. Repair + backfill: decode entity-escaped names, set nameKey and the
  //       directory fallback URL on every existing row.
  let repaired = 0;
  const byKey = new Map();
  for (const row of existing) {
    const cleanName = decodeEntities(row.companyName).trim();
    const key = exhibitorNameKey(cleanName);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ ...row, companyName: cleanName, nameKey: key });

    if (!DRY_RUN && (cleanName !== row.companyName || row.nameKey !== key)) {
      await client.query(
        `UPDATE "EventExhibitor" SET "companyName" = $1, "nameKey" = $2 WHERE id = $3`,
        [cleanName, key, row.id]
      );
    }
    if (cleanName !== row.companyName || row.nameKey !== key) repaired++;
  }
  if (!DRY_RUN) {
    await client.query(
      `UPDATE "EventExhibitor" SET "sourceDirectoryUrl" = $1
        WHERE "eventSlug" = $2 AND ("sourceDirectoryUrl" IS DISTINCT FROM $1)`,
      [DIRECTORY_URL, EVENT_SLUG]
    );
  }
  console.log(`[bett-pdf-import] repaired/keyed ${repaired} existing row(s)`);

  // ── 2. Apply the sheet.
  let updated = 0;
  let inserted = 0;
  let unmatched = 0;

  for (const rec of records) {
    const name = decodeEntities(rec.exhibitorName).trim();
    const key = exhibitorNameKey(name);
    const targets = byKey.get(key) ?? [];

    // COALESCE order matters: the sheet wins for the enrichment columns, while
    // the directory keeps its own stand number (it is per listing, and one
    // company can hold several stands).
    const values = [
      rec.website ?? null,
      rec.country ?? null,
      rec.contactNumber ?? null,
      rec.companyLinkedInUrl ?? null,
      rec.firstName ?? null,
      rec.lastName ?? null,
      rec.jobTitle ?? null,
      rec.contactEmail ?? null,
      rec.personLinkedInUrl ?? null,
      rec.standNumber ?? null,
    ];

    if (targets.length) {
      for (const target of targets) {
        if (!DRY_RUN) {
          await client.query(
            `UPDATE "EventExhibitor" SET
               "websiteUrl"         = COALESCE($1, "websiteUrl"),
               "country"            = COALESCE($2, "country"),
               "phone"              = COALESCE($3, "phone"),
               "companyLinkedInUrl" = COALESCE($4, "companyLinkedInUrl"),
               "firstName"          = COALESCE($5, "firstName"),
               "lastName"           = COALESCE($6, "lastName"),
               "designation"        = COALESCE($7, "designation"),
               "email"              = COALESCE($8, "email"),
               "personLinkedInUrl"  = COALESCE($9, "personLinkedInUrl"),
               "standNumber"        = COALESCE("standNumber", $10),
               "source"             = $11,
               "updatedAt"          = NOW()
             WHERE id = $12`,
            [...values, SOURCE, target.id]
          );
        }
        updated++;
      }
    } else {
      unmatched++;
      // Stable synthetic listing URL — the sheet row has no directory page.
      const syntheticUrl = `${DIRECTORY_URL}#${key}`;
      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO "EventExhibitor"
             (id, "eventSlug", "companyName", "nameKey", "sourceDetailUrl", "sourceDirectoryUrl",
              "websiteUrl", "country", "phone", "companyLinkedInUrl",
              "firstName", "lastName", "designation", "email", "personLinkedInUrl",
              "standNumber", source, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
           ON CONFLICT ("eventSlug","sourceDetailUrl") DO UPDATE SET
             "companyName" = EXCLUDED."companyName",
             "nameKey" = EXCLUDED."nameKey",
             "websiteUrl" = COALESCE(EXCLUDED."websiteUrl", "EventExhibitor"."websiteUrl"),
             "country" = COALESCE(EXCLUDED."country", "EventExhibitor"."country"),
             "phone" = COALESCE(EXCLUDED."phone", "EventExhibitor"."phone"),
             "companyLinkedInUrl" = COALESCE(EXCLUDED."companyLinkedInUrl", "EventExhibitor"."companyLinkedInUrl"),
             "firstName" = COALESCE(EXCLUDED."firstName", "EventExhibitor"."firstName"),
             "lastName" = COALESCE(EXCLUDED."lastName", "EventExhibitor"."lastName"),
             "designation" = COALESCE(EXCLUDED."designation", "EventExhibitor"."designation"),
             "email" = COALESCE(EXCLUDED."email", "EventExhibitor"."email"),
             "personLinkedInUrl" = COALESCE(EXCLUDED."personLinkedInUrl", "EventExhibitor"."personLinkedInUrl"),
             "standNumber" = COALESCE("EventExhibitor"."standNumber", EXCLUDED."standNumber"),
             "updatedAt" = NOW()`,
          [
            crypto.randomUUID(), EVENT_SLUG, name, key, syntheticUrl, DIRECTORY_URL,
            ...values.slice(0, 9), values[9], SOURCE,
          ]
        );
      }
      inserted++;
    }
  }

  console.log(
    `[bett-pdf-import] enriched ${updated} listing(s); inserted ${inserted} sheet-only row(s)` +
      (unmatched ? ` (${unmatched} sheet record(s) had no directory listing)` : "")
  );

  const { rows: after } = await client.query(
    `SELECT COUNT(*)::int AS total,
            COUNT("websiteUrl")::int AS with_site,
            COUNT(DISTINCT "websiteUrl")::int AS distinct_sites,
            COUNT("country")::int AS with_country,
            COUNT("email")::int AS with_email
       FROM "EventExhibitor" WHERE "eventSlug" = $1`,
    [EVENT_SLUG]
  );
  const s = after[0];
  console.log(
    `[bett-pdf-import] ${EVENT_SLUG}: ${s.total} exhibitors, ${s.with_site} with an official website ` +
      `(${s.distinct_sites} distinct), ${s.with_country} with country, ${s.with_email} with a contact e-mail`
  );
} finally {
  await client.end();
}
