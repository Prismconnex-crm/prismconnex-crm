// Imports trade shows from eventseye's month calendar into
// data/find-shows-seed.json, restricted to a target month-year window.
//
// URL scheme (verified):
//   d1_trade-shows_<month>_<yearIdx>.html          -> page 1
//   d1_trade-shows_<month>_<yearIdx>_<n>.html      -> page n+1
// yearIdx 0 is the next occurrence of that month; the page <title> carries the
// real "Calendar - <Month> <Year>", so the year is read rather than assumed.
//
// Each listing row already carries name, description, frequency, city, venue
// and dates, and the event logo is derivable from the detail-page slug
// (f-black-hat-usa-22381-1.html -> /s/black-hat-usa-22381-1.gif), so no
// per-event request is needed.
//
// Usage: node scripts/import-eventseye-calendar.mjs [--out FILE] [--limit-pages N]

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outArg = args.indexOf("--out");
const OUT = outArg !== -1 ? args[outArg + 1] : path.join(ROOT, "data", "find-shows-seed.json");
const pageArg = args.indexOf("--limit-pages");
const LIMIT_PAGES = pageArg !== -1 ? Number(args[pageArg + 1]) : Infinity;

const BASE = "https://www.eventseye.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

// Target window: August 2026 through July 2027.
const TARGET = new Set([
  "August 2026","September 2026","October 2026","November 2026","December 2026",
  "January 2027","February 2027","March 2027","April 2027","May 2027","June 2027","July 2027",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// eventseye declares <meta charset="windows-1252">. Decoding the bytes as UTF-8
// mangles every accented city/venue name (São Paulo -> S?o Paulo), so decode
// explicitly with the declared charset.
const cp1252 = new TextDecoder("windows-1252");

async function fetchPage(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return cp1252.decode(await res.arrayBuffer());
    } catch (e) {
      if (i === tries) throw e;
      await sleep(1500 * i);
    }
  }
}

