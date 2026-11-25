/**
 * Finds the official website of exhibitors that have none, by web search, for events whose own directory
 * cannot be read (MapYourShow answers automated visits with a WAF challenge). A result is accepted only when
 * its domain carries a distinctive word of the company name (or its initials) — generic words such as
 * "medical", "surgical" or a city name never count — and it is not a directory, social network, marketplace
 * or news site. Fills blanks only; the per-site reader (enrich-exhibitor-profiles --phase=site) then takes
 * logo, description, LinkedIn, phone and country from the company's own site.
 *
 *   npm run exhibitors:find-websites -- --event=aaos                    dry run: search, show picks, write nothing
 *   npm run exhibitors:find-websites -- --event=aaos --hint=orthopedic --apply
 *     --limit=N        stop after N new searches
 *     --show=N         print N picks (default 40)
 *
 * Searches are cached in .next/cache/exhibitor-enrichment/website-search.jsonl, so a re-run resumes. Uses the
 * app's throttled search provider (one query at a time, spaced, and it stops when the engine pushes back).
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/db/prisma';
import { braveSearch, duckDuckGoSearch, type SearchProvider } from '@/lib/find-shows/floor-plan-discovery';

const has = (flag: string) => process.argv.includes(`--${flag}`);
const arg = (name: string) => process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = has('apply');
const event = arg('event');
const hint = arg('hint') ?? '';
const limit = Number(arg('limit') ?? Infinity);
const show = Number(arg('show') ?? 40);
if (!event) {
  console.error('Pass --event=<slug substring>.');
  process.exit(1);
}

const cacheFile = path.join(process.cwd(), '.next', 'cache', 'exhibitor-enrichment', 'website-search.jsonl');

/** Hosts that are never a company's own site. */
const NOT_OFFICIAL =
  /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|tiktok|pinterest|wikipedia|wikidata|bloomberg|zoominfo|crunchbase|dnb|opencorporates|rocketreach|apollo|signalhire|cbinsights|pitchbook|owler|glassdoor|indeed|yelp|amazon|ebay|alibaba|aliexpress|made-in-china|globalsources|indiamart|tradeindia|europages|kompass|thomasnet|mapyourshow|aaos|aapex|10times|expocheck|eventseye|nferias|tradefairdates|prnewswire|businesswire|globenewswire|reuters|forbes|medgadget|fda|sec|google|bing|duckduckgo|apple|microsoft|github|reddit|quora|medium|issuu|scribd|yumpu|sciencedirect|springer|nih|pubmed|researchgate)\.[a-z.]+$/i;

/** Words that say what a company does or where it is, not who it is. */
const GENERIC = new Set(
  ('the and ltd llc inc gmbh corp company group limited sas sarl spa srl plc pty ab oy kft sro ooo usa us na ' +
    'international global industries industry technologies technology tech solutions services products trading systems ' +
    'manufacturing medical medtech surgical surgery ortho orthopedic orthopedics orthopaedic orthopaedics spine spinal ' +
    'device devices instrument instruments equipment health healthcare care bio biologics biomedical pharma clinical ' +
    'science sciences scientific innovations innovation labs lab research partners holdings enterprise enterprises ' +
    'america american north south east west china chinese beijing shanghai jiangsu tianjin shenzhen suzhou changzhou ' +
    'zhejiang guangdong hebei shandong wuhan wuhu korea japan india taiwan germany france italy spain uk new co').split(' '),
);

