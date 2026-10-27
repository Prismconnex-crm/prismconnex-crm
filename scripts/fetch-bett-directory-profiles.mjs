/**
 * Reads each exhibitor's official BETT directory profile.
 *
 * This is the best source available for these rows and it was missed twice:
 *
 *   - EventExhibitor.sourceDetailUrl holds
 *     /solution-providers/exhibitors/<slug>, which 301s to the listing. The
 *     live path is /exhibitors/<slug>.
 *   - The listing page's category block is empty for every exhibitor, so the
 *     directory looked like a stub. The per-exhibitor page carries both the
 *     categories and a description the exhibitor wrote for the show.
 *
 * That description beats a scraped homepage meta tag: the exhibitor wrote it
 * for this audience, and it is unambiguously first-party.
 *
 * Politeness: bettshow.com's robots.txt asks for Crawl-delay: 30, so requests
 * are serialised with a 30-second gap, which makes a full pass take about two
 * and a half hours.
 *
 * Over a run that long the process will be interrupted, so the crawl writes
 * only to a JSONL log and the database is touched once at the end. Resuming
 * reads that log, so a kill costs nothing already fetched.
 *
 * Usage:
 *   node scripts/fetch-bett-directory-profiles.mjs --limit 3   # sample, fetch only
 *   node scripts/fetch-bett-directory-profiles.mjs --apply     # crawl, then write
 *   node scripts/fetch-bett-directory-profiles.mjs --apply-log # write the log, no fetching
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EVENT_SLUG = 'bett-show-london-2027-01-20';
const BASE = 'https://uk.bettshow.com/exhibitors/';
/** bettshow.com/robots.txt: "Crawl-delay: 30". */
const CRAWL_DELAY_MS = 30_000;
const TIMEOUT_MS = 20_000;
const USER_AGENT =
  process.env.FETCH_USER_AGENT ?? 'PrismconnexCRM/1.0 (exhibitor profile lookup)';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
/** Write the existing log to the database without fetching anything. */
const APPLY_LOG = args.includes('--apply-log');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? Number(args[i + 1]) : 0;
})();

// The parser is TypeScript and shared with the test suite; strip types on
// import rather than keeping a second copy here that could drift from the one
// the tests cover.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
  export async function load(url, context, next) {
    if (url.endsWith('.ts')) {
      const r = await next(url, { ...context, format: 'module' });
      const { transformSync } = await import(${JSON.stringify(
        'file://' + join(ROOT, 'node_modules/esbuild/lib/main.js').split('\\').join('/')
      )});
      return { ...r, source: transformSync(r.source.toString(), { loader: 'ts', format: 'esm' }).code };
    }
    return next(url, context);
  }
