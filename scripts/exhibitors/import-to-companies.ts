/**
 * Copies every event's exhibitors (EventExhibitor) into DiscoveryCompany, so each one is a searchable
 * company on the Companies page under "Trade Show Events" and opens its exhibitor profile — what
 * scripts/import-bett-exhibitors-to-companies.mjs did for BETT alone. Row rules: lib/exhibitors/company-import.ts.
 *
 *   npm run exhibitors:to-companies                 dry run: counts and an example row, writes nothing
 *   npm run exhibitors:to-companies -- --apply      insert
 *   npm run exhibitors:to-companies -- --revert     count rows this import made; add --apply to delete them
 *   npm run exhibitors:to-companies -- --sync       fill company rows from later exhibitor enrichment (add --apply)
 *     --event=<slug substring>                      limit to some events
 *
 * One company row per exhibitor row: the same company at two shows is two rows, each opening its own
 * show's record. BETT is skipped — its 311 rows already exist from the BETT import. Re-running is safe:
 * an exhibitor whose "exhibitor:<id>" tag is already present is not inserted again. New rows take
 * rowCursor values below the existing range, so the Companies landing order (newest first) is unchanged;
 * search and the category filter reach them through their own indexes.
 */
import { prisma } from '@/lib/db/prisma';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { EXHIBITOR_ID_TAG_PREFIX, TRADE_SHOW_EXHIBITOR_TAG } from '@/lib/exhibitors/bett';
import { buildCompanyRow, companyCountry, type CompanyInsert, type ExhibitorSource, type ShowInfo } from '@/lib/exhibitors/company-import';

const BETT_SLUG = 'bett-show-london-2027-01-20';
const has = (flag: string) => process.argv.includes(`--${flag}`);
const arg = (name: string) => process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = has('apply');

/** cuid-shaped, like the ids already in the table. */
function makeId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function showInfo(slug: string): ShowInfo {
  const event = findShowEventsBySlug[slug];
  if (!event) {
    // Not in the catalog (renamed or dropped edition): fall back to the slug's words, never blank.
    const words = slug.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-/g, ' ').toUpperCase();
    return { label: words, city: null, monthYear: null };
  }
  const year = event.startDate?.slice(0, 4) ?? '';
  const month = Number(event.startDate?.slice(5, 7));
  return {
    label: year && !event.name.includes(year) ? `${event.name} ${year}` : event.name,
    city: event.city || null,
    monthYear: month && year ? `${MONTHS[month - 1]} ${year}` : null,
  };
}

async function revert() {
  const pattern = `%${TRADE_SHOW_EXHIBITOR_TAG}%${EXHIBITOR_ID_TAG_PREFIX}%`;
  const [{ n }] = await prisma.$queryRawUnsafe<{ n: string }[]>(`SELECT count(*)::text n FROM "DiscoveryCompany" WHERE tags LIKE $1`, pattern);
  console.log(`Rows made by this import: ${n}`);
  if (!apply) return console.log('Dry run. Add --apply to delete them.');
  const deleted = await prisma.$executeRawUnsafe(`DELETE FROM "DiscoveryCompany" WHERE tags LIKE $1`, pattern);
  console.log(`Deleted ${deleted} rows.`);
}

/**
 * --sync: carry later enrichment of EventExhibitor (website, phone, country, description) onto the company rows
 * this import made. Fills blanks only — a value already on the company row is never replaced.
 */
async function sync() {
  // Set-based: one UPDATE per 5,000-row slice, joined to the exhibitor named in each row's tag. Row-by-row
  // updates (86k of them) kept losing the pooled Supabase connection. Only rows that actually gain a value
  // are touched, and every column only fills a blank.
  const countries = await prisma.$queryRawUnsafe<{ country: string }[]>(
    `SELECT DISTINCT country FROM "EventExhibitor" WHERE country IS NOT NULL`,
  );
  const esc = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const pairs = countries.map(({ country }) => ({ country, ...companyCountry(country) }));
  const hqCase = `CASE e.country ${pairs.map((p) => `WHEN ${esc(p.country)} THEN ${esc(p.headquarters ?? p.country)}`).join(' ')} ELSE e.country END`;
  const regionPairs = pairs.filter((p) => p.region);
  const regionCase = regionPairs.length
    ? `CASE e.country ${regionPairs.map((p) => `WHEN ${esc(p.country)} THEN ${esc(p.region as string)}`).join(' ')} ELSE NULL END`
    : 'NULL';
  const tagLike = `'%${EXHIBITOR_ID_TAG_PREFIX}%'`;
  const join = `e.id = substring(d.tags from '${EXHIBITOR_ID_TAG_PREFIX}([^,]+)')`;
  const gains = `((d.website IS NULL AND e."websiteUrl" IS NOT NULL) OR (d.phone IS NULL AND e.phone IS NOT NULL)
      OR (d.description IS NULL AND e.description IS NOT NULL) OR (d.headquarters IS NULL AND e.country IS NOT NULL))`;

  const [{ lo, hi }] = await prisma.$queryRawUnsafe<{ lo: string; hi: string }[]>(
    `SELECT min("rowCursor")::text lo, max("rowCursor")::text hi FROM "DiscoveryCompany" WHERE tags LIKE ${tagLike}`,
  );
  const [{ n }] = await prisma.$queryRawUnsafe<{ n: string }[]>(
    `SELECT count(*)::text n FROM "DiscoveryCompany" d JOIN "EventExhibitor" e ON ${join} WHERE d.tags LIKE ${tagLike} AND ${gains}`,
  );
  console.log(`Company rows that gain a value: ${n}`);
  if (!apply) return console.log('Dry run. Add --apply to write.');

  let total = 0;
  const step = BigInt(5000);
  for (let a = BigInt(lo); a <= BigInt(hi); a += step) {
    total += await prisma.$executeRawUnsafe(
      `UPDATE "DiscoveryCompany" d SET
         website = coalesce(d.website, e."websiteUrl"),
         domain = coalesce(d.domain, nullif(regexp_replace(regexp_replace(e."websiteUrl", '^https?://(www[.])?', '', 'i'), '/+$', ''), '')),
         phone = coalesce(d.phone, e.phone),
         description = coalesce(d.description, e.description),
         region = CASE WHEN d.headquarters IS NULL AND e.country IS NOT NULL THEN ${regionCase} ELSE d.region END,
         headquarters = coalesce(d.headquarters, ${hqCase})
       FROM "EventExhibitor" e
       WHERE ${join} AND d.tags LIKE ${tagLike} AND d."rowCursor" BETWEEN ${a} AND ${a + step - BigInt(1)} AND ${gains}`,
    );
  }
  console.log(`Synced ${total} company rows.`);
}

