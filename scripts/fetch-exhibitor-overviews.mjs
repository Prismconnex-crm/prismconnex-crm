/**
 * Fills the remaining EventExhibitor.description values for BETT 2027.
 *
 * scripts/fetch-exhibitor-descriptions.mjs already took the easy half: it reads
 * og:description / <meta name=description> and stops. That left 118 exhibitors
 * blank, for three reasons this script handles:
 *
 *   1. The site publishes no description tag at all.
 *   2. It publishes a useless one. 4Matrix's is the whole string
 *      "Tranform your school" — 20 characters, including the typo — which is
 *      worse than nothing on a profile page.
 *   3. The description lives in JSON-LD or only in the rendered page.
 *
 * So the sources here are ordered by how deliberate they are, and a candidate
 * has to survive a quality check before it is accepted:
 *
 *   og:description -> meta description -> JSON-LD description ->
 *   twitter:description -> the page's own H1 plus its first real paragraph
 *
 * Every one of those is the company's own words about itself. Nothing is
 * written, summarised or inferred — the last option composes two sentences the
 * company published, it does not author a third. A site that yields nothing
 * usable keeps a null description and the profile says "Description
 * unavailable", which is the honest outcome.
 *
 * Usage:
 *   node scripts/fetch-exhibitor-overviews.mjs            # dry run
 *   node scripts/fetch-exhibitor-overviews.mjs --apply
 *   node scripts/fetch-exhibitor-overviews.mjs --limit 20
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EVENT_SLUG = 'bett-show-london-2027-01-20';
const CONCURRENCY = 6;
const TIMEOUT_MS = 14_000;
const MAX_HTML = 400_000;
const MAX_LENGTH = 600;
/**
 * Short enough and it is a slogan, not a description. "Tranform your school"
 * is 20 characters; "AI that helps every teacher reach every student" is 47 and
 * genuinely tells you what the company does, so the bar sits just under it.
 */
const MIN_LENGTH = 45;
const USER_AGENT =
  process.env.FETCH_USER_AGENT ?? 'PrismconnexCRM/1.0 (company description import)';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? Number(args[i + 1]) : 0;
})();

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

function tidy(value) {
  if (!value) return null;
  const text = decodeEntities(String(value).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/**
 * Cookie banners, consent text and browser warnings sit at the top of the DOM
 * and would otherwise be the "first paragraph" on a depressing number of sites.
 */
const JUNK = [
  /cookie/i, /consent/i, /privacy policy/i, /javascript/i, /internet explorer/i,
  /browser/i, /all rights reserved/i, /skip to (main )?content/i,
  /scheduled maintenance/i, /service interruption/i,
  /sign up to our newsletter/i, /subscribe to our/i,
  /meet us at/i, /upcoming events/i,
  /^(home|welcome|menu|search|login|loading)\b/i,
];

/**
 * Navigation swept up as a "paragraph": a run of Title Case link labels with
 * no sentence in it — "Recent Clients. Designers of Educational Multimedia
 * More About Us". Real prose has lower-case connecting words between them.
 */
function readsLikeNavigation(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 6) return true;
  const capitalised = words.slice(1).filter((word) => /^[A-Z]/.test(word)).length;
  const hasSentence = /[a-z]{3,}\s+[a-z]{2,}/.test(text);
  return capitalised / (words.length - 1) > 0.45 || !hasSentence;
}

function usable(value) {
  if (!value) return false;
  const text = value.trim();
  if (text.length < MIN_LENGTH || text.length > 2_000) return false;
  // A fragment ending in a colon is the lead-in to a list, not a description:
  // "Admissions+ will automates the transfer of the following data:".
  if (/[:;,]$/.test(text)) return false;
  // A trailing ellipsis means the page itself truncated it — a news teaser
  // ("Over 1,000 children from UK schools ... have been …"), not a description.
  if (/(…|\.\.\.)$/.test(text)) return false;
  if (JUNK.some((pattern) => pattern.test(text))) return false;
  return !readsLikeNavigation(text);
}

function allMatches(html, pattern) {
  // exec in a loop, not matchAll: the repo's ES5 target cannot iterate the
  // iterator matchAll returns.
  const out = [];
  let match;
  while ((match = pattern.exec(html)) !== null) out.push(match[1]);
  return out;
}

function firstMeta(html, patterns) {
  for (const pattern of patterns) {
    for (const raw of allMatches(html, pattern)) {
      const text = tidy(raw);
      if (usable(text)) return text;
    }
  }
  return null;
}

/** schema.org Organization/WebSite description, where a site publishes one. */
function jsonLdDescription(html) {
  const blocks = allMatches(
    html,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block.trim());
    } catch {
      continue;
    }
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph']);
      const type = String(node['@type'] ?? '').toLowerCase();
      if (/organization|website|corporation|localbusiness/.test(type)) {
        const text = tidy(node.description);
        if (usable(text)) return text;
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') queue.push(value);
      }
    }
  }
  return null;
}

