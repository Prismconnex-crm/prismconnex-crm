/**
 * Copy BETT SHOW exhibitors from EventExhibitor into DiscoveryCompany, so they
 * appear on the Companies page alongside the rest of the discovery dataset.
 *
 *   node scripts/import-bett-exhibitors-to-companies.mjs            # dry run
 *   node scripts/import-bett-exhibitors-to-companies.mjs --apply    # write
 *   node scripts/import-bett-exhibitors-to-companies.mjs --revert   # undo
 *
 * What the source actually holds (checked, not assumed): name, country,
 * website, stand number, phone, email. `description` is null for all 316 rows
 * and `categories` is an empty array for all 316, so the Category filter and
 * the description column stay empty for these companies — nothing is invented
 * to fill them.
 *
 * Every inserted row carries IMPORT_TAG in `tags`, which is what --revert
 * matches on, so this import can be removed without touching any other row.
 */
import { PrismaClient } from '@prisma/client';

const EVENT_SLUG = 'bett-show-london-2027-01-20';
const EVENT_NAME = 'BETT SHOW';
const IMPORT_TAG = 'BETT SHOW 2027 Exhibitor';

/**
 * Category for every imported exhibitor. Already part of COMPANY_CATEGORIES,
 * so the Category filter offers it without any vocabulary change — and 5.5k
 * existing rows already use it, so these join a populated bucket rather than
 * creating a one-off.
 */
const CATEGORY = 'trade show events';

/**
 * Source spellings that would never match the Country picker. The picker list
 * (COMPANY_COUNTRIES, 195 entries) is the vocabulary the filter compares
 * against, so a row stored as "Türkiye" or "Netherlandss" is unreachable.
 * "United States" is left alone — COUNTRY_ALIASES already maps the picker's
 * "United States of America" onto it.
 */
const COUNTRY_FIXES = {
  Türkiye: 'Turkey',
  Netherlandss: 'Netherlands',
  Korea: 'South Korea',
};

const COUNTRY_REGION = {
  // Americas
  Brazil: 'Americas', Canada: 'Americas', 'United States': 'Americas',
  // Europe
  Belgium: 'Europe', Croatia: 'Europe', 'Czech Republic': 'Europe', Denmark: 'Europe',
  France: 'Europe', Germany: 'Europe', Greece: 'Europe', Hungary: 'Europe',
  Ireland: 'Europe', Italy: 'Europe', Lithuania: 'Europe', Luxembourg: 'Europe',
  Netherlands: 'Europe', Norway: 'Europe', Poland: 'Europe', Portugal: 'Europe',
  Spain: 'Europe', Sweden: 'Europe', Switzerland: 'Europe', Turkey: 'Europe',
  'United Kingdom': 'Europe',
  // Asia-Pacific
  Australia: 'Asia-Pacific', China: 'Asia-Pacific', 'Hong Kong': 'Asia-Pacific',
  India: 'Asia-Pacific', Japan: 'Asia-Pacific', 'New Zealand': 'Asia-Pacific',
  Singapore: 'Asia-Pacific', 'South Korea': 'Asia-Pacific', Taiwan: 'Asia-Pacific',
  // Africa & Middle East
  Israel: 'Africa & Middle East', Nigeria: 'Africa & Middle East',
  'Saudi Arabia': 'Africa & Middle East', 'South Africa': 'Africa & Middle East',
  'United Arab Emirates': 'Africa & Middle East',
};

function canonicalCountry(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  return COUNTRY_FIXES[trimmed] ?? trimmed;
}

function domainFrom(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '') || null;
}

