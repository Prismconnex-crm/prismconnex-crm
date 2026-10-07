/**
 * Backfill empty EventExhibitor columns for BETT 2027 from the source
 * spreadsheet ("Rob - ESM- FGENQ-2627027 - Batch 1.xlsx", sheet 2).
 *
 *   node scripts/backfill-bett-exhibitors-from-xlsx.mjs <path-to-xlsx>           # dry run
 *   node scripts/backfill-bett-exhibitors-from-xlsx.mjs <path-to-xlsx> --apply   # write
 *
 * The PDF/spreadsheet was already imported by import-bett-exhibitors-pdf.mjs;
 * this only closes the handful of cells that import left empty (names with
 * non-ASCII characters mostly — "Cognicise Teknoloji A.Ş", "Spain Trade &
 * Investment – ICEX").
 *
 * ONLY fills a column that is currently null or blank. An existing value is
 * never overwritten, so re-running is safe and the DB stays the source of
 * truth wherever it already has an answer.
 *
 * Reads the .xlsx directly (it is a zip of XML) rather than adding a
 * spreadsheet dependency — see the disk-space note in CLAUDE.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const EVENT_SLUG = 'bett-show-london-2027-01-20';

/** Spreadsheet column letter -> EventExhibitor field. */
const COLUMN_MAP = {
  B: 'firstName',
  C: 'lastName',
  D: 'designation',
  E: 'email',
  F: 'personLinkedInUrl',
  G: 'companyLinkedInUrl',
  H: 'standNumber',
  J: 'websiteUrl',
  K: 'country',
  L: 'phone',
};

const decodeXml = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function readSheet(xlsxPath) {
  const dir = mkdtempSync(join(tmpdir(), 'bett-xlsx-'));
  try {
    // `unzip` ships with Git for Windows, which this repo already requires.
    execFileSync('unzip', ['-o', '-q', xlsxPath, '-d', dir], { stdio: 'pipe' });

    const sharedXml = readFileSync(join(dir, 'xl/sharedStrings.xml'), 'utf8');
    const shared = [...sharedXml.matchAll(/<si>(.*?)<\/si>/gs)].map((match) =>
      decodeXml([...match[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join(''))
    );

    // Sheet 2 holds the exhibitor rows; sheet 1 is the one-line show summary.
    const sheetXml = readFileSync(join(dir, 'xl/worksheets/sheet2.xml'), 'utf8');
    const rows = [...sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs)];

    return rows.slice(1).map(([, , body]) => {
      const cells = {};
      for (const cell of body.matchAll(
        /<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>(.*?)<\/v>|<is><t[^>]*>(.*?)<\/t><\/is>)?<\/c>/gs
      )) {
        const [, column, type, value, inline] = cell;
        cells[column] =
          type === 's' ? shared[Number(value)] : decodeXml(inline ?? value ?? '');
      }
      return cells;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const clean = (value) => (value ?? '').toString().trim();

/** "Stand: SD20" in the sheet, bare "SD20" in the database. */
const cleanStand = (value) => clean(value).replace(/^stand:\s*/i, '');

async function main() {
  const xlsxPath = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!xlsxPath || xlsxPath.startsWith('--')) {
    console.error('Usage: node scripts/backfill-bett-exhibitors-from-xlsx.mjs <path-to-xlsx> [--apply]');
    process.exit(1);
  }

  const sheetRows = readSheet(xlsxPath).filter((row) => clean(row.I));
  console.log(`Spreadsheet exhibitors: ${sheetRows.length}`);

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.eventExhibitor.findMany({ where: { eventSlug: EVENT_SLUG } });
    const byName = new Map(existing.map((row) => [row.companyName.trim().toLowerCase(), row]));
    console.log(`Database exhibitors:    ${existing.length}`);

    const updates = [];
    let unmatched = 0;

    for (const row of sheetRows) {
      const record = byName.get(clean(row.I).toLowerCase());
      if (!record) {
        unmatched += 1;
        console.log(`  no DB row for "${clean(row.I)}"`);
        continue;
      }

      const data = {};
      for (const [column, field] of Object.entries(COLUMN_MAP)) {
        const value = field === 'standNumber' ? cleanStand(row[column]) : clean(row[column]);
        // Fill only what is missing — an existing value always wins.
        if (value && !clean(record[field])) data[field] = value;
      }

      if (Object.keys(data).length) {
        updates.push({ id: record.id, name: record.companyName, data });
      }
    }

    console.log(`Rows with gaps to fill: ${updates.length}`);
    console.log(`Sheet rows not in DB:   ${unmatched}`);
    for (const update of updates) {
      console.log(`  ${update.name} -> ${Object.keys(update.data).join(', ')}`);
    }

    if (!apply) {
      console.log('\nDry run — nothing written. Re-run with --apply.');
      return;
    }

    for (const update of updates) {
      await prisma.eventExhibitor.update({ where: { id: update.id }, data: update.data });
    }
    console.log(`\nUpdated ${updates.length} rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