function words(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function domainLabel(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.');
  const twoPart = /^(co|com|org|net|ac|ne|or|go)$/.test(parts[parts.length - 2] ?? '') && (parts[parts.length - 1] ?? '').length === 2;
  return (parts[parts.length - (twoPart ? 3 : 2)] ?? '').replace(/-/g, '');
}

/** True when the domain carries a distinctive name word (≥4 letters, or 3 when it is the whole label) or the initials. */
export function officialDomainFor(host: string, companyName: string): boolean {
  const label = domainLabel(host);
  const all = words(companyName);
  const distinctive = all.filter((w) => !GENERIC.has(w) && w.length >= 3);
  if (distinctive.some((w) => (w.length >= 4 ? label.includes(w) : label === w || label.startsWith(w)))) return true;
  // Two short words run together: "b one" → "bone", "TDM Korea" handled above.
  if (all.length >= 2 && label.startsWith(all[0] + all[1]) && (all[0] + all[1]).length >= 4) return true;
  const initials = all.filter((w) => !/^(the|and|of|ltd|llc|inc|gmbh|co|corp|limited|sa|ag|plc)$/.test(w)).map((w) => w[0]).join('');
  return initials.length >= 3 && (label === initials || label.startsWith(initials) && label.length <= initials.length + 5);
}

// ── --guess: no search engine; try the domains a company's name suggests and verify each homepage ──

const LEGAL = /^(the|and|of|ltd|llc|inc|gmbh|co|corp|corporation|company|limited|sa|sas|ag|plc|pty|srl|spa|bv|ab|oy|kg|sau|usa)$/;
const PARKED = /domain (is )?for sale|buy this domain|this domain (may be|is) for sale|parked (free|domain)|sedo(parking)?|hugedomains|dan\.com|godaddy|domain has expired|future home of|coming soon|domainmarket|claim your brand|afternic/i;

/** Candidate hostnames, most likely first. */
export function guessHosts(companyName: string): string[] {
  const all = words(companyName).filter((w) => !LEGAL.test(w));
  const distinctive = all.filter((w) => !GENERIC.has(w) && w.length >= 3);
  const stems = new Set<string>();
  if (all.length && all.length <= 3) stems.add(all.join(''));
  if (all.length >= 2 && all.length <= 3) stems.add(all.join('-'));
  for (const d of distinctive.slice(0, 2)) {
    stems.add(d);
    for (const g of all.filter((w) => GENERIC.has(w) && w !== d).slice(0, 2)) {
      stems.add(`${d}${g}`);
      stems.add(`${d}-${g}`);
    }
  }
  if (distinctive.length >= 2) stems.add(distinctive.slice(0, 2).join(''));
  const list = Array.from(stems).filter((s) => s.length >= 3 && s.length <= 30);
  // .com for every stem, then the other endings (--tlds) for the three likeliest stems only.
  const more = (arg('tlds') ?? '').split(',').map((t) => t.trim().replace(/^\./, '')).filter(Boolean);
  return [...list.map((s) => `${s}.com`), ...list.slice(0, 3).flatMap((s) => more.map((t) => `${s}.${t}`))];
}

/** Words that say nothing about which company it is, so never count as the title naming it. */
const WEAK = /^(device|devices|technology|technologies|tech|systems|system|group|solutions|services|products|industries|international|global|enterprises|holdings|partners)$/;
const GEO = /^(america|american|north|south|east|west|china|chinese|beijing|shanghai|jiangsu|tianjin|shenzhen|suzhou|changzhou|zhejiang|guangdong|hebei|shandong|wuhan|wuhu|korea|japan|india|taiwan|germany|france|italy|spain|uk|usa|us|na|new)$/;

/**
 * The page is the company's: the domain carries the name's first distinctive word, and the page title names the
 * company — the whole name run together, or (for a name of several words) at least two of its words. One shared
 * word is how "Atlantic Health System" lands on atlantic.com (a computing firm) and "b-ONE Ortho" on one.com.
 */
export function namedByPage(host: string, title: string, companyName: string): boolean {
  const all = words(companyName).filter((w) => !LEGAL.test(w));
  const first = all.find((w) => !GENERIC.has(w) && w.length >= 3);
  if (!first || !domainLabel(host).includes(first)) return false;
  const titleWords = words(title);
  if (titleWords.join('').includes(all.join(''))) return true;
  const countable = all.filter((w) => !WEAK.test(w) && !GEO.test(w) && w.length >= 2);
  const found = countable.filter((w) => titleWords.some((t) => t === w || (w.length >= 4 && t.startsWith(w)) || (t.length >= 4 && w.startsWith(t) && w.length - t.length <= 2)));
  return countable.length <= 1 ? found.length === countable.length && found.length > 0 : found.length >= 2;
}

function titleOf(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1] ?? '';
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '';
  return `${og} ${title}`.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** The homepage at `host` belongs to the company: its title names it, it fits the show's field, and it isn't parked. */
async function verifyHost(host: string, companyName: string, field: RegExp): Promise<{ url: string; title: string } | null> {
  try {
    const res = await fetch(`https://${host}/`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PrismconnexBot/1.0)', accept: 'text/html' },
    });
    if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) return null;
    const html = (await res.text()).slice(0, 600_000);
    const final = new URL(res.url);
    if (!officialDomainFor(final.hostname, companyName) || PARKED.test(html.slice(0, 20_000))) return null;
    if (!namedByPage(final.hostname, titleOf(html), companyName) || !field.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) return null;
    const title = titleOf(html);
    return { url: `${final.protocol}//${final.hostname.toLowerCase()}`, title };
  } catch {
    return null;
  }
}

