// Picks which freshly scraped eventseye calendar rows may be ADDED to the
// Find Shows catalog (data/find-shows-seed.json) without touching any record
// already in it. Read-only on the seed; writes the accepted rows plus a report.
//
// Pipeline for a new window (example: July–December 2027):
//   1. node scripts/import-eventseye-calendar.mjs --window "July 2027..December 2027" --out data/eventseye-2027-h2.json
//   2. node scripts/select-eventseye-additions.mjs --in data/eventseye-2027-h2.json --from 2027-07-01 --to 2027-12-31
//        -> data/eventseye-2027-h2.accepted.json + reports/find-shows-additions/<in-name>/
//   3. node scripts/enrich-event-websites.mjs --in data/eventseye-2027-h2.accepted.json   (official website/organizer)
//   4. node scripts/build-find-shows-seed.mjs --append --in data/eventseye-2027-h2.accepted.json
//
// Accepted = sufficient verified information:
//   - an exact start date eventseye prints as MM/DD/YYYY, inside --from..--to. Rows dated
//     "November 2027 (?)" (eventseye's own "date not confirmed") or a bare "Nov. 2027" are rejected:
//     no date is guessed.
//   - a city with its country, "Lyon (France)". Location-less rows are rejected.
//   - a name and an eventseye detail URL.
// Not already in the catalog, checked in this order (first hit wins):
//   existing  — same eventseye event id listed for the same month-year, or with the same dates;
//   existing  — same eventseye event id in the same year, when the catalog's date for it was only an
//               estimate ("June 2027 (?)", "Jun. 2027") or the show runs at most once a year: that year's
//               edition is already listed (its catalog date is left as it is). A twice-a-year show with a
//               different exact date is a separate edition and is added;
//   duplicate — same normalised name (years, edition numbers, punctuation and case ignored) in the same
//               country starting within 3 days of a catalog record; or a near-identical name
//               (token overlap >= 0.8) in the same city on the same start date. Catches renamed URLs
//               and slightly different names for the same show.
//   duplicate — the same check against rows accepted earlier in this run.
//
// Usage: node scripts/select-eventseye-additions.mjs --in FILE --from YYYY-MM-DD --to YYYY-MM-DD
//          [--seed data/find-shows-seed.json] [--out FILE] [--report-dir DIR]

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
};

