// Fetches each event's eventseye detail page and extracts the OFFICIAL event
// website (plus organizer and contact e-mail), writing them into
// data/event-contacts.json keyed by the event's detail URL.
//
// Why a detail-page pass: the month calendar listing carries name/dates/city/
// venue/logo but no website. The detail page has it as:
//   <a class="ev-web" title="Go to <EVENT> website" href="https://...">
// The page also contains ev-web links for the VENUE and the ORGANIZER, so the
// event's own link is identified by its "Go to ... website" title rather than
// by position — picking the first ev-web would return the venue's site.
//
// eventseye serves no robots.txt (404 as of 2026-08-10), so there is no
// crawl-delay directive; this still paces requests and is resumable.
//
// Usage:
//   node scripts/enrich-event-websites.mjs [--limit N] [--delay-ms 300]

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "data", "eventseye-2026-2027.json");
const OUT = path.join(ROOT, "data", "event-contacts.json");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const LIMIT = Number(flag("--limit", "0")) || Infinity;
const DELAY_MS = Number(flag("--delay-ms", "300"));

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const cp1252 = new TextDecoder("windows-1252");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  (s ?? "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function fetchPage(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return cp1252.decode(await res.arrayBuffer());
    } catch (e) {
      if (i === tries) throw e;
      await sleep(1200 * i);
    }
  }
}

function parseDetail(html) {
  // Event website: the ev-web anchor whose title reads "Go to <NAME> website".
  let website = null;
  for (const m of html.matchAll(/<a[^>]*class="ev-web"[^>]*>|<a[^>]*>(?=[^<]*)/gi)) {
    const tag = m[0];
    if (!/class="ev-web"/i.test(tag)) continue;
    const title = (tag.match(/title="([^"]*)"/i) || [])[1] ?? "";
    if (/^go to .* website$/i.test(title.trim())) {
      website = (tag.match(/href="([^"]+)"/i) || [])[1] ?? null;
      break;
    }
  }

  // Event e-mail: ev-mail anchor titled "mail to <NAME>" (skip the empty
  // "Send e-mail" form link).
  let email = null;
  for (const m of html.matchAll(/<a[^>]*class="ev-mail"[^>]*>/gi)) {
    const tag = m[0];
    const title = (tag.match(/title="([^"]*)"/i) || [])[1] ?? "";
    const href = (tag.match(/href="mailto:([^"]*)"/i) || [])[1] ?? "";
    if (/^mail to /i.test(title.trim()) && href) { email = href; break; }
  }

  // Organizer: its ev-web link is titled "<Organizer> - <url>".
  let organizer = null;
  for (const m of html.matchAll(/<a[^>]*class="ev-web"[^>]*>/gi)) {
    const title = (m[0].match(/title="([^"]*)"/i) || [])[1] ?? "";
    const t = decode(title);
    if (t.includes(" - http")) { organizer = t.split(" - http")[0].trim(); break; }
  }

  return { website, email, organizer };
}

const events = JSON.parse(readFileSync(SOURCE, "utf8"));
const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const todo = events.filter((e) => e.detailUrl && !(e.detailUrl in cache)).slice(0, LIMIT);
console.log(`[enrich] ${events.length.toLocaleString()} events; ${Object.keys(cache).length.toLocaleString()} cached; ${todo.length.toLocaleString()} to fetch`);

let done = 0, withSite = 0, failed = 0;
const t0 = Date.now();

for (const ev of todo) {
  try {
    const html = await fetchPage(ev.detailUrl);
    cache[ev.detailUrl] = html ? parseDetail(html) : { website: null, email: null, organizer: null };
    if (cache[ev.detailUrl].website) withSite++;
  } catch (e) {
    cache[ev.detailUrl] = { website: null, email: null, organizer: null };
    failed++;
  }
  done++;

  if (done % 100 === 0) {
    writeFileSync(OUT, JSON.stringify(cache), "utf8");
    const rate = done / ((Date.now() - t0) / 1000);
    const etaMin = Math.round((todo.length - done) / Math.max(rate, 0.01) / 60);
    console.log(`[enrich] ${done.toLocaleString()}/${todo.length.toLocaleString()}  websites=${withSite.toLocaleString()}  failed=${failed}  ETA ~${etaMin}min`);
  }
  await sleep(DELAY_MS);
}

writeFileSync(OUT, JSON.stringify(cache), "utf8");
const total = Object.values(cache).filter((v) => v?.website).length;
console.log(`\n[enrich] done. cached ${Object.keys(cache).length.toLocaleString()} pages; ${total.toLocaleString()} have an official website`);
console.log(`wrote ${OUT}`);