`),
  import.meta.url
);

const { extractDirectoryDescription, extractDirectoryCategories, directoryProfileUrl } =
  await import('file://' + join(ROOT, 'lib/exhibitors/bett-directory.ts').split('\\').join('/'));

async function fetchProfile(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    });
    if (!response.ok) return { html: null, url: response.url || url, error: `HTTP ${response.status}` };
    // A slug that no longer exists lands back on the listing.
    if (!/\/exhibitors\//.test(response.url || url)) {
      return { html: null, url: response.url || url, error: 'redirected to listing' };
    }
    return { html: await response.text(), url: response.url || url, error: null };
  } catch (cause) {
    return {
      html: null,
      url,
      error: cause?.name === 'AbortError' ? 'timeout' : (cause?.message ?? 'fetch failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logPath = join(ROOT, 'reports', 'exhibitor-industries', 'bett-directory-profiles.jsonl');
/** Cached name+slug list, so the crawl never loads a database client. */
const listPath = join(ROOT, 'reports', 'exhibitor-industries', 'exhibitor-slugs.json');

/** Companies already fetched, from the log, so a restart resumes mid-run. */
function alreadyFetched() {
  if (!existsSync(logPath)) return new Set();
  return new Set(
    readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line).company;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );
}

/**
 * Writes the log into the database.
 *
 * Kept separate from fetching on purpose. The first version held one Prisma
 * client open across the whole two-and-a-half-hour crawl and wrote after each
 * page; sitting idle for 30 seconds between writes let the pooler drop the
 * connections, and the run died at row 144 with P2024 "Timed out fetching a new
 * connection from the connection pool". The crawl now touches nothing but the
 * log file, and the database is opened once, at the end, for a short burst.
 */
async function applyLog() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const seen = new Map();
    for (const line of readFileSync(logPath, 'utf8').split('\n').filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        // A company fetched more than once keeps its latest result.
        if (row.description || (row.categories ?? []).length) seen.set(row.company, row);
      } catch {
        // A truncated final line from a killed run is skipped, not fatal.
      }
    }

    let descriptions = 0;
    let categories = 0;
    for (const [company, row] of seen) {
      const data = {};
      if (row.description) {
        data.description = row.description;
        data.descriptionSource = 'bettshow.com';
        descriptions += 1;
      }
      if ((row.categories ?? []).length) {
        data.categories = row.categories;
        categories += 1;
      }
      const result = await prisma.eventExhibitor.updateMany({
        where: { eventSlug: EVENT_SLUG, companyName: company },
        data,
      });
      if (!result.count) console.warn(`  no exhibitor named "${company}"`);
    }

    const total = await prisma.eventExhibitor.count({
      where: { eventSlug: EVENT_SLUG, description: { not: null } },
    });
    console.log(
      `Applied ${descriptions} descriptions and ${categories} category sets. ${total}/316 exhibitors now have a description.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (APPLY_LOG) {
    await applyLog();
    return;
  }

  // The crawl needs nothing but a name and a slug, so the list is cached to
  // disk on the first run and the database is not opened again. This machine
  // kills the job under memory pressure, and @prisma/client is by far the
  // largest thing the process would otherwise hold for the next two hours.
  let exhibitors;
  if (existsSync(listPath)) {
    exhibitors = JSON.parse(readFileSync(listPath, 'utf8'));
  } else {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      exhibitors = await prisma.eventExhibitor.findMany({
        where: { eventSlug: EVENT_SLUG },
        select: { companyName: true, sourceDetailUrl: true },
        orderBy: { companyName: 'asc' },
      });
    } finally {
      await prisma.$disconnect();
    }
    mkdirSync(dirname(listPath), { recursive: true });
    writeFileSync(listPath, JSON.stringify(exhibitors), 'utf8');
  }

  const done = alreadyFetched();
  exhibitors = exhibitors.filter((row) => !done.has(row.companyName));
  if (LIMIT) exhibitors = exhibitors.slice(0, LIMIT);

  const minutes = Math.round((exhibitors.length * CRAWL_DELAY_MS) / 60_000);
  console.log(
    `${exhibitors.length} profiles to read, one every ${CRAWL_DELAY_MS / 1000}s (robots.txt Crawl-delay) - about ${minutes} min.`
  );

  mkdirSync(dirname(logPath), { recursive: true });

  let got = 0;
  for (let index = 0; index < exhibitors.length; index++) {
    const exhibitor = exhibitors[index];
    const profileUrl = directoryProfileUrl(exhibitor.sourceDetailUrl);
    if (!profileUrl) {
      console.log(`  [${index + 1}/${exhibitors.length}] ${exhibitor.companyName}: no slug`);
      continue;
    }

    // One retry for a transient network fault. A dropped connection (ENOTFOUND
    // when the machine's DNS blipped) would otherwise burn a 30-second slot and
    // leave the row for a whole later pass.
    let result = await fetchProfile(profileUrl);
    if (!result.html && /fetch failed|timeout|ENOTFOUND|ECONN/i.test(result.error ?? '')) {
      await sleep(5_000);
      result = await fetchProfile(profileUrl);
    }
    const description = result.html ? extractDirectoryDescription(result.html) : null;
    const categories = result.html ? extractDirectoryCategories(result.html) : [];

    appendFileSync(
      logPath,
      JSON.stringify({
        company: exhibitor.companyName,
        profileUrl,
        description,
        categories,
        error: result.error,
      }) + '\n',
      'utf8'
    );

    if (description) got += 1;
    const note = description
      ? `${description.length} chars${categories.length ? ` | ${categories.join(', ')}` : ''}`
      : (result.error ?? 'no description on profile');
    console.log(`  [${index + 1}/${exhibitors.length}] ${exhibitor.companyName}: ${note}`);

    if (index < exhibitors.length - 1) await sleep(CRAWL_DELAY_MS);
  }

  console.log(`\nDescriptions found this pass: ${got}/${exhibitors.length}.`);
  console.log(`Log: ${logPath}`);

  if (APPLY) await applyLog();
  else console.log('Fetch only - re-run with --apply-log to write the log to the database.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