/** cuid-shaped, to match the ids already in the table. */
function makeId() {
  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 8)
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const revert = process.argv.includes('--revert');
  const prisma = new PrismaClient();

  try {
    if (revert) {
      const doomed = await prisma.$queryRawUnsafe(
        `SELECT count(*)::text n FROM "DiscoveryCompany" WHERE tags LIKE $1`,
        `%${IMPORT_TAG}%`
      );
      console.log(`Rows tagged "${IMPORT_TAG}": ${doomed[0].n}`);
      if (!apply) {
        console.log('Dry run. Re-run with --revert --apply to delete them.');
        return;
      }
      const deleted = await prisma.$executeRawUnsafe(
        `DELETE FROM "DiscoveryCompany" WHERE tags LIKE $1`,
        `%${IMPORT_TAG}%`
      );
      console.log(`Deleted ${deleted} rows.`);
      return;
    }

    const exhibitors = await prisma.eventExhibitor.findMany({
      where: { eventSlug: EVENT_SLUG },
      orderBy: { companyName: 'asc' },
    });
    console.log(`Source exhibitors: ${exhibitors.length}`);

    // Skip names already in the dataset rather than creating a second row for
    // the same company — a duplicate would show twice in every search.
    const existing = await prisma.$queryRawUnsafe(
      `SELECT lower(name) n FROM "DiscoveryCompany" WHERE lower(name) = ANY($1::text[])`,
      exhibitors.map((e) => e.companyName.toLowerCase())
    );
    const taken = new Set(existing.map((row) => row.n));

    const unmappedCountries = new Set();
    const rows = [];
    const skippedNames = [];

    for (const ex of exhibitors) {
      if (taken.has(ex.companyName.toLowerCase())) {
        skippedNames.push(ex.companyName);
        continue;
      }
      const country = canonicalCountry(ex.country);
      const region = country ? COUNTRY_REGION[country] ?? null : null;
      if (country && !region) unmappedCountries.add(country);

      rows.push({
        id: makeId(),
        name: ex.companyName,
        // No city in the source — only a country. `headquarters` therefore
        // holds the country alone, which the country filter (last
        // comma-segment) reads correctly and the city filter simply never
        // matches, since the city is genuinely unknown.
        headquarters: country,
        region,
        // The source carries no category of its own, so these rows take the
        // one that describes how they were found: they are companies
        // discovered through a trade show. Stored lower-case like every other
        // category — the UI title-cases it for display, and the filter matches
        // over spelling variants.
        category: CATEGORY,
        // No description exists on any source row; left null rather than
        // invented.
        description: null,
        domain: domainFrom(ex.websiteUrl),
        website: ex.websiteUrl,
        founded: null,
        employeeRange: null,
        revenueRange: null,
        engagementScore: 0,
        trustSignals: null,
        tags: [IMPORT_TAG, ex.standNumber ? `Stand ${ex.standNumber}` : null]
          .filter(Boolean)
          .join(', '),
        email: ex.email,
        phone: ex.phone,
        highlights: ex.standNumber ? `${EVENT_NAME} stand ${ex.standNumber}` : `${EVENT_NAME} exhibitor`,
        insights: `Exhibiting at ${EVENT_NAME}, London, January 2027`,
      });
    }

    console.log(`To insert: ${rows.length}`);
    console.log(`Skipped (already a company): ${skippedNames.length}${skippedNames.length ? ` — ${skippedNames.join(', ')}` : ''}`);
    console.log(`  with website: ${rows.filter((r) => r.website).length}`);
    console.log(`  with country: ${rows.filter((r) => r.headquarters).length}`);
    console.log(`  with region:  ${rows.filter((r) => r.region).length}`);
    if (unmappedCountries.size) {
      console.log(`  countries with no region pin: ${[...unmappedCountries].join(', ')}`);
    }

    if (!apply) {
      console.log('\nDry run — nothing written. Re-run with --apply.');
      console.log('Example row:', JSON.stringify(rows[0], null, 1));
      return;
    }

    // rowCursor has no sequence attached (the table was bulk-loaded with
    // explicit values), so it is assigned here from the current maximum.
    const [{ next }] = await prisma.$queryRawUnsafe(
      `SELECT (max("rowCursor") + 1)::bigint next FROM "DiscoveryCompany"`
    );
    let cursor = BigInt(next);

    let written = 0;
    for (const row of rows) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DiscoveryCompany"
         ("rowCursor","id","name","category","description","domain","website","founded",
          "employeeRange","headquarters","region","revenueRange","engagementScore",
          "trustSignals","tags","email","phone","highlights","insights")
         VALUES ($1::bigint,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        cursor.toString(), row.id, row.name, row.category, row.description, row.domain,
        row.website, row.founded, row.employeeRange, row.headquarters, row.region,
        row.revenueRange, row.engagementScore, row.trustSignals, row.tags, row.email,
        row.phone, row.highlights, row.insights
      );
      cursor += 1n;
      written += 1;
    }
    console.log(`Inserted ${written} rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
