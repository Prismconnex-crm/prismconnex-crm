/**
 * Applies hand-reviewed exhibitor industries on top of the keyword classifier.
 *
 * The classifier in lib/events/industry.ts is deliberately conservative and
 * only fires on phrases it knows, which left most of the 316 BETT exhibitors
 * unassigned — the long tail of companies describe themselves in words no fixed
 * vocabulary covers. These decisions were made by reading each company's own
 * site text (saved in reports/exhibitor-industries/corpus.jsonl) and are stored
 * with the sentence that justifies each one, so every row stays checkable.
 *
 * Decisions live in JSON files outside the repo, keyed by exact company name:
 *   { "<companyName>": ["<Industry>", "<evidence sentence>"] }
 *
 * Usage:
 *   node scripts/apply-reviewed-industries.mjs <dir>           # dry run
 *   node scripts/apply-reviewed-industries.mjs <dir> --apply
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

register('data:text/javascript,' + encodeURIComponent(`
  export async function load(url, context, next) {
    if (url.endsWith('.ts')) {
      const r = await next(url, { ...context, format: 'module' });
      const { transformSync } = await import(${JSON.stringify(
        'file://' + join(ROOT, 'node_modules/esbuild/lib/main.js').replace(/\\/g, '/')
      )});
      return { ...r, source: transformSync(r.source.toString(), { loader: 'ts', format: 'esm' }).code };
    }
    return next(url, context);
  }
`), import.meta.url);

const { INDUSTRIES } = await import(
  'file://' + join(ROOT, 'lib/events/industry.ts').replace(/\\/g, '/')
);

const EVENT_SLUG = 'bett-show-london-2027-01-20';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const dir = args.find((arg) => !arg.startsWith('--'));
if (!dir) {
  console.error('Usage: node scripts/apply-reviewed-industries.mjs <decisions-dir> [--apply]');
  process.exit(1);
}

const decisions = {};
for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
  Object.assign(decisions, JSON.parse(readFileSync(join(dir, file), 'utf8')));
}
console.log(`${Object.keys(decisions).length} reviewed decisions loaded.`);

// A typo in a sector name would silently create a one-off category, so the
// vocabulary is enforced before anything is written.
const allowed = new Set(INDUSTRIES);
const unknown = Object.entries(decisions).filter(([, value]) => !allowed.has(value[0]));
if (unknown.length) {
  console.error('Sectors outside the published vocabulary:');
  unknown.forEach(([name, value]) => console.error(`  ${name} -> ${value[0]}`));
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const exhibitors = await prisma.eventExhibitor.findMany({
    where: { eventSlug: EVENT_SLUG },
    select: { id: true, companyName: true, websiteUrl: true, industry: true },
  });
  // A directory legitimately lists one company twice on different stands, so a
  // name maps to a list of rows — keying a Map by name silently left the
  // duplicate ("Innovation First Trading SARL") unclassified.
  const byName = new Map();
  for (const row of exhibitors) {
    const bucket = byName.get(row.companyName);
    if (bucket) bucket.push(row);
    else byName.set(row.companyName, [row]);
  }

  const missing = Object.keys(decisions).filter((name) => !byName.has(name));
  if (missing.length) {
    console.warn(`\n${missing.length} decision(s) matched no exhibitor:`);
    missing.forEach((name) => console.warn(`  ${name}`));
  }

  const toWrite = Object.entries(decisions)
    .filter(([name]) => byName.has(name))
    .flatMap(([name, value]) => byName.get(name).map((row) => [row, value]));
  const overwrites = toWrite.filter(([row]) => row.industry);
  console.log(`\n${toWrite.length} rows to write (${overwrites.length} already had a classifier verdict).`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply.');
    return;
  }

  const now = new Date();
  for (const [exhibitor, [industry, evidence]] of toWrite) {
    await prisma.eventExhibitor.update({
      where: { id: exhibitor.id },
      data: {
        industry,
        industryEvidence: [evidence],
        // Where the judgement came from: the company's own site when we have
        // one, otherwise the review itself. Never left implying a fetch we
        // did not make.
        industrySource: evidence.startsWith('known identity')
          ? 'reviewed from company identity'
          : (exhibitor.websiteUrl ?? 'reviewed'),
        industryCheckedAt: now,
      },
    });
  }

  const after = await prisma.eventExhibitor.count({
    where: { eventSlug: EVENT_SLUG, industry: { not: null } },
  });
  console.log(`Wrote ${toWrite.length}. ${after}/${exhibitors.length} exhibitors now have a sector.`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
