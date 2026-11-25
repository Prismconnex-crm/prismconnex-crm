/**
 * Upcoming events' exhibitor-directory status → data/exhibitor-directories.json, plus the event-wise import
 * report. Reads only: the catalog, the discovery store (npm run exhibitors:discover) and the CRM sync's dry
 * run (npm run exhibitors:sync-crm -- --all --upcoming --insert-only, without --write). Writes no database.
 *
 *   npm run exhibitors:directories
 *
 * data/exhibitor-directories.json — one entry per upcoming catalog event where discovery found any directory
 * evidence (a list, a link, an empty directory, a blocked or failed fetch). An upcoming event absent from it
 * had no verified directory as of `generatedAt`; it is searched again by the next discovery run. Reference
 * events (lib/exhibitors/reference-events.ts) are listed with status REFERENCE and never queued.
 *
 * Completeness of a readable list:
 *  - complete  the whole list was read (discovery records a directory's own total only when it could not);
 *  - partial   only part of the list could be read (the directory's own total is higher, or its pager runs
 *              in the page's script).
 *
 * Held back, never counted as ready: an event whose list comes from a reference event's directory (another
 * catalog record pointing at BETT's directory, say) — that needs a person to decide it is the same show.
 *
 * Report: reports/crm-exhibitor-sync/upcoming-import-plan.md and .csv (one row per event).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { exhibitorStoreDir, type ExhibitorRecord } from '@/lib/find-shows/exhibitor-resolver';
import { isReferenceExhibitorEvent } from '@/lib/exhibitors/reference-events';
import type { EventSyncResult } from '@/lib/exhibitors/crm-sync';

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);
const DRY_RUN = path.join(root, 'reports', 'crm-exhibitor-sync', 'all-upcoming-dry-run.json');

type Completeness = 'complete' | 'partial';

type DirectoryEntry = {
  name: string;
  city: string;
  country: string;
  startDate: string;
  status: string;
  platform: string | null;
  directoryUrl: string | null;
  /** Exhibitors read from the directory. */
  listed: number;
  /** New CRM rows the dry run would insert (unique profile pages; 0 when the list cannot be keyed). */
  importable: number;
  /** The total the directory itself states, when it states one. */
  directoryTotal: number | null;
  completeness: Completeness | null;
  /** Why the list cannot be imported, or is held back, when it is. */
  note: string | null;
  /** Shares a reference event's directory: never counted as ready, needs a decision. */
  held: boolean;
  checkedAt: string | null;
};

function completeness(listed: number, total: number | null | undefined, partial: boolean | undefined): Completeness {
  return partial || (total ?? 0) > listed ? 'partial' : 'complete';
}