const decode = (s) =>
  (s ?? "")
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    // Replace tags with a space, not "" — "01/20/2027<br>3 days" must not
    // collapse into "01/20/20273 days".
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function parseRows(html) {
  const monthYear = (html.match(/Calendar - ([A-Za-z]+ \d{4})/) || [])[1] ?? null;
  // eventseye prints its own total, e.g. "500 Trade Shows" — used to verify
  // coverage rather than trusting the crawl blindly.
  const stated = Number((html.match(/([\d,]+)\s+Trade Shows/) || [])[1]?.replace(/,/g, "")) || null;
  const rows = [];

  // Each event row: <a href="f-...html"><b>NAME</b><i>DESC</i></a> then
  // frequency, city/venue links and the date cell.
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const link = (row.match(/<a href="(f-[^"]+\.html)"/) || [])[1];
    if (!link) continue;

    const name = decode((row.match(/<b>([\s\S]*?)<\/b>/) || [])[1]);
    if (!name) continue;
    const description = decode((row.match(/<i>([\s\S]*?)<\/i>/) || [])[1]);

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    const frequency = decode(cells[1]) || "unknown";
    const city = decode((cells[2]?.match(/<a href="cy1_[^"]*"[^>]*>([\s\S]*?)<\/a>/) || [])[1]) || "";
    const venueHref = (cells[2]?.match(/<a href="(pl1_[^"]+\.html)"/) || [])[1] ?? "";
    const venue = decode((cells[2]?.match(/<a href="pl1_[^"]*"[^>]*>([\s\S]*?)<\/a>/) || [])[1]) || "";

    // pl1_trade-shows_las-vegas-nv_1009.html -> /l/las-vegas-nv-1009-1.jpg
    const venueMatch = venueHref.match(/^pl1_trade-shows_(.+)_(\d+)\.html$/);
    const venuePhoto = venueMatch ? `${BASE}/l/${venueMatch[1]}-${venueMatch[2]}-1.jpg` : null;
    // The date cell is "01/20/2027<br><i>3 days</i>" (or just "Jan. 2027").
    // Split on the <br> so the date and duration never bleed into each other —
    // a regex over the flattened text mis-parsed "20273 days".
    const dateCellParts = (cells[3] ?? "").split(/<br\s*\/?>/i);
    const dates = decode(dateCellParts[0]);
    const duration = (decode(dateCellParts.slice(1).join(" ")).match(/(\d+\s*days?)/i) || [])[1] ?? "";

    // f-black-hat-usa-22381-1.html -> /s/black-hat-usa-22381-1.gif
    const slug = link.replace(/^f-/, "").replace(/\.html$/, "");
    rows.push({
      name,
      description,
      dates,
      duration,
      city,
      venue,
      frequency,
      monthYear,
      detailUrl: `${BASE}/fairs/${link}`,
      logo: `${BASE}/s/${slug}.gif`,
      venuePhoto,
    });
  }
  return { monthYear, rows, stated };
}

const collected = [];
// Keyed by detailUrl + monthYear: an event can legitimately be listed under more
// than one month, so a global URL-only key would silently drop those repeats.
const seen = new Set();
// eventseye sometimes exposes the same month-year under two year indexes
// (june_1 and june_2 both report "June 2027") with overlapping but unequal page
// sets. Take the first index that yields a target month and ignore later ones.
const completedMonths = new Set();
const statedTotals = new Map();
let requests = 0;

for (const month of MONTHS) {
  // yearIdx 0/1/2 cover the next few occurrences of this month name.
  for (let yearIdx = 0; yearIdx <= 2; yearIdx++) {
    let pageInWindow = false;
    let lastMonthYear = null;

    for (let page = 0; page < LIMIT_PAGES; page++) {
      const suffix = page === 0 ? "" : `_${page}`;
      const url = `${BASE}/fairs/d1_trade-shows_${month}_${yearIdx}${suffix}.html`;
      const html = await fetchPage(url);
      requests++;
      if (!html) break;

      const { monthYear, rows, stated } = parseRows(html);
      if (rows.length === 0) break;
      if (page === 0 && stated && TARGET.has(monthYear ?? "")) statedTotals.set(monthYear, stated);

      if (!TARGET.has(monthYear ?? "")) break; // wrong month-year, skip this index
      if (completedMonths.has(monthYear)) break; // already gathered from an earlier index
      pageInWindow = true;
      lastMonthYear = monthYear;

      let added = 0;
      for (const r of rows) {
        const key = `${r.detailUrl}::${r.monthYear}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(r);
        added++;
      }
      console.log(`[eventseye] ${monthYear} p${page + 1}: +${added} (total ${collected.length.toLocaleString()})`);

      await sleep(350); // be polite
    }

    if (pageInWindow && lastMonthYear) completedMonths.add(lastMonthYear);
    if (!pageInWindow && yearIdx === 2) break;
  }
}

console.log(`\n[eventseye] requests=${requests} events=${collected.length.toLocaleString()}`);

const byMonth = new Map();
collected.forEach((e) => byMonth.set(e.monthYear, (byMonth.get(e.monthYear) ?? 0) + 1));
console.log("\nBY MONTH-YEAR:");
[...TARGET].forEach((k) => console.log(`  ${k.padEnd(16)} ${(byMonth.get(k) ?? 0).toLocaleString()}`));

console.log("\nCOVERAGE vs eventseye stated totals:");
let shortfall = 0;
[...TARGET].forEach((k) => {
  const got = byMonth.get(k) ?? 0;
  const want = statedTotals.get(k) ?? null;
  const diff = want ? got - want : 0;
  if (want && diff < 0) shortfall += -diff;
  console.log(`  ${k.padEnd(16)} got ${String(got).padStart(5)}  stated ${String(want ?? "?").padStart(5)}  ${want ? (diff === 0 ? "OK" : (diff > 0 ? `+${diff}` : `${diff}`)) : ""}`);
});
console.log(`  total shortfall: ${shortfall}`);

writeFileSync(OUT, JSON.stringify(collected, null, 2), "utf8");
console.log(`\nwrote ${OUT}`);