const IN = flag("--in");
const FROM = flag("--from");
const TO = flag("--to");
if (!IN || !/^\d{4}-\d{2}-\d{2}$/.test(FROM ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(TO ?? "")) {
  console.error("usage: --in FILE --from YYYY-MM-DD --to YYYY-MM-DD");
  process.exit(1);
}
const SEED = flag("--seed", path.join(ROOT, "data", "find-shows-seed.json"));
const OUT = flag("--out", IN.replace(/\.json$/, ".accepted.json"));
const REPORT_DIR = flag(
  "--report-dir",
  path.join(ROOT, "reports", "find-shows-additions", path.basename(IN, ".json"))
);

// ---------------------------------------------------------------------------

const ENTITIES = { amp: "&", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—" };
const decode = (s) =>
  String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();

/** "f-black-hat-usa-22381-1.html" -> "22381": eventseye's id for the event (stable across renames). */
export function eventseyeId(url) {
  return (String(url ?? "").match(/-(\d+)-\d+\.html$/) || [])[1] ?? null;
}

/** "MM/DD/YYYY" -> "YYYY-MM-DD", or null for anything else ("Nov. 2027", "November 2027 (?)"). */
export function exactStart(dates) {
  const m = String(dates ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/** "Lyon (France)" -> { city: "Lyon", country: "France" }; "Pittsburgh, PA (USA)" -> city "Pittsburgh, PA". */
export function splitCity(raw) {
  const m = decode(raw).match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m && m[1] && m[2] ? { city: m[1].trim(), country: m[2].trim() } : null;
}

const STOP = new Set(["the", "of", "and", "for", "de", "la", "le", "des", "du", "der", "die", "und", "et", "y", "el", "edition", "th", "st", "nd", "rd", "annual", "international", "intl"]);

/** Name with years, edition numbers ("25th"), punctuation, accents and case removed. */
export function nameKey(name) {
  return decode(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b\d+(st|nd|rd|th)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const tokens = (key) => new Set(key.split(" ").filter((t) => t && !STOP.has(t)));
function overlap(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / Math.max(A.size, B.size);
}

const dayNumber = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const norm = (s) => decode(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** One catalog/candidate record reduced to what duplicate checks compare. */
function profile(rec, urlField) {
  const loc = splitCity(rec.city);
  return {
    id: eventseyeId(rec[urlField]),
    monthYear: rec.monthYear ?? "",
    dates: String(rec.dates ?? "").trim(),
    start: exactStart(rec.dates),
    year: (String(rec.dates ?? "").match(/\b(20\d{2})\b/) || [])[1] ?? null,
    frequency: String(rec.frequency ?? "").toLowerCase(),
    key: nameKey(rec.name),
    city: loc ? norm(loc.city) : "",
    country: loc ? norm(loc.country) : "",
    name: decode(rec.name),
  };
}

function findMatch(candidate, pool) {
  for (const p of pool) {
    if (candidate.id && p.id === candidate.id && (p.monthYear === candidate.monthYear || p.dates === candidate.dates)) {
      return { kind: "existing", reason: "same eventseye event id" + (p.monthYear === candidate.monthYear ? " and month" : " and dates"), match: p };
    }
  }
  const atMostYearly = candidate.frequency === "once a year" || /^every \d+ years$/.test(candidate.frequency);
  for (const p of pool) {
    if (candidate.id && p.id === candidate.id && p.year && p.year === candidate.year && (!p.start || atMostYearly)) {
      return {
        kind: "existing",
        reason: p.start ? "same eventseye event id, same year (annual show; catalog date differs)" : "same eventseye event id, same year (catalog date was an estimate)",
        match: p,
      };
    }
  }
  for (const p of pool) {
    if (!p.start || !candidate.start) continue;
    const days = Math.abs(dayNumber(p.start) - dayNumber(candidate.start));
    if (p.key && p.key === candidate.key && p.country && p.country === candidate.country && days <= 3) {
      return { kind: "duplicate", reason: `same name in ${p.country}, start ${days} day(s) apart`, match: p };
    }
    if (days === 0 && p.city && p.city === candidate.city && overlap(p.key, candidate.key) >= 0.8) {
      return { kind: "duplicate", reason: "near-identical name, same city and start date", match: p };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------

const rows = JSON.parse(readFileSync(IN, "utf8"));
const seed = JSON.parse(readFileSync(SEED, "utf8"));
const catalog = seed.map((r) => profile(r, "eventseyeUrl"));

const accepted = [];
const acceptedProfiles = [];
const decisions = [];

for (const row of rows) {
  const p = profile(row, "detailUrl");
  const base = { name: p.name, dates: p.dates, city: decode(row.city), monthYear: p.monthYear, eventseyeUrl: row.detailUrl };

  let rejection = null;
  if (!p.name || !row.detailUrl || !p.id) rejection = "missing name or eventseye URL";
  else if (/\(\?\)/.test(p.dates)) rejection = "date not confirmed on eventseye (marked “(?)”)";
  else if (!p.start) rejection = "no exact start date (month only)";
  else if (p.start < FROM || p.start > TO) rejection = `start ${p.start} outside ${FROM}..${TO}`;
  else if (!splitCity(row.city)) rejection = "no city/country";
  if (rejection) {
    decisions.push({ ...base, status: "rejected", reason: rejection });
    continue;
  }

  const hit = findMatch(p, catalog) ?? (() => {
    const own = findMatch(p, acceptedProfiles);
    return own ? { ...own, kind: "duplicate", reason: `${own.reason} (earlier in this batch)` } : null;
  })();
  if (hit) {
    decisions.push({ ...base, status: hit.kind, reason: hit.reason, matchedName: hit.match.name, matchedDates: hit.match.dates });
    continue;
  }

  accepted.push(row);
  acceptedProfiles.push(p);
  const loc = splitCity(row.city);
  decisions.push({ ...base, status: "accepted", reason: "", start: p.start, country: loc.country, venue: decode(row.venue) || null });
}

// ---------------------------------------------------------------------------

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(accepted, null, 2), "utf8");
writeFileSync(path.join(REPORT_DIR, "decisions.json"), JSON.stringify(decisions, null, 2), "utf8");

const count = (status) => decisions.filter((d) => d.status === status).length;
const tally = (list, key) => {
  const map = new Map();
  for (const d of list) map.set(key(d), (map.get(key(d)) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};
const acc = decisions.filter((d) => d.status === "accepted");
const starts = acc.map((d) => d.start).sort();

const summary = {
  input: path.relative(ROOT, IN),
  window: `${FROM}..${TO}`,
  discovered: rows.length,
  alreadyInCatalog: count("existing"),
  duplicatesSkipped: count("duplicate"),
  rejected: count("rejected"),
  accepted: acc.length,
  acceptedStartRange: starts.length ? `${starts[0]}..${starts[starts.length - 1]}` : null,
  rejectedBy: Object.fromEntries(tally(decisions.filter((d) => d.status === "rejected"), (d) => d.reason.replace(/^start .*/, "start outside window"))),
  acceptedByMonth: Object.fromEntries(tally(acc, (d) => d.monthYear)),
  acceptedByCountry: Object.fromEntries(tally(acc, (d) => d.country)),
};
writeFileSync(path.join(REPORT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

console.log(JSON.stringify({ ...summary, acceptedByCountry: `${Object.keys(summary.acceptedByCountry).length} countries` }, null, 2));
console.log(`wrote ${path.relative(ROOT, OUT)} and ${path.relative(ROOT, REPORT_DIR)}/{summary,decisions}.json`);