const guessCacheFile = path.join(process.cwd(), '.next', 'cache', 'exhibitor-enrichment', 'website-guess.jsonl');

/** verifyHost with a hard ceiling: a body that never ends must not leave the process with nothing to wait on. */
function verifyWithCeiling(host: string, companyName: string, field: RegExp) {
  let timer: NodeJS.Timeout;
  return Promise.race([
    verifyHost(host, companyName, field),
    new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), 20_000))),
  ]).finally(() => clearTimeout(timer));
}

async function guessMode(rows: { id: string; companyName: string }[], field: RegExp) {
  // Cache per company name and field, so a re-run (or a crash) resumes instead of re-checking every site.
  const cache = new Map<string, { url: string; title: string } | null>();
  if (fs.existsSync(guessCacheFile)) {
    for (const line of fs.readFileSync(guessCacheFile, 'utf8').split('\n')) {
      try {
        const rec = JSON.parse(line);
        cache.set(`${rec.field}|${rec.name}`, rec.hit);
      } catch {}
    }
  }
  fs.mkdirSync(path.dirname(guessCacheFile), { recursive: true });
  const out = fs.createWriteStream(guessCacheFile, { flags: 'a' });
  const picks: { id: string; name: string; url: string; title: string }[] = [];
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (i < rows.length) {
        const r = rows[i++];
        if (/^aaos\b/i.test(r.companyName)) continue; // the show's own booths, not companies
        const key = `${field.source}|${r.companyName}`;
        let hit = cache.get(key);
        if (hit === undefined) {
          hit = null;
          for (const host of guessHosts(r.companyName)) {
            hit = await verifyWithCeiling(host, r.companyName, field);
            if (hit) break;
          }
          cache.set(key, hit);
          out.write(`${JSON.stringify({ field: field.source, name: r.companyName, hit })}\n`);
        }
        if (hit) picks.push({ id: r.id, name: r.companyName, ...hit });
        if (++done % 250 === 0) console.log(`  checked ${done}/${rows.length}`);
      }
    }),
  );
  await new Promise((resolve) => out.end(resolve));
  return picks;
}

