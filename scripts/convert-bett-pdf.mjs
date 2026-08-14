// Converts data/bett-detail-information.pdf (the enriched BETT 2027 exhibitor
// sheet, exported to PDF from Excel) into data/bett-2027-exhibitors.json so the
// importer never has to parse a PDF at run time — and so the dataset is
// reviewable in git.
//
// WHY THE PARSING LOOKS THE WAY IT DOES
// Excel prints a wide table as *column blocks*: pages 1-6 carry the first three
// columns for all rows, pages 7-12 the next two, and so on. Every block repeats
// the same row grid, so a row is identified by (page index within the block,
// text baseline Y) — matching by list position would silently shift values
// whenever a cell is blank (many rows have no person LinkedIn URL, for example).
//
// Usage:
//   node scripts/convert-bett-pdf.mjs [--in data/bett-detail-information.pdf]
//                                     [--out data/bett-2027-exhibitors.json]

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
};
const IN = path.resolve(ROOT, flag("--in", "data/bett-detail-information.pdf"));
const OUT = path.resolve(ROOT, flag("--out", "data/bett-2027-exhibitors.json"));

// Column headers as they appear in the sheet, mapped to output field names.
const HEADERS = {
  "Show Name": "showName",
  "First Name": "firstName",
  "Last Name": "lastName",
  "Job Title": "jobTitle",
  "Contact Email": "contactEmail",
  "Contact Person Linkedin URL": "personLinkedInUrl",
  "Company Linkedin URL": "companyLinkedInUrl",
  "Exhibitor Stand Number": "standNumber",
  "Exhibitor Name": "exhibitorName",
  "Exhibitor Website": "website",
  Country: "country",
  "Contact Number": "contactNumber",
  Comment: "comment",
};

// ── PDF text extraction ──────────────────────────────────────────────────────

function inflateStreams(buf) {
  const raw = buf.toString("latin1");
  const streams = [];
  const re = /stream/g;
  let m;
  while ((m = re.exec(raw))) {
    if (raw.slice(m.index - 3, m.index) === "end") continue; // "endstream"
    let start = m.index + "stream".length;
    while (raw[start] === "\r" || raw[start] === "\n") start++;
    const end = raw.indexOf("endstream", start);
    if (end === -1) continue;
    try {
      streams.push(zlib.inflateSync(buf.subarray(start, end)).toString("latin1"));
    } catch {
      // Font programs, images and object streams that aren't flate — skip.
    }
  }
  return streams;
}

const decodePdfString = (s) =>
  s
    .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[c] ?? c))
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));

/** Positioned text cells: one per BT/ET text object, i.e. one per table cell. */
function extractCells(buf) {
  const cells = [];
  let page = 0;
  for (const content of inflateStreams(buf)) {
    if (!/\bT[jJ]\b/.test(content)) continue;
    page++;
    for (const chunk of content.split(/\bBT\b/).slice(1)) {
      const body = chunk.split(/\bET\b/)[0];
      const tm = body.match(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm/);
      const td = body.match(/([-\d.]+)\s+([-\d.]+)\s+T[dD]/);
      const x = tm ? Number(tm[5]) : td ? Number(td[1]) : 0;
      const y = tm ? Number(tm[6]) : td ? Number(td[2]) : 0;
      let text = "";
      for (const tok of body.matchAll(/\((?:[^()\\]|\\.)*\)\s*Tj|\[(?:[^\][\\]|\\.)*\]\s*TJ/g)) {
        const t = tok[0];
        if (t.endsWith("Tj")) text += decodePdfString(t.slice(1, t.lastIndexOf(")")));
        else for (const p of t.matchAll(/\((?:[^()\\]|\\.)*\)/g)) text += decodePdfString(p[0].slice(1, -1));
      }
      text = text.replace(/\s+/g, " ").trim();
      if (text) cells.push({ page, x, y, text });
    }
  }
  return cells;
}

// ── Table reconstruction ─────────────────────────────────────────────────────

const buf = readFileSync(IN);
const cells = extractCells(buf);
const pages = Math.max(...cells.map((c) => c.page));
console.log(`[bett-pdf] ${cells.length.toLocaleString()} text cells across ${pages} pages`);

const pageCells = new Map();
for (const c of cells) {
  if (!pageCells.has(c.page)) pageCells.set(c.page, []);
  pageCells.get(c.page).push(c);
}

