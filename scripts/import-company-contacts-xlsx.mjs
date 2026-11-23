/**
 * Import a company's contact spreadsheet (.xlsx or .csv) into
 * data/company-contacts/<domain>.json, which backs the People tab of that
 * company's exhibitor profile.
 *
 *   node scripts/import-company-contacts-xlsx.mjs <path-to-xlsx-or-csv> <company-domain>
 *   node scripts/import-company-contacts-xlsx.mjs "C:\Users\anant\Downloads\ACEBOTT_Contacts.xlsx" acebott.com
 *   node scripts/import-company-contacts-xlsx.mjs "C:\Users\anant\Downloads\acer.csv" acer.com
 *   node scripts/import-company-contacts-xlsx.mjs <file> <domain> --mobile "+44 24 7697 0550"
 *     (stores that number as the mobile of every contact)
 *
 * Columns are matched by header text (case-insensitive), so column order in the
 * sheet does not matter. Recognised headers: Full Name, Company, Job Title,
 * Email, Mobile, Country, plus optional Contact/Person LinkedIn URL and Company
 * LinkedIn URL.
 *
 * Values are kept exactly as the sheet has them, with two exceptions:
 *   - the export tool's placeholders ("No email", "Reveal mobile", ...) become
 *     null, so the table shows "-" rather than a fake value;
 *   - exact duplicate rows (same name, email, personal LinkedIn, title and
 *     country) are dropped;
 *   - mojibake (UTF-8 once mis-read as Windows-1252) is repaired when the
 *     round trip is clean.
 *
 * Reads the .xlsx directly (a zip of XML) rather than adding a spreadsheet
 * dependency — see the disk-space note in CLAUDE.md. Handles both shared and
 * inline strings.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const PLACEHOLDERS = new Set([
  '',
  '-',
  'no email',
  'no mobile',
  'no phone',
  'reveal email',
  'reveal mobile',
  'reveal phone',
  'not revealed',
  'not available',
  'n/a',
  'na',
  'null',
  'none',
]);

const HEADER_ALIASES = {
  fullName: ['full name', 'name', 'person name'],
  company: ['company', 'company name'],
  jobTitle: ['job title', 'title', 'designation'],
  email: ['email', 'email id', 'email address'],
  mobile: ['mobile', 'mobile number', 'phone', 'phone number'],
  country: ['country', 'person country'],
  personLinkedInUrl: ['contact linkedin', 'person linkedin url', 'linkedin url', 'linkedin', 'contact linkedin url'],
  companyLinkedInUrl: ['company linkedin', 'company linkedin url'],
};

const decodeXml = (value) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const textOf = (xml) =>
  [...xml.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('');

function readFirstSheet(xlsxPath) {
  const dir = mkdtempSync(join(tmpdir(), 'contacts-xlsx-'));
  try {
    // `unzip` ships with Git for Windows, which this repo already requires.
    execFileSync('unzip', ['-o', '-q', xlsxPath, '-d', dir], { stdio: 'pipe' });

    const sharedPath = join(dir, 'xl/sharedStrings.xml');
    const shared = existsSync(sharedPath)
      ? [...readFileSync(sharedPath, 'utf8').matchAll(/<si>(.*?)<\/si>/gs)].map((m) => decodeXml(textOf(m[1])))
      : [];

    const sheetXml = readFileSync(join(dir, 'xl/worksheets/sheet1.xml'), 'utf8');
    const rows = [];
    for (const row of sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
      const cells = {};
      for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
        const [, column, attrs, inner = ''] = cell;
        const type = attrs.match(/t="([^"]+)"/)?.[1];
        const raw = inner.match(/<v>(.*?)<\/v>/s)?.[1];
        let value;
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'inlineStr') value = decodeXml(textOf(inner));
        else value = decodeXml(raw ?? textOf(inner));
        cells[column] = value;
      }
      rows.push(cells);
    }
    return rows;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** CSV in the same shape as readFirstSheet: one object per row, keyed by column position. */
function readCsv(csvPath) {
  const text = readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const { data, errors } = Papa.parse(text, { skipEmptyLines: true });
  if (errors.length) throw new Error(`CSV parse errors: ${JSON.stringify(errors.slice(0, 3))}`);
  return data.map((cells) => Object.fromEntries(cells.map((value, index) => [String(index), value])));
}

