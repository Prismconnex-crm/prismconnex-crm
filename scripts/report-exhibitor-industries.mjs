/**
 * Writes the reviewable record of every exhibitor's industry.
 *
 * One row per exhibitor, including the ones with no sector, each carrying the
 * evidence and the source it came from — so the field can be checked rather
 * than taken on trust.
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EVENT_SLUG = 'bett-show-london-2027-01-20';
const NOT_AVAILABLE = '(not available)';

function cell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const prisma = new PrismaClient();

const rows = await prisma.eventExhibitor.findMany({
  where: { eventSlug: EVENT_SLUG },
  select: {
    companyName: true, standNumber: true, country: true, websiteUrl: true,
    industry: true, industryEvidence: true, industrySource: true, description: true,
  },
  orderBy: { companyName: 'asc' },
});

const csv = [
  ['company', 'stand', 'country', 'website', 'industry', 'evidence', 'source', 'description'].join(','),
  ...rows.map((row) =>
    [
      row.companyName,
      row.standNumber,
      row.country,
      row.websiteUrl,
      row.industry ?? NOT_AVAILABLE,
      (row.industryEvidence ?? []).join('; '),
      row.industrySource,
      row.description ?? NOT_AVAILABLE,
    ]
      .map(cell)
      .join(',')
  ),
].join('\n');

const dir = join(ROOT, 'reports', 'exhibitor-industries');
mkdirSync(dir, { recursive: true });
const path = join(dir, 'final-industries.csv');
writeFileSync(path, csv, 'utf8');

const classified = rows.filter((row) => row.industry).length;
const described = rows.filter((row) => row.description && row.description.trim()).length;
console.log(`${rows.length} exhibitors: ${classified} with a sector, ${described} with a description.`);
console.log(path);

await prisma.$disconnect();