async function main() {
  if (has('revert')) return revert();
  if (has('sync')) return sync();

  const filter = arg('event');
  const exhibitors = await prisma.$queryRawUnsafe<ExhibitorSource[]>(
    `SELECT id, "eventSlug", "companyName", "websiteUrl", country, "standNumber", email, phone, description
       FROM "EventExhibitor"
      WHERE "eventSlug" <> $1 ${filter ? `AND "eventSlug" LIKE $2` : ''}
      ORDER BY "eventSlug", "companyName"`,
    ...(filter ? [BETT_SLUG, `%${filter}%`] : [BETT_SLUG]),
  );

  const already = await prisma.$queryRawUnsafe<{ tags: string }[]>(
    `SELECT tags FROM "DiscoveryCompany" WHERE tags LIKE $1`,
    `%${EXHIBITOR_ID_TAG_PREFIX}%`,
  );
  const imported = new Set(
    already.flatMap((r) => r.tags.split(',').map((t) => t.trim()).filter((t) => t.startsWith(EXHIBITOR_ID_TAG_PREFIX)).map((t) => t.slice(EXHIBITOR_ID_TAG_PREFIX.length))),
  );

  const shows = new Map<string, ShowInfo>();
  const rows: CompanyInsert[] = [];
  for (const ex of exhibitors) {
    if (imported.has(ex.id) || !ex.companyName?.trim()) continue;
    if (!shows.has(ex.eventSlug)) shows.set(ex.eventSlug, showInfo(ex.eventSlug));
    rows.push(buildCompanyRow(ex, shows.get(ex.eventSlug)!, makeId()));
  }

  const notInCatalog = Array.from(shows.keys()).filter((s) => !findShowEventsBySlug[s]);
  console.log(`Exhibitors read (BETT excluded): ${exhibitors.length}`);
  console.log(`Already imported: ${exhibitors.length - rows.length}`);
  console.log(`To insert: ${rows.length} across ${shows.size} events`);
  console.log(`  with website: ${rows.filter((r) => r.website).length}`);
  console.log(`  with country: ${rows.filter((r) => r.headquarters).length} (region pinned: ${rows.filter((r) => r.region).length})`);
  if (notInCatalog.length) console.log(`  events missing from the catalog (label from slug): ${notInCatalog.length}`);

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    console.log('Example row:', JSON.stringify(rows.find((r) => r.website && r.headquarters) ?? rows[0], null, 1));
    return;
  }

  // Below the existing range, counting down: the landing page (rowCursor DESC) keeps its current first pages.
  const [{ min }] = await prisma.$queryRawUnsafe<{ min: string }[]>(`SELECT min("rowCursor")::text min FROM "DiscoveryCompany"`);
  let cursor = BigInt(min) - BigInt(1);

  const COLS = 14;
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      values.push(cursor.toString(), r.id, r.name, r.category, r.description, r.domain, r.website, r.headquarters, r.region, r.tags, r.email, r.phone, r.highlights, r.insights);
      cursor -= BigInt(1);
      const b = j * COLS;
      return `($${b + 1}::bigint,$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},0,$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14})`;
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DiscoveryCompany"
         ("rowCursor","id","name","category","description","domain","website","headquarters","region",
          "engagementScore","tags","email","phone","highlights","insights")
       VALUES ${tuples.join(',')}`,
      ...values,
    );
    written += chunk.length;
    if (written % 10000 < BATCH) console.log(`  inserted ${written}/${rows.length}`);
  }
  console.log(`Inserted ${written} rows.`);
}

main()
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
