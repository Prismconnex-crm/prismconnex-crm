/**
 * Fills EventExhibitor.industry for a show's exhibitors from each company's
 * own website.
 *
 * Why not the show directory: bettshow.com publishes a `categories` block per
 * exhibitor, but for the 2027 edition every one of them is empty and the
 * per-exhibitor detail pages 301 to the listing — the directory is still a
 * stub. So the companies' own sites are the only first-party source, which is
 * what the request asked for.
 *
 * What it does NOT do: invent a sector. A company whose own copy gives no clear
 * answer is left null and renders as "Not available". A wrong sector is worse
 * than a blank one here, because the whole point of the field is helping an
 * organiser or exhibitor decide who is worth meeting.
 *
 * Usage:
 *   node scripts/classify-exhibitor-industries.mjs              # dry run + report
 *   node scripts/classify-exhibitor-industries.mjs --apply      # write to the DB
 *   node scripts/classify-exhibitor-industries.mjs --limit 20   # sample first
 *   node scripts/classify-exhibitor-industries.mjs --revert     # clear the columns
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The classifier is TypeScript and shared with the app; strip types on import
// rather than keeping a second copy of the rules that could drift.
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

const { classifyIndustry } = await import(
  'file://' + join(ROOT, 'lib/events/industry.ts').replace(/\\/g, '/')
);

const EVENT_SLUG = 'bett-show-london-2027-01-20';
const TIMEOUT_MS = 12_000;
const CONCURRENCY = 6;
const MAX_HTML = 400_000;
/** Never send the operator's address to 269 third-party sites. */
const USER_AGENT =
  process.env.FETCH_USER_AGENT ?? 'PrismconnexCRM/1.0 (exhibitor industry classification)';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const REVERT = args.includes('--revert');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? Number(args[i + 1]) : 0;
})();

const prisma = new PrismaClient();

function decode(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function allMatches(html, pattern) {
  // exec in a loop, not matchAll: this repo targets ES5 and the shared tsconfig
  // cannot iterate the iterator matchAll returns.
  const out = [];
  let m;
  while ((m = pattern.exec(html)) !== null) out.push(m[1]);
  return out;
}

/**
 * The parts of a page that describe the business, rather than the whole DOM.
 *
 * Headings and the meta description are where a company states what it sells;
 * body copy is mostly navigation, cookie notices and legal text, which drags
 * unrelated vocabulary into the match.
 */
function extractSignalText(html) {
  const head = html.slice(0, MAX_HTML);
  const parts = [];

  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) parts.push(title[1]);

  for (const re of [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/gi,
    /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/gi,
  ]) {
    parts.push(...allMatches(head, re));
  }

  // schema.org description, when the site publishes one.
  parts.push(...allMatches(head, /"description"\s*:\s*"((?:[^"\\]|\\.){10,400})"/g));

  const body = head
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  for (const re of [
    /<h1[^>]*>([\s\S]{3,300}?)<\/h1>/gi,
    /<h2[^>]*>([\s\S]{3,300}?)<\/h2>/gi,
    /<h3[^>]*>([\s\S]{3,200}?)<\/h3>/gi,
  ]) {
    parts.push(...allMatches(body, re));
  }

  // A few opening paragraphs — enough for the pitch, short of the legal boilerplate.
  parts.push(...allMatches(body, /<p[^>]*>([\s\S]{40,600}?)<\/p>/gi).slice(0, 12));

  return parts
    .map((part) => decode(String(part).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' . ')
    .slice(0, 12_000);
}