/** Cells sharing the topmost baseline on a page — the header row, if any. */
function topRow(list) {
  const maxY = Math.max(...list.map((c) => c.y));
  return list.filter((c) => Math.abs(c.y - maxY) < 3).sort((a, b) => a.x - b.x);
}

// A page whose top row is entirely header labels starts a new column block.
const blocks = [];
for (let p = 1; p <= pages; p++) {
    const list = pageCells.get(p) ?? [];
  if (!list.length) continue;
  const top = topRow(list);
  const isHeader = top.length > 0 && top.every((c) => HEADERS[c.text]);
  if (isHeader) {
    blocks.push({ columns: top.map((c) => ({ x: c.x, field: HEADERS[c.text] })), pages: [p] });
  } else if (blocks.length) {
    blocks[blocks.length - 1].pages.push(p);
  } else {
    throw new Error(`Page ${p} carries data before any header row was seen`);
  }
}
console.log(
  `[bett-pdf] ${blocks.length} column blocks: ${blocks
    .map((b) => `${b.columns.map((c) => c.field).join("+")}(${b.pages.length}p)`)
    .join(", ")}`
);

// Row identity: page index *within* the block plus the baseline Y, quantised to
// absorb sub-point rounding. Blank cells therefore can't shift a column.
const rowKey = (localPage, y) => `${localPage}:${Math.round(y / 2) * 2}`;
const rows = new Map();

for (const block of blocks) {
  block.pages.forEach((page, localPage) => {
    const list = pageCells.get(page) ?? [];
    const headerY = localPage === 0 ? Math.max(...list.map((c) => c.y)) : null;
    for (const cell of list) {
      if (headerY !== null && Math.abs(cell.y - headerY) < 3) continue; // header itself
      // Nearest column by x — headers are centred while data is left- or
      // right-aligned, so exact equality never holds.
      const column = block.columns.reduce((best, col) =>
        Math.abs(col.x - cell.x) < Math.abs(best.x - cell.x) ? col : best
      );
      const key = rowKey(localPage, cell.y);
      if (!rows.has(key)) rows.set(key, { _localPage: localPage, _y: cell.y });
      const row = rows.get(key);
      // Wrapped cells arrive as separate text objects on the same baseline.
      row[column.field] = row[column.field] ? `${row[column.field]} ${cell.text}` : cell.text;
    }
  });
}

const ordered = [...rows.values()]
  .sort((a, b) => a._localPage - b._localPage || b._y - a._y)
  .map(({ _localPage, _y, ...rest }) => rest);

// A usable record needs a company; everything else is optional and stays null
// rather than being guessed at.
const clean = (v) => {
  const s = (v ?? "").toString().trim();
  return s === "" || s === "-" || s.toLowerCase() === "n/a" ? null : s;
};
const normaliseUrl = (v) => {
  const s = clean(v);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
};

const records = ordered
  .map((r) => ({
    showName: clean(r.showName),
    exhibitorName: clean(r.exhibitorName),
    standNumber: clean(r.standNumber)?.replace(/^stand:\s*/i, "") ?? null,
    website: normaliseUrl(r.website),
    country: clean(r.country),
    contactNumber: clean(r.contactNumber),
    companyLinkedInUrl: normaliseUrl(r.companyLinkedInUrl),
    firstName: clean(r.firstName),
    lastName: clean(r.lastName),
    jobTitle: clean(r.jobTitle),
    contactEmail: clean(r.contactEmail),
    personLinkedInUrl: normaliseUrl(r.personLinkedInUrl),
  }))
  .filter((r) => r.exhibitorName);

const skipped = ordered.length - records.length;
writeFileSync(OUT, JSON.stringify(records, null, 2), "utf8");

const count = (field) => records.filter((r) => r[field]).length;
console.log(`[bett-pdf] wrote ${records.length.toLocaleString()} records -> ${OUT}`);
if (skipped) console.log(`[bett-pdf] skipped ${skipped} row(s) with no exhibitor name`);
console.log(
  `[bett-pdf] coverage: website=${count("website")}  country=${count("country")}  ` +
    `stand=${count("standNumber")}  phone=${count("contactNumber")}  ` +
    `companyLinkedIn=${count("companyLinkedInUrl")}  email=${count("contactEmail")}  ` +
    `jobTitle=${count("jobTitle")}  personLinkedIn=${count("personLinkedInUrl")}`
);
console.log(
  `[bett-pdf] distinct websites: ${new Set(records.map((r) => r.website).filter(Boolean)).size.toLocaleString()}`
);
