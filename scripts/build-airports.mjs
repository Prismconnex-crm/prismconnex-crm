// Builds data/airports.json — the airports the How to Reach tab can offer —
// from OurAirports (public domain, https://ourairports.com/data/).
//
// Keeps only airports a trade-show visitor can actually fly into: large or
// medium airports with an IATA code and scheduled passenger service. Seaplane
// bases, heliports, small airfields and closed airports are dropped. The CSV
// (~12 MB) is parsed in memory; only the filtered JSON (~200 KB) is written.
//
// Usage: node scripts/build-airports.mjs

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "airports.json");
const SOURCE = "https://davidmegginson.github.io/ourairports-data/airports.csv";

/** RFC 4180 CSV → rows of fields (quoted fields may contain commas and quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`OurAirports download failed: ${response.status}`);
const [header, ...rows] = parseCsv(await response.text());
const col = Object.fromEntries(header.map((name, index) => [name, index]));

const airports = rows
  .filter(
    (r) =>
      (r[col.type] === "large_airport" || r[col.type] === "medium_airport") &&
      /^[A-Z]{3}$/.test(r[col.iata_code] ?? "") &&
      r[col.scheduled_service] === "yes"
  )
  .map((r) => ({
    iata: r[col.iata_code],
    name: r[col.name],
    city: r[col.municipality] || null,
    country: r[col.iso_country],
    lat: Number(Number(r[col.latitude_deg]).toFixed(5)),
    lng: Number(Number(r[col.longitude_deg]).toFixed(5)),
    size: r[col.type] === "large_airport" ? "large" : "medium",
    ref: r[col.ident],
  }))
  .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
  .sort((a, b) => a.iata.localeCompare(b.iata));

writeFileSync(OUT, JSON.stringify(airports));
console.log(`[airports] ${airports.length.toLocaleString()} airports → ${path.relative(ROOT, OUT)}`);