async function fetchSite(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
    if (!response.ok) return { text: '', url: response.url || url, error: `HTTP ${response.status}` };
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { text: '', url: response.url || url, error: 'not html' };
    const html = (await response.text()).slice(0, MAX_HTML);
    return { text: extractSignalText(html), url: response.url || url, error: null };
  } catch (cause) {
    const error = cause?.name === 'AbortError' ? 'timeout' : (cause?.message ?? 'fetch failed');
    return { text: '', url, error };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs tasks with a fixed number in flight, so no site sees a burst. */
async function pooled(items, worker, size) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    })
  );
  return results;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  if (REVERT) {
    const { count } = await prisma.eventExhibitor.updateMany({
      where: { eventSlug: EVENT_SLUG },
      data: { industry: null, industryEvidence: [], industrySource: null, industryCheckedAt: null },
    });
    console.log(`Cleared industry on ${count} exhibitors.`);
    return;
  }

  let exhibitors = await prisma.eventExhibitor.findMany({
    where: { eventSlug: EVENT_SLUG },
    select: { id: true, companyName: true, websiteUrl: true, description: true },
    orderBy: { companyName: 'asc' },
  });
  if (LIMIT) exhibitors = exhibitors.slice(0, LIMIT);
  console.log(`${exhibitors.length} exhibitors; fetching ${CONCURRENCY} at a time…`);

  let done = 0;
  const rows = await pooled(
    exhibitors,
    async (exhibitor) => {
      const stored = (exhibitor.description ?? '').trim();
      let fetched = '';
      let source = null;
      let error = null;

      if (exhibitor.websiteUrl) {
        const result = await fetchSite(exhibitor.websiteUrl);
        fetched = result.text;
        error = result.error;
        if (fetched) source = result.url;
      } else {
        error = 'no website';
      }

      // The company's own site leads; the directory blurb only fills gaps.
      const text = [fetched, stored].filter(Boolean).join(' . ');
      const verdict = classifyIndustry(text, exhibitor.companyName);

      done += 1;
      if (done % 25 === 0) console.log(`  …${done}/${exhibitors.length}`);

      return {
        id: exhibitor.id,
        companyName: exhibitor.companyName,
        website: exhibitor.websiteUrl ?? '',
        industry: verdict.industry,
        evidence: verdict.evidence,
        score: verdict.score,
        runnerUp: verdict.runnerUp ? `${verdict.runnerUp.industry} (${verdict.runnerUp.score})` : '',
        reason: verdict.reason,
        source: source ?? (stored ? 'directory description' : ''),
        error: error ?? '',
        textLength: text.length,
        text,
      };
    },
    CONCURRENCY
  );

  const classified = rows.filter((row) => row.industry);
  console.log(`\nClassified ${classified.length}/${rows.length}.`);
  const byReason = {};
  rows.forEach((row) => { byReason[row.reason] = (byReason[row.reason] ?? 0) + 1; });
  console.log('Outcomes:', byReason);

  const counts = {};
  classified.forEach((row) => { counts[row.industry] = (counts[row.industry] ?? 0) + 1; });
  console.log('\nSectors:');
  Object.keys(counts).sort((a, b) => counts[b] - counts[a])
    .forEach((key) => console.log(`  ${String(counts[key]).padStart(3)}  ${key}`));

  const reportDir = join(ROOT, 'reports', 'exhibitor-industries');
  mkdirSync(reportDir, { recursive: true });
  const csv = [
    ['company', 'website', 'industry', 'evidence', 'score', 'runner_up', 'reason', 'source', 'error', 'text_length'].join(','),
    ...rows.map((row) => [
      row.companyName, row.website, row.industry ?? '', row.evidence.join('; '),
      row.score, row.runnerUp, row.reason, row.source, row.error, row.textLength,
    ].map(csvCell).join(',')),
  ].join('\n');
  const reportPath = join(reportDir, 'industries.csv');
  writeFileSync(reportPath, csv, 'utf8');
  // The text each verdict was made from, so the vocabulary can be checked and
  // extended against real copy rather than guesswork.
  writeFileSync(
    join(reportDir, 'corpus.jsonl'),
    rows.map((row) => JSON.stringify({ company: row.companyName, reason: row.reason, industry: row.industry, text: row.text })).join(String.fromCharCode(10)),
    'utf8'
  );
  console.log(`\nReport: ${reportPath}`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply.');
    return;
  }

  const now = new Date();
  for (const row of rows) {
    await prisma.eventExhibitor.update({
      where: { id: row.id },
      data: {
        industry: row.industry,
        industryEvidence: row.evidence,
        industrySource: row.industry ? row.source : null,
        industryCheckedAt: now,
      },
    });
  }
  console.log(`Wrote ${rows.length} rows (${classified.length} with a sector).`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
