/**
 * Build data/find-shows-web-descriptions.json — a richer description for each
 * trade show, read from the show's own official website.
 *
 *   node scripts/fetch-event-web-descriptions.mjs --limit 50     # pilot
 *   node scripts/fetch-event-web-descriptions.mjs --all          # every site
 *
 * The seed already carries a one-line blurb per event (median 188 characters,
 * capped at 255) scraped from the directory listing. This adds a second,
 * fuller paragraph: the `og:description` / `<meta name=description>` the
 * organiser publishes on the event's own site. First-party copy — nothing is
 * generated, summarised or inferred.
 *
 * Keyed by DOMAIN, not by event: 11,629 events share 6,953 distinct websites
 * (one organiser runs many shows), so keying by domain removes ~40% of the
 * requests and keeps the output file small.
 *
 * Resumable: an existing output file is loaded first and its domains skipped,
 * so an interrupted run continues rather than starting over. Failures are
 * recorded too, so a second run does not retry a site that has no description
 * tag at all.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SEED = 'data/find-shows-seed.json';
const OUT = 'data/find-shows-web-descriptions.json';
const CONCURRENCY = 10;
const TIMEOUT_MS = 10_000;
const MAX_LENGTH = 420;
const MIN_LENGTH = 40;
const USER_AGENT =
  process.env.FETCH_USER_AGENT ?? 'PrismconnexCRM/1.0 (trade show description import)';

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', trade: '™', reg: '®', copy: '©',
};

const decodeEntities = (value) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

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
    // Short values are page furniture ("Home", "Welcome"), not descriptions.
    if (text.length >= MIN_LENGTH) {
      return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text;
    }
  }
  return null;
}

function bareDomain(url) {
  if (!url) return null;
  const bare = url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
  return bare && bare.includes('.') ? bare : null;
}

async function fetchDescription(url) {
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
    if (!type.includes('html')) return { error: 'not html' };
    const html = (await response.text()).slice(0, 200_000);
    const description = extractDescription(html);
    return description ? { description } : { error: 'no description tag' };
  } catch (cause) {
    return { error: cause?.name === 'AbortError' ? 'timeout' : (cause?.message ?? 'fetch failed') };
  } finally {
    clearTimeout(timer);
  }
}

async function pooled(items, limit, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    })
  );
}

async function main() {
  const all = process.argv.includes('--all');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 50;

  const seed = JSON.parse(readFileSync(SEED, 'utf8'));
  const events = Array.isArray(seed) ? seed : Object.values(seed).find(Array.isArray);

  // One entry per distinct domain; keep the first URL seen for that domain.
  const byDomain = new Map();
  for (const event of events) {
    const domain = bareDomain(event.website);
    if (domain && !byDomain.has(domain)) byDomain.set(domain, event.website);
  }

  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  const pending = [...byDomain.entries()].filter(([domain]) => !(domain in existing));
  const targets = all ? pending : pending.slice(0, limit);

  console.log(`Events: ${events.length} | distinct domains: ${byDomain.size}`);
  console.log(`Already recorded: ${Object.keys(existing).length} | pending: ${pending.length}`);
  console.log(`Fetching now: ${targets.length}${all ? '' : ` (pilot — pass --all for the rest)`}\n`);

  const results = { ...existing };
  let done = 0;
  let found = 0;
  const reasons = {};

  await pooled(targets, CONCURRENCY, async ([domain, url]) => {
    const outcome = await fetchDescription(url);
    if (outcome.description) {
      results[domain] = outcome.description;
      found += 1;
    } else {
      // null records the attempt, so a re-run does not repeat a dead site.
      results[domain] = null;
      reasons[outcome.error] = (reasons[outcome.error] ?? 0) + 1;
    }
    done += 1;
    if (done % 200 === 0) console.log(`  ...${done}/${targets.length} (${found} found)`);
  });

  writeFileSync(OUT, `${JSON.stringify(results, null, 0)}\n`);

  const total = Object.keys(results).length;
  const withText = Object.values(results).filter(Boolean).length;
  console.log(`\nThis run: ${found}/${targets.length} found`);
  console.log(`File now holds ${total} domains, ${withText} with a description`);
  if (Object.keys(reasons).length) console.log('Misses:', JSON.stringify(reasons));
  console.log(`Written: ${OUT} (${(JSON.stringify(results).length / 1048576).toFixed(2)} MB)`);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
