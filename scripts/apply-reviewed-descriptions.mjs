/**
 * Applies hand-collected exhibitor descriptions on top of the automated fetch.
 *
 * scripts/fetch-exhibitor-overviews.mjs reads the page HTML directly, which
 * misses two classes of site:
 *
 *   - Meta tags injected by JavaScript. IPEVO publishes a perfectly good
 *     description, but only once the page has run, so raw HTML shows nothing.
 *   - Sites that refuse a plain fetch with 403 but serve a real browser.
 *
 * These were read with a browser or a second fetch path and are stored here
 * with the source they came from, so each stays checkable. Every entry is the
 * company's own published wording; nothing here is written on their behalf.
 *
 * Usage:
 *   node scripts/apply-reviewed-descriptions.mjs <file.json>
 *   node scripts/apply-reviewed-descriptions.mjs <file.json> --apply
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const EVENT_SLUG = 'bett-show-london-2027-01-20';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const file = args.find((arg) => !arg.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/apply-reviewed-descriptions.mjs <file.json> [--apply]');
  process.exit(1);
}

const decisions = JSON.parse(readFileSync(file, 'utf8'));
const prisma = new PrismaClient();

async function main() {
  const names = Object.keys(decisions);
  console.log(`${names.length} reviewed descriptions loaded.`);

  let written = 0;
  for (const name of names) {
    const [description, source] = decisions[name];
    const result = APPLY
      ? await prisma.eventExhibitor.updateMany({
          where: { eventSlug: EVENT_SLUG, companyName: name },
          // The source travels with the text. "authored" makes the profile page
          // say the words are ours rather than crediting the company for them.
          data: { description, descriptionSource: source ?? 'authored' },
        })
      : await prisma.eventExhibitor.count({ where: { eventSlug: EVENT_SLUG, companyName: name } })
          .then((count) => ({ count }));
    if (!result.count) console.warn(`  no exhibitor named "${name}"`);
    written += result.count;
  }

  if (!APPLY) {
    console.log(`${written} row(s) would be written. Re-run with --apply.`);
    return;
  }

  const total = await prisma.eventExhibitor.count({
    where: { eventSlug: EVENT_SLUG, description: { not: null } },
  });
  console.log(`Wrote ${written}. ${total}/316 exhibitors now have a description.`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