type Cached ={ name: string; query: string; results: { url: string; title: string }[]; error?: string };

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ id: string; companyName: string }[]>(
    `SELECT id, "companyName" FROM "EventExhibitor" WHERE "eventSlug" LIKE $1 AND "websiteUrl" IS NULL ORDER BY "companyName"`,
    `%${event}%`,
  );
  if (has('guess')) {
    // --field=<regex>: words the company's homepage must contain (default: medical/orthopaedic vocabulary).
    const field = new RegExp(arg('field') ?? 'ortho|surg|spine|spinal|implant|medical|patient|clinic|hospital|trauma|joint|bone|physician|health', 'i');
    // --reject=host,host: picks a reviewer ruled out (same name, different company).
    const rejected = new Set((arg('reject') ?? '').split(',').map((h) => h.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean));
    const picks = (await guessMode(rows, field)).filter((p) => !rejected.has(new URL(p.url).hostname.replace(/^www\./, '')));
    console.log(`Exhibitors without a website: ${rows.length}; verified site found by name: ${picks.length}`);
    for (const p of [...picks].sort(() => Math.random() - 0.5).slice(0, show)) console.log(`  ${p.name.slice(0, 40).padEnd(40)} ${p.url.padEnd(36)} ${p.title.slice(0, 50)}`);
    if (!apply) return console.log('\nDry run — nothing written. Re-run with --apply.');
    let written = 0;
    for (const p of picks) written += await prisma.$executeRawUnsafe(`UPDATE "EventExhibitor" SET "websiteUrl" = $2 WHERE id = $1 AND "websiteUrl" IS NULL`, p.id, p.url);
    return console.log(`Written ${written}.`);
  }
  const cache = new Map<string, Cached>();
  if (fs.existsSync(cacheFile)) {
    for (const line of fs.readFileSync(cacheFile, 'utf8').split('\n')) {
      try {
        const rec = JSON.parse(line) as Cached;
        if (!rec.error) cache.set(rec.query, rec);
      } catch {}
    }
  }
  const provider: SearchProvider = process.env.BRAVE_SEARCH_API_KEY ? braveSearch(process.env.BRAVE_SEARCH_API_KEY) : duckDuckGoSearch();
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  const out = fs.createWriteStream(cacheFile, { flags: 'a' });

  const picks: { id: string; name: string; url: string; title: string }[] = [];
  let searched = 0;
  let stopped = false;
  for (const r of rows) {
    const query = `${r.companyName.replace(/[,.]+/g, ' ').trim()} ${hint}`.trim();
    let rec = cache.get(query);
    if (!rec && !stopped && searched < limit) {
      try {
        const results = await provider.search(query);
        rec = { name: r.companyName, query, results: results.slice(0, 10).map((x) => ({ url: x.url, title: x.title })) };
      } catch (e) {
        const message = String((e as Error).message ?? e);
        rec = { name: r.companyName, query, results: [], error: message.slice(0, 100) };
        // The engine pushed back: stop searching instead of hammering it; a later run resumes from the cache.
        if (/rate|cooling|HTTP (202|403|429)/.test(message)) {
          console.log(`Search provider pushed back (${message}); stopping searches. Re-run later to resume.`);
          stopped = true;
        }
      }
      searched++;
      out.write(`${JSON.stringify(rec)}\n`);
      if (!rec.error) cache.set(query, rec);
      if (searched % 25 === 0) console.log(`  searched ${searched}`);
    }
    if (!rec || rec.error) continue;
    for (const res of rec.results) {
      let u: URL;
      try {
        u = new URL(res.url);
      } catch {
        continue;
      }
      if (!/^https?:$/.test(u.protocol) || NOT_OFFICIAL.test(u.hostname)) continue;
      if (!officialDomainFor(u.hostname, r.companyName)) continue;
      picks.push({ id: r.id, name: r.companyName, url: `${u.protocol}//${u.hostname.toLowerCase()}`, title: res.title });
      break;
    }
  }
  await new Promise((resolve) => out.end(resolve));

  console.log(`Exhibitors without a website: ${rows.length}; searched now: ${searched}; official site found: ${picks.length}`);
  for (const p of [...picks].sort(() => Math.random() - 0.5).slice(0, show)) {
    console.log(`  ${p.name.slice(0, 40).padEnd(40)} ${p.url.padEnd(40)} ${p.title.slice(0, 50)}`);
  }
  if (!apply) return console.log('\nDry run — nothing written. Re-run with --apply.');
  let written = 0;
  for (const p of picks) {
    written += await prisma.$executeRawUnsafe(`UPDATE "EventExhibitor" SET "websiteUrl" = $2 WHERE id = $1 AND "websiteUrl" IS NULL`, p.id, p.url);
  }
  console.log(`Written ${written}.`);
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
