// Builds data/city-coordinates.json — a { "City (Country)": [lng, lat] } cache
// used by the event detail map.
//
// Geocodes the unique city strings across the seed (a few thousand) rather than
// one lookup per event, so the whole catalogue resolves from a small cached file
// and the app never calls Mapbox at runtime.
//
// Requires MAPBOX_TOKEN (or NEXT_PUBLIC_MAPBOX_TOKEN) in .env.
// Usage: node scripts/geocode-event-cities.mjs [--limit N]

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(path.join(ROOT, ".env"), "utf8");
const TOKEN =
  envText.match(/^NEXT_PUBLIC_MAPBOX_TOKEN="?([^"\n]+)"?/m)?.[1] ??
  envText.match(/^MAPBOX_TOKEN="?([^"\n]+)"?/m)?.[1];
if (!TOKEN) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN not found in .env");

const SEED = path.join(ROOT, "data", "find-shows-seed.json");
const OUT = path.join(ROOT, "data", "city-coordinates.json");

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(args[limitArg + 1]) : Infinity;

const seed = JSON.parse(readFileSync(SEED, "utf8"));
const cities = [...new Set(seed.map((e) => e.city).filter(Boolean))];
console.log(`[geocode] ${cities.length.toLocaleString()} unique city strings`);

const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const todo = cities.filter((c) => !(c in cache)).slice(0, LIMIT);
console.log(`[geocode] ${Object.keys(cache).length.toLocaleString()} cached, ${todo.length.toLocaleString()} to fetch`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "Perth (Australia)" -> "Perth, Australia"; "Las Vegas, NV (USA)" -> "Las Vegas, NV, USA"
function toQuery(city) {
  return city.replace(/\s*\(([^)]+)\)\s*$/, ", $1").trim();
}

let done = 0;
let failed = 0;
for (const city of todo) {
  const q = encodeURIComponent(toQuery(city));
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?types=place,locality,region&limit=1&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    cache[city] = Array.isArray(center) ? center : null;
    if (!center) failed++;
  } catch (e) {
    cache[city] = null;
    failed++;
    console.error(`  ${city}: ${e.message}`);
  }
  done++;
  if (done % 100 === 0) {
    writeFileSync(OUT, JSON.stringify(cache), "utf8");
    console.log(`[geocode] ${done.toLocaleString()} / ${todo.length.toLocaleString()} (${failed} unresolved)`);
  }
  await sleep(120); // stay well inside Mapbox rate limits
}

writeFileSync(OUT, JSON.stringify(cache), "utf8");
const resolved = Object.values(cache).filter(Boolean).length;
console.log(`\n[geocode] done. resolved ${resolved.toLocaleString()} / ${Object.keys(cache).length.toLocaleString()} cities`);
console.log(`wrote ${OUT}`);
