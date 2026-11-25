/**
 * Fills EventExhibitor.industry for every event's exhibitors (rules: lib/exhibitors/general-industry.ts).
 *
 *   npm run exhibitors:industries                dry run: sector counts + a sample, writes nothing
 *   npm run exhibitors:industries -- --apply     write
 *   npm run exhibitors:industries -- --revert --apply   clear what this script wrote (sources own-text*, show-category)
 *     --show=40     print that many random decisions for a human check
 *
 * Only empty industries are filled: BETT's, classified from each company's website by
 * scripts/classify-exhibitor-industries.mjs, are left as they are. industryEvidence records the words that
 * decided it; industrySource says whether those were the company's own text or the show's sector.
 */
import { prisma } from '@/lib/db/prisma';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { decideExhibitorIndustry, type IndustryDecision } from '@/lib/exhibitors/general-industry';

const has = (f: string) => process.argv.includes(`--${f}`);
const arg = (n: string) => process.argv.find((v) => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const apply = has('apply');

type Row = {
  id: string;
  eventSlug: string;
  companyName: string;
  description: string | null;
  descriptionSource: string | null;
  categories: string[];
};

async function main() {
  if (has('revert')) {
    const where = `"industrySource" = 'show-category' OR "industrySource" LIKE 'own-text%'`;
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: string }[]>(`SELECT count(*)::text n FROM "EventExhibitor" WHERE ${where}`);
    console.log(`Rows classified by this script: ${n}`);
    if (apply) console.log(`Cleared ${await prisma.$executeRawUnsafe(`UPDATE "EventExhibitor" SET industry = NULL, "industryEvidence" = '{}', "industrySource" = NULL WHERE ${where}`)}`);
    return;
  }

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, "eventSlug", "companyName", description, "descriptionSource", categories FROM "EventExhibitor" WHERE industry IS NULL`,
  );
  const decided: Array<{ id: string; d: NonNullable<IndustryDecision>; name: string }> = [];
  for (const r of rows) {
    const event = findShowEventsBySlug[r.eventSlug];
    const year = event?.startDate?.slice(0, 4);
    const showName = event ? (year && !event.name.includes(year) ? `${event.name} ${year}` : event.name) : null;
    const d = decideExhibitorIndustry({
      companyName: r.companyName,
      description: r.description,
      categories: r.categories ?? [],
      descriptionSource: r.descriptionSource,
      showName,
      showCategories: event?.categories ?? [],
    });
    if (d) decided.push({ id: r.id, d, name: r.companyName });
  }

  const own = decided.filter((x) => x.d.source !== 'show-category').length;
  console.log(`Exhibitors without an industry: ${rows.length}`);
  console.log(`  from their own text: ${own}`);
  console.log(`  from the show's sector (labelled): ${decided.length - own}`);
  console.log(`  left empty (no evidence, "General" show): ${rows.length - decided.length}`);
  const bySector = new Map<string, number>();
  for (const x of decided) bySector.set(x.d.industry, (bySector.get(x.d.industry) ?? 0) + 1);
  console.log(Array.from(bySector.entries()).sort((a, b) => b[1] - a[1]).map(([s, n]) => `  ${s}: ${n}`).join('\n'));
  const show = Number(arg('show') ?? 0);
  for (const x of [...decided].filter((y) => y.d.source !== 'show-category').sort(() => Math.random() - 0.5).slice(0, show)) {
    console.log(`  ${x.name.slice(0, 36).padEnd(36)} → ${x.d.industry}  [${x.d.evidence.join(', ')}]`);
  }
  if (!apply) return console.log('\nDry run — nothing written. Re-run with --apply.');

  // One set-based UPDATE per 1,000 rows (row-by-row transactions lost the pooled connection), each
  // retried a few times; only rows still without an industry are touched, so a re-run resumes.
  const STEP = 1000;
  let written = 0;
  for (let i = 0; i < decided.length; i += STEP) {
    const chunk = decided.slice(i, i + STEP);
    const values: unknown[] = [];
    const tuples = chunk.map(({ id, d }, j) => {
      values.push(id, d.industry, JSON.stringify(d.evidence), d.source);
      return `($${j * 4 + 1}, $${j * 4 + 2}, $${j * 4 + 3}::jsonb, $${j * 4 + 4})`;
    });
    const sql = `UPDATE "EventExhibitor" e SET industry = v.industry,
                   "industryEvidence" = ARRAY(SELECT jsonb_array_elements_text(v.evidence)), "industrySource" = v.source
                 FROM (VALUES ${tuples.join(',')}) AS v(id, industry, evidence, source)
                 WHERE e.id = v.id AND e.industry IS NULL`;
    for (let attempt = 1; ; attempt++) {
      try {
        written += await prisma.$executeRawUnsafe(sql, ...values);
        break;
      } catch (e) {
        if (attempt >= 5) throw e;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    if ((i / STEP) % 10 === 0) console.log(`  written ${written} (${i + chunk.length}/${decided.length})`);
  }
  console.log(`Written ${written}.`);
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
