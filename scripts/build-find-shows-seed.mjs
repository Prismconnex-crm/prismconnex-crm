// Converts the scraped eventseye calendar (data/eventseye-2026-2027.json) into
// the FindShowSeedRecord shape that lib/find-shows/catalog.ts consumes, and
// writes data/find-shows-seed.json.
//
// The calendar listing does not expose eventseye's own category tags (those live
// on each detail page, which would mean ~11k extra requests), so categories are
// derived by keyword-matching the event name + description. The keyword table
// mirrors categoryRules in lib/find-shows/catalog.ts so both classify alike.
//
// Usage: node scripts/build-find-shows-seed.mjs [--in FILE] [--out FILE]

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const inArg = args.indexOf("--in");
const outArg = args.indexOf("--out");
const IN = inArg !== -1 ? args[inArg + 1] : path.join(ROOT, "data", "eventseye-2026-2027.json");
const OUT = outArg !== -1 ? args[outArg + 1] : path.join(ROOT, "data", "find-shows-seed.json");

// Mirrors categoryRules in lib/find-shows/catalog.ts.
const CATEGORY_RULES = [
  { category: "Plastics & Rubber", keywords: ["plastic", "rubber", "composite"] },
  { category: "Manufacturing & Engineering", keywords: ["metal", "mould", "machine tool", "industrial", "manufactur", "engineering", "welding", "automation", "robot"] },
  { category: "Medical & Healthcare", keywords: ["medical", "veterinary", "pharmaceutical", "surgery", "health", "nursing", "dental", "hospital"] },
  { category: "Food & Beverage", keywords: ["food", "catering", "hospitality", "wine", "beer", "coffee", "tea", "chocolate", "bakery", "beverage", "gastronom"] },
  { category: "Technology & Electronics", keywords: ["computer", "internet", "software", "electronic", "digital", "telecom", "semiconductor", "cyber", "data centre", "data center", "artificial intelligence"] },
  { category: "Construction & Building", keywords: ["building", "construction", "architect", "interior", "furniture", "real estate", "hvac", "concrete"] },
  { category: "Energy & Environment", keywords: ["environment", "energy", "oil", "gas", "shipping", "marine", "spatial information", "solar", "renewable", "water", "waste", "recycl", "mining"] },
  { category: "Automotive", keywords: ["motorcycle", "bike", "automobile", "automotive", "vehicle", "transport", "aviation", "aerospace", "rail"] },
  { category: "Packaging", keywords: ["packaging", "print", "label"] },
  { category: "Textiles & Fashion", keywords: ["fashion", "clothing", "textile", "apparel", "leather", "jewel", "footwear", "beauty", "cosmetic"] },
  { category: "Agriculture", keywords: ["agricultur", "horticultur", "arboricultur", "livestock", "poultry", "farm", "garden", "forestry", "fisher"] },
  { category: "Security & Safety", keywords: ["security", "risk management", "safety", "defence", "defense", "fire", "police"] },
];

// The listing HTML carries named and numeric entities beyond the handful the
// scraper strips (&rsquo;, &#8211;, ...), so decode generally here.
const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", deg: "°",
  eacute: "é", egrave: "è", agrave: "à", uuml: "ü",
  ouml: "ö", auml: "ä", szlig: "ß", ccedil: "ç",
  bull: "•", trade: "™", reg: "®", copy: "©",
};

function decodeEntities(value) {
  if (typeof value !== "string" || !value.includes("&")) return value;
  return value
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      // Zero-width and bidi control chars render as artefacts; drop them.
      if (n === 8203 || (n >= 8236 && n <= 8239)) return n === 8239 ? " " : "";
      return String.fromCodePoint(n);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function classify(text) {
  const t = text.toLowerCase();
  const hits = [];
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => t.includes(k))) hits.push(rule.category);
  }
  return hits.length > 0 ? hits.slice(0, 3) : ["General"];
}

const source = JSON.parse(readFileSync(IN, "utf8"));
console.log(`[seed] read ${source.length.toLocaleString()} scraped events`);

// Official website / organizer / e-mail come from the detail-page pass
// (scripts/enrich-event-websites.mjs), keyed by detail URL. Optional: if the
// file is absent the seed still builds, just without those fields.
const contactsPath = path.join(ROOT, "data", "event-contacts.json");
const contacts = existsSync(contactsPath) ? JSON.parse(readFileSync(contactsPath, "utf8")) : {};
console.log(`[seed] ${Object.keys(contacts).length.toLocaleString()} enriched contact records available`);

const records = source.map((raw) => {
  const ev = {
    ...raw,
    name: decodeEntities(raw.name),
    description: decodeEntities(raw.description),
    city: decodeEntities(raw.city),
    venue: decodeEntities(raw.venue),
  };
  const enriched = contacts[raw.detailUrl] ?? {};
  const categories = classify(`${ev.name} ${ev.description}`);
  return {
    name: ev.name,
    dates: ev.dates,
    city: ev.city || "",
    venue: ev.venue || "?",
    organizer: enriched.organizer ?? "",
    categories,
    frequency: ev.frequency || "unknown",
    // Official event site — powers the "Buy Official Tickets" action.
    website: enriched.website ?? "",
    email: enriched.email ?? "",
    // Extra fields the catalog passes straight through to the UI.
    eventseyeUrl: ev.detailUrl ?? null,
    logoUrl: ev.logo ?? null,
    // Venue photograph drives the Overview hero; the component falls back to a
    // gradient when this is null or the image 404s.
    bannerUrl: ev.venuePhoto ?? null,
    description: ev.description ?? "",
    monthYear: ev.monthYear ?? "",
    duration: ev.duration ?? "",
  };
});

// Keep a one-time backup of the previous seed before overwriting.
if (existsSync(OUT)) {
  const backup = OUT.replace(/\.json$/, ".backup.json");
  if (!existsSync(backup)) {
    copyFileSync(OUT, backup);
    console.log(`[seed] backed up previous seed -> ${path.basename(backup)}`);
  }
}

writeFileSync(OUT, JSON.stringify(records, null, 2), "utf8");
console.log(`[seed] wrote ${records.length.toLocaleString()} records -> ${OUT}`);

const byCat = new Map();
records.forEach((r) => byCat.set(r.categories[0], (byCat.get(r.categories[0]) ?? 0) + 1));
console.log("\nprimary category spread:");
[...byCat.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c.padEnd(30)} ${n.toLocaleString()}`));

const byMonth = new Map();
records.forEach((r) => byMonth.set(r.monthYear, (byMonth.get(r.monthYear) ?? 0) + 1));
console.log("\nmonth-year spread:");
[...byMonth.entries()].forEach(([m, n]) => console.log(`  ${m.padEnd(16)} ${n.toLocaleString()}`));