/** Windows-1252 code points for bytes 0x80–0x9F (the rest map 1:1 to Latin-1). */
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Undo mojibake: UTF-8 text that was once read as Windows-1252 (Classera's
 * sheet has "Ø³Ø§Ø¦Ø¯" for "سائد" and "â€“" for "–"). Only applied when the
 * tell-tale sequences appear AND the round trip yields valid UTF-8, so real
 * text such as "Øster" is left alone.
 */
function repairMojibake(text) {
  // Lead bytes of 2-byte UTF-8 sequences (C2–DF → Â…ß) followed by a
  // continuation byte (80–BF), or the 3-byte "â€" prefix. Cosafe has "Å¼" for "ż".
  if (!/[Â-ß][\u0080-¿ŒœŠšŸŽžƒˆ˜–-™]|â€/.test(text)) {
    return text;
  }
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 256) bytes.push(code);
    else if (CP1252[code] != null) bytes.push(CP1252[code]);
    else return text;
  }
  const repaired = Buffer.from(bytes).toString('utf8');
  return repaired.includes('�') ? text : repaired;
}

function clean(value) {
  if (value == null) return null;
  const trimmed = repairMojibake(String(value)).replace(/\s+/g, ' ').trim();
  return PLACEHOLDERS.has(trimmed.toLowerCase()) ? null : trimmed;
}

function main() {
  const args = process.argv.slice(2);
  // --mobile "<number>": store this number on every contact (owner's
  // instruction for some companies), so it lives in the data file itself.
  const mobileFlag = args.indexOf('--mobile');
  const mobileForAll = mobileFlag >= 0 ? args.splice(mobileFlag, 2)[1]?.trim() || null : null;
  // --only-company "<name>": skip rows whose Company column names another
  // company (Brisk Teaching's sheet carries three Blocksi Inc rows).
  const onlyFlag = args.indexOf('--only-company');
  const onlyCompany = onlyFlag >= 0 ? args.splice(onlyFlag, 2)[1]?.trim().toLowerCase() || null : null;
  const [xlsxPath, domainArg] = args;
  if (!xlsxPath || !domainArg) {
    console.error('Usage: node scripts/import-company-contacts-xlsx.mjs <path-to-xlsx> <company-domain>');
    process.exit(1);
  }
  const domain = domainArg.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

  const [header, ...body] = /\.csv$/i.test(xlsxPath) ? readCsv(xlsxPath) : readFirstSheet(xlsxPath);
  const columnFor = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = Object.entries(header).find(([, label]) => aliases.includes(label.trim().toLowerCase()));
    if (match) columnFor[field] = match[0];
  }
  if (!columnFor.fullName) throw new Error('No "Full Name" column found in the sheet header.');

  const seen = new Set();
  const contacts = [];
  let skippedBlank = 0;
  let skippedDuplicate = 0;
  const skippedOtherCompany = [];
  for (const cells of body) {
    const record = {};
    for (const field of Object.keys(HEADER_ALIASES)) {
      record[field] = columnFor[field] ? clean(cells[columnFor[field]]) : null;
    }
    if (!record.fullName) {
      skippedBlank += 1;
      continue;
    }
    if (onlyCompany && record.company && record.company.toLowerCase() !== onlyCompany) {
      skippedOtherCompany.push(`${record.fullName} (${record.company})`);
      continue;
    }
    // A different personal LinkedIn, title or country means a different record,
    // even when name and email coincide (ActiveFloor lists two "Alan Mcdonald"
    // profiles; Classera two "Islam A. Elgamal" rows with different titles).
    const key = [record.fullName, record.email, record.personLinkedInUrl, record.jobTitle, record.country]
      .map((part) => (part ?? '').toLowerCase())
      .join('|');
    if (seen.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    seen.add(key);
    if (mobileForAll) record.mobile = mobileForAll;
    contacts.push(record);
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(root, 'data', 'company-contacts');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${domain}.json`);
  writeFileSync(
    outPath,
    JSON.stringify({ domain, source: basename(xlsxPath), contacts }, null, 2) + '\n',
    'utf8'
  );

  console.log(`Sheet rows: ${body.length}`);
  console.log(`Imported:   ${contacts.length}`);
  console.log(`Skipped:    ${skippedBlank} blank, ${skippedDuplicate} duplicate, ${skippedOtherCompany.length} other company`);
  for (const row of skippedOtherCompany) console.log(`  other company: ${row}`);
  console.log(`Wrote ${outPath}`);
  console.log(`Remember to register ${domain}.json in lib/companies/company-contacts.ts.`);
}

main();
