/**
 * Fill EventExhibitor.description for BETT 2027 from each exhibitor's own
 * website.
 *
 *   node scripts/fetch-exhibitor-descriptions.mjs            # dry run, 10 sites
 *   node scripts/fetch-exhibitor-descriptions.mjs --all      # dry run, every site
 *   node scripts/fetch-exhibitor-descriptions.mjs --all --apply
 *
 * The source is the company's own `og:description` / `<meta name=description>`
 * — the sentence they publish about themselves. That is deliberate over
 * scraping a third-party directory: it is first-party copy, served for exactly
 * this purpose, and needs no interpretation. Nothing is generated or inferred;
 * a site with no description tag simply keeps a null description and the UI
 * says so.
 *
 * Politeness: a small concurrency cap, a per-request timeout, one retry, and an
 * identifying User-Agent. Re-runnable — rows that already have a description
 * are skipped, so an interrupted run resumes where it stopped.
 */
import { PrismaClient } from '@prisma/client';

const EVENT_SLUG = 'bett-show-london-2027-01-20';
const CONCURRENCY = 6;
const TIMEOUT_MS = 12_000;
const MAX_LENGTH = 600;
/**
 * Identifies the client without carrying anyone's personal address — a contact
 * belongs in an env var the operator sets, not hard-coded into a file that gets
 * committed and sent to every site fetched.
 */
const USER_AGENT =
  process.env.FETCH_USER_AGENT ?? 'PrismconnexCRM/1.0 (company description import)';

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', trade: '™',
  reg: '®', copy: '©',
};

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * og:description first — it is the curated social blurb and is usually a clean
 * sentence; the plain meta description is the fallback, then twitter's.
 * Attribute order varies, so each pattern is tried both ways round.
 */
const PATTERNS = [
  /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
];

function extractDescription(html) {
  for (const pattern of PATTERNS) {
    const match = html.match(pattern);
    if (!match) continue;
    const text = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
    // Very short values are placeholders ("Home", "Welcome"), not descriptions.
    if (text.length >= 40) {
      return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text;
    }
  }
  return null;
}

async function fetchDescription(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };

    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { error: `not html (${type.split(';')[0] || 'unknown'})` };

    // Only the head is needed; stop reading once it is in hand so a huge page
    // is not pulled in full.
    const html = (await response.text()).slice(0, 200_000);
    const description = extractDescription(html);
    return description ? { description } : { error: 'no description tag' };
  } catch (cause) {
    const message = cause?.name === 'AbortError' ? 'timeout' : (cause?.message ?? 'fetch failed');
    if (attempt === 0 && message !== 'timeout') return fetchDescription(url, 1);
    return { error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs `worker` over `items` with at most `limit` in flight. */
async function pooled(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const all = process.argv.includes('--all');
  const prisma = new PrismaClient();

  try {
    const targets = await prisma.eventExhibitor.findMany({
      where: { eventSlug: EVENT_SLUG, description: null, NOT: { websiteUrl: null } },
      select: { id: true, companyName: true, websiteUrl: true },
      orderBy: { companyName: 'asc' },
      ...(all ? {} : { take: 10 }),
    });

    console.log(`Exhibitors needing a description: ${targets.length}${all ? '' : ' (sample — pass --all)'}`);
    console.log(`Mode: ${apply ? 'APPLY' : 'dry run'}, concurrency ${CONCURRENCY}\n`);

    const results = [];
    let done = 0;

    await pooled(targets, CONCURRENCY, async (row) => {
      const outcome = await fetchDescription(row.websiteUrl);
      results.push({ ...row, ...outcome });
      done += 1;
      if (done % 25 === 0) console.log(`  ...${done}/${targets.length}`);
    });

    const found = results.filter((r) => r.description);
    const failed = results.filter((r) => !r.description);

    console.log(`\nDescriptions found: ${found.length} / ${results.length}`);
    for (const row of found.slice(0, 5)) {
      console.log(`  ${row.companyName}: ${row.description.slice(0, 110)}`);
    }

    const reasons = failed.reduce((acc, row) => {
      acc[row.error] = (acc[row.error] ?? 0) + 1;
      return acc;
    }, {});
    if (failed.length) console.log('\nNo description:', JSON.stringify(reasons));

    if (!apply) {
      console.log('\nDry run — nothing written. Re-run with --apply.');
      return;
    }

    for (const row of found) {
      await prisma.eventExhibitor.update({
        where: { id: row.id },
        data: { description: row.description },
      });
    }
    console.log(`\nUpdated ${found.length} rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