function statusOf(record: ExhibitorRecord): string {
  if (record.verified) return record.verified.status;
  return record.lastAttempt.failure ?? record.lastAttempt.status;
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function main() {
  const dryRun = JSON.parse(await readFile(DRY_RUN, 'utf8')) as { at: string; results: EventSyncResult[] };
  const syncBySlug = new Map(dryRun.results.map((result) => [result.slug, result]));

  const recordBySlug = new Map<string, ExhibitorRecord>();
  const dir = exhibitorStoreDir();
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json.gz'))) {
    try {
      const record = JSON.parse(gunzipSync(await readFile(path.join(dir, file))).toString('utf8')) as ExhibitorRecord;
      for (const slug of record.edition.slugs) recordBySlug.set(slug, record);
    } catch {
      // Unreadable record: nothing to report for it.
    }
  }

  const upcoming = findShowEvents.filter((event) => event.startDate >= today);
  // Directories that belong to a reference event, by any of its catalog slugs.
  const referenceDirectories = new Set<string>();
  for (const [slug, record] of Array.from(recordBySlug)) {
    const url = record.verified?.source?.directoryUrl;
    if (url && isReferenceExhibitorEvent(slug)) referenceDirectories.add(url);
  }
  const events: Record<string, DirectoryEntry> = {};
  for (const event of upcoming) {
    const record = recordBySlug.get(event.slug);
    if (!record) continue;
    const status = isReferenceExhibitorEvent(event.slug) ? 'REFERENCE' : statusOf(record);
    if (status === 'NO_VERIFIED_DIRECTORY') continue;
    const list = record.verified?.status === 'VERIFIED_LIST' ? record.verified : null;
    const shown = record.verified ?? record.lastAttempt;
    const sync = syncBySlug.get(event.slug);
    const directoryUrl = shown.source?.directoryUrl ?? null;
    const held = status !== 'REFERENCE' && !!list && !!directoryUrl && referenceDirectories.has(directoryUrl);
    const note =
      status === 'REFERENCE'
        ? 'Reference event — maintained by hand, never synced.'
        : held
          ? "Held: this list comes from a reference event's directory — confirm it is this event's own before importing."
          : list && !sync
            ? 'Not in the dry run: the list was stored after it ran. Re-run the dry run to include it.'
            : sync && sync.status !== 'created' && sync.status !== 'unchanged'
              ? sync.reason ?? sync.status
              : null;
    events[event.slug] = {
      name: event.name,
      city: event.city,
      country: event.country,
      startDate: event.startDate,
      status,
      platform: shown.source?.platform ?? null,
      directoryUrl,
      listed: list?.exhibitors.length ?? 0,
      importable: status === 'REFERENCE' || held ? 0 : sync?.inserted ?? 0,
      directoryTotal: list?.total ?? null,
      completeness: list ? completeness(list.exhibitors.length, list.total, list.partial) : null,
      note,
      held,
      checkedAt: shown.checkedAt ?? null,
    };
  }

  const sorted = Object.fromEntries(Object.entries(events).sort(([, a], [, b]) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)));
  await writeFile(
    path.join(root, 'data', 'exhibitor-directories.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), scope: `upcoming from ${today}`, dryRunAt: dryRun.at, events: sorted }, null, 1)}\n`
  );

  // --- Report -------------------------------------------------------------------------------------------
  const entries = Object.entries(sorted);
  const lists = entries.filter(([, entry]) => entry.status === 'VERIFIED_LIST');
  const ready = lists.filter(([, entry]) => entry.importable > 0);
  const held = lists.filter(([, entry]) => entry.held);
  const notKeyable = lists.filter(([, entry]) => entry.importable === 0 && !entry.held);
  const group = (kind: Completeness) => ready.filter(([, entry]) => entry.completeness === kind);
  const sum = (rows: [string, DirectoryEntry][]) => rows.reduce((total, [, entry]) => total + entry.importable, 0);
  const tally: Record<string, number> = {};
  for (const [, entry] of entries) tally[entry.status] = (tally[entry.status] ?? 0) + 1;
  const withoutEvidence = upcoming.length - entries.length;

  const table = (rows: [string, DirectoryEntry][]) => [
    '| # | Event | Date | City, country | Platform | Read | Importable | Directory total |',
    '|---:|---|---|---|---|---:|---:|---:|',
    ...rows.map(([, entry], index) => `| ${index + 1} | ${entry.name} | ${entry.startDate} | ${[entry.city, entry.country === 'Unknown' ? '' : entry.country].filter(Boolean).join(', ')} | ${entry.platform ?? ''} | ${entry.listed} | ${entry.importable} | ${entry.directoryTotal ?? ''} |`),
  ];

  const lines = [
    `# Upcoming exhibitor import plan — dry run ${dryRun.at}`,
    '',
    `Upcoming catalog events (from ${today}): ${upcoming.length}. Nothing has been written to the database.`,
    '',
    `**Ready to import: ${ready.length} events, ${sum(ready).toLocaleString('en')} exhibitor rows** (reference events excluded).`,
    '',
    '| Group | Events | Rows |',
    '|---|---:|---:|',
    `| Complete — whole list read | ${group('complete').length} | ${sum(group('complete')).toLocaleString('en')} |`,
    `| Partial — only part of the list readable | ${group('partial').length} | ${sum(group('partial')).toLocaleString('en')} |`,
    `| Held — list comes from a reference event's directory (not counted) | ${held.length} | ${held.reduce((total, [, entry]) => total + entry.listed, 0).toLocaleString('en')} read |`,
    `| Verified but not importable | ${notKeyable.length} | 0 |`,
    '',
    '| Directory status (upcoming events) | Events |',
    '|---|---:|',
    ...Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([status, count]) => `| ${status} | ${count} |`),
    `| NO_VERIFIED_DIRECTORY (not listed in the data file) | ${withoutEvidence} |`,
    '',
    '## Complete — whole list read',
    '',
    ...table(group('complete')),
    '',
    '## Partial',
    '',
    ...table(group('partial')),
    '',
    '## Held and not importable',
    '',
    '| Event | Date | Reason |',
    '|---|---|---|',
    ...[...held, ...notKeyable].map(([, entry]) => `| ${entry.name} | ${entry.startDate} | ${entry.note ?? ''} |`),
  ];
  const outDir = path.join(root, 'reports', 'crm-exhibitor-sync');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'upcoming-import-plan.md'), lines.join('\n'));
  const columns = ['slug', 'name', 'startDate', 'city', 'country', 'status', 'completeness', 'held', 'platform', 'listed', 'importable', 'directoryTotal', 'directoryUrl', 'note', 'checkedAt'] as const;
  await writeFile(
    path.join(outDir, 'upcoming-import-plan.csv'),
    '﻿' + [columns.join(','), ...entries.map(([slug, entry]) => columns.map((column) => csvCell(column === 'slug' ? slug : entry[column])).join(','))].join('\n')
  );
  console.log(lines.slice(0, 22).join('\n'));
}

main().catch((error) => {
  console.error('[exhibitors:directories]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