/**
 * The company's headline plus its first real paragraph. Used only when the
 * site publishes no description anywhere — both halves are the company's own
 * sentences, joined, never rewritten.
 */
function composedFromPage(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const heading = allMatches(body, /<h1[^>]*>([\s\S]{3,200}?)<\/h1>/gi)
    .map(tidy)
    .find(
      (text) =>
        text &&
        // Under ~20 characters a heading is a section label rather than a
        // claim — "Recent Clients", "Backpacks, bags" — and prefixing it to
        // the paragraph only adds noise.
        text.length >= 20 &&
        !JUNK.some((p) => p.test(text)) &&
        // "ABOUT GLOBISENS" is a section label, not a sentence about the company.
        !/^about\b/i.test(text)
    );

  const paragraph = allMatches(body, /<p[^>]*>([\s\S]{60,700}?)<\/p>/gi)
    .map(tidy)
    .find(usable);

  // The paragraph carries the meaning; the heading only earns its place when
  // it is a claim rather than a banner, which is why it is filtered apart.
  if (heading && paragraph) {
    return /[.!?]$/.test(heading) ? `${heading} ${paragraph}` : `${heading}. ${paragraph}`;
  }
  return paragraph ?? null;
}

function extractDescription(html) {
  const head = html.slice(0, MAX_HTML);

  const og = firstMeta(head, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/gi,
  ]);
  if (og) return { text: og, via: 'og:description' };

  const meta = firstMeta(head, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/gi,
  ]);
  if (meta) return { text: meta, via: 'meta description' };

  const jsonLd = jsonLdDescription(head);
  if (jsonLd) return { text: jsonLd, via: 'schema.org description' };

  const twitter = firstMeta(head, [
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/gi,
  ]);
  if (twitter) return { text: twitter, via: 'twitter:description' };

  const composed = composedFromPage(head);
  if (usable(composed)) return { text: composed, via: 'page heading and opening paragraph' };

  return null;
}

function truncate(text) {
  if (text.length <= MAX_LENGTH) return text;
  // Cut at a sentence end where possible, so the profile never shows half a clause.
  const clipped = text.slice(0, MAX_LENGTH);
  const stop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  return stop > MAX_LENGTH * 0.5 ? clipped.slice(0, stop + 1) : `${clipped.trimEnd()}…`;
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
    if (!response.ok) return { html: null, url: response.url || url, error: `HTTP ${response.status}` };
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { html: null, url: response.url || url, error: 'not html' };
    return { html: (await response.text()).slice(0, MAX_HTML), url: response.url || url, error: null };
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

async function pooled(items, worker, size) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

function cell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const prisma = new PrismaClient();

async function main() {
  let targets = await prisma.eventExhibitor.findMany({
    where: {
      eventSlug: EVENT_SLUG,
      OR: [{ description: null }, { description: '' }],
    },
    select: { id: true, companyName: true, websiteUrl: true },
    orderBy: { companyName: 'asc' },
  });
  if (LIMIT) targets = targets.slice(0, LIMIT);

  const withSite = targets.filter((row) => row.websiteUrl);
  console.log(
    `${targets.length} exhibitors without a description; ${withSite.length} have a website to read.`
  );

  let done = 0;
  const rows = await pooled(
    withSite,
    async (exhibitor) => {
      const result = await fetchSite(exhibitor.websiteUrl);
      done += 1;
      if (done % 20 === 0) console.log(`  ...${done}/${withSite.length}`);
      if (!result.html) {
        return { ...exhibitor, text: null, via: null, source: null, error: result.error };
      }
      const found = extractDescription(result.html);
      return {
        ...exhibitor,
        text: found ? truncate(found.text) : null,
        via: found?.via ?? null,
        source: result.url,
        error: found ? null : 'no usable description',
      };
    },
    CONCURRENCY
  );

  const found = rows.filter((row) => row.text);
  console.log(`\nFound a description for ${found.length}/${withSite.length}.`);
  const byVia = {};
  found.forEach((row) => { byVia[row.via] = (byVia[row.via] ?? 0) + 1; });
  console.log('Taken from:', byVia);

  const reportDir = join(ROOT, 'reports', 'exhibitor-industries');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    join(reportDir, 'descriptions.csv'),
    [
      ['company', 'website', 'via', 'source', 'error', 'description'].join(','),
      ...rows.map((row) =>
        [row.companyName, row.websiteUrl, row.via, row.source, row.error, row.text]
          .map(cell)
          .join(',')
      ),
    ].join('\n'),
    'utf8'
  );
  console.log(`Report: ${join(reportDir, 'descriptions.csv')}`);

  if (!APPLY) {
    console.log('Dry run - nothing written. Re-run with --apply.');
    return;
  }

  for (const row of found) {
    await prisma.eventExhibitor.update({
      where: { id: row.id },
      data: { description: row.text },
    });
  }
  const total = await prisma.eventExhibitor.count({
    where: { eventSlug: EVENT_SLUG, description: { not: null } },
  });
  console.log(`Wrote ${found.length}. ${total}/316 exhibitors now have a description.`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
